import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Match, UserProfile, JobPost, Chat } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Heart, ChevronRight, Briefcase, User as UserIcon } from 'lucide-react';
import { subscribeToChats, getOrCreateChat } from '../services/chatService';
import { ChatRoom } from '../components/chat/ChatRoom';
import { cn } from '../lib/utils';

export function Matches() {
  const { profile } = useUser();
  const [activeTab, setActiveTab] = useState<'matches' | 'messages'>('matches');
  const [matches, setMatches] = useState<any[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Load matches
    const matchesRef = collection(db, 'matches');
    const q = query(
      matchesRef,
      profile.role === 'candidate' 
        ? where('candidateUid', '==', profile.uid) 
        : where('employerUid', '==', profile.uid)
    );

    const matchUnsub = onSnapshot(q, async (snap) => {
      const matchData = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as Match;
        try {
          if (profile.role === 'candidate') {
            const jobSnap = await getDoc(doc(db, 'jobs', data.jobPostId));
            return { id: d.id, ...data, other: jobSnap.data() as JobPost };
          } else {
            const userSnap = await getDoc(doc(db, 'profiles', data.candidateUid));
            return { id: d.id, ...data, other: userSnap.data() as UserProfile };
          }
        } catch (error) {
          return { id: d.id, ...data, other: null };
        }
      }));
      setMatches(matchData.filter(m => m.other));
      setLoading(false);
    });

    // Subscribe to chats
    const chatUnsub = subscribeToChats(profile.uid, (data) => {
      setChats(data);
    });

    return () => {
      matchUnsub();
      chatUnsub();
    };
  }, [profile]);

  const handleStartChat = async (match: any) => {
    if (!profile) return;
    
    let candidate, employer;

    if (profile.role === 'candidate') {
      candidate = profile;
      // Fetch employer profile from job
      const employerDoc = await getDoc(doc(db, 'profiles', match.employerUid));
      employer = employerDoc.data() as UserProfile;
    } else {
      employer = profile;
      candidate = match.other as UserProfile;
    }

    if (candidate && employer) {
      const chatId = await getOrCreateChat(candidate, employer);
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        setSelectedChat({ id: chatId, ...chatDoc.data() } as Chat);
      }
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-20">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-white safe-top">
      {/* Header */}
      <div className="px-6 py-8">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900 leading-none mb-6">Connections</h2>
        
        <div className="flex bg-gray-50 p-1.5 rounded-[24px]">
          <button 
            onClick={() => setActiveTab('matches')}
            className={cn(
              "flex-1 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'matches' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
            )}
          >
            Matches ({matches.length})
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={cn(
              "flex-1 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'messages' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
            )}
          >
            Chats ({chats.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'matches' ? (
            <motion.div 
              key="matches"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-2 gap-4"
            >
              {matches.length === 0 ? (
                <div className="col-span-2 py-20 text-center bg-gray-50 rounded-[40px]">
                  <Heart className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No matches yet</p>
                </div>
              ) : (
                matches.map((match) => (
                  <button 
                    key={match.id}
                    onClick={() => handleStartChat(match)}
                    className="group relative aspect-square rounded-[32px] overflow-hidden bg-gray-100 ring-4 ring-white shadow-xl hover:scale-105 transition-transform"
                  >
                    <img 
                      src={profile?.role === 'candidate' ? match.other.companyLogo : match.other.photoURL} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                      <p className="text-white font-black italic uppercase tracking-tighter text-sm leading-tight text-left">
                        {profile?.role === 'candidate' ? match.other.title : match.other.displayName}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="messages"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {chats.length === 0 ? (
                <div className="py-20 text-center bg-gray-50 rounded-[40px]">
                  <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No active chats</p>
                </div>
              ) : (
                chats.map((chat) => {
                  const otherName = profile?.role === 'candidate' ? chat.employerName : chat.candidateName;
                  const otherPhoto = profile?.role === 'candidate' ? chat.employerPhoto : chat.candidatePhoto;
                  return (
                    <button 
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className="w-full flex items-center gap-4 p-4 rounded-[28px] border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden shrink-0 shadow-sm border-2 border-white">
                        <img src={otherPhoto} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="flex justify-between items-center mb-0.5">
                          <h4 className="font-black italic uppercase tracking-tighter text-gray-900 leading-none">{otherName}</h4>
                          <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest shrink-0">
                            {new Date(chat.lastTimestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium truncate italic mt-0.5">{chat.lastMessage}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-200" />
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedChat && (
          <ChatRoom chat={selectedChat} onClose={() => setSelectedChat(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
