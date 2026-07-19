import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  Video, 
  Calendar, 
  Phone, 
  MoreHorizontal,
  ChevronLeft,
  Check,
  CheckCheck
} from 'lucide-react';
import { subscribeToMessages, sendMessage, markMessagesAsRead } from '../../services/chatService';
import { useUser } from '../../contexts/UserContext';
import { Message, Chat } from '../../types';
import { cn } from '../../lib/utils';

export function ChatRoom({ chat, onClose }: { chat: Chat, onClose: () => void }) {
  const { profile } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMeetingExpanded, setIsMeetingExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToMessages(chat.id, setMessages);
    return () => unsub();
  }, [chat.id]);

  useEffect(() => {
    if (profile && messages.length > 0) {
      markMessagesAsRead(chat.id, profile.uid, messages);
    }
  }, [chat.id, profile, messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !profile) return;
    const text = inputText;
    setInputText('');
    await sendMessage(chat.id, profile.uid, text);
  };

  const otherParticipantName = profile?.role === 'candidate' ? chat.employerName : chat.candidateName;
  const otherParticipantPhoto = profile?.role === 'candidate' ? chat.employerPhoto : chat.candidatePhoto;

  const generateMeetLink = () => {
    const randomId = Math.random().toString(36).substring(7);
    return `https://meet.google.com/new?authuser=0&hs=179&pli=1&jobmatch_${randomId}`;
  };

  const generateWhatsAppLink = () => {
    // In a real app we'd have the phone number
    return `https://wa.me/?text=Hi%20${otherParticipantName},%20I'd%20like%20to%20chat%20about%20the%20job%20match!`;
  };

  const generateCalendarLink = () => {
    const title = encodeURIComponent(`JobMatch Interview: ${chat.employerName} x ${chat.candidateName}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=Interview%20scheduled%20via%20JobMatch&location=Google%20Meet`;
  };

  const handleStartCall = async () => {
    if (!profile) return;
    const meetLink = generateMeetLink();
    await sendMessage(chat.id, profile.uid, `[VIDEO_CALL] ${meetLink}`);
    window.open(meetLink, '_blank');
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[110] bg-white flex flex-col"
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 safe-top">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
            {otherParticipantPhoto ? (
              <img src={otherParticipantPhoto} alt={otherParticipantName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                {otherParticipantName[0]}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-black italic uppercase tracking-tighter text-gray-900 leading-none">{otherParticipantName}</h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mt-1">Matched</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsMeetingExpanded(!isMeetingExpanded)}
            className={cn(
              "p-2.5 rounded-2xl transition-all active:scale-95 flex items-center gap-2",
              isMeetingExpanded ? "bg-orange-500 text-white" : "bg-gray-50 text-gray-400 hover:text-orange-500"
            )}
          >
            <Video className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest px-1">Meet</span>
          </button>
        </div>
      </div>

      {/* Meeting Options Overlay */}
      <AnimatePresence>
        {isMeetingExpanded && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMeetingExpanded(false)}
              className="absolute inset-0 z-[105] bg-black/5"
            />
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-20 right-6 z-[110] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[32px] p-2 border border-gray-100 w-64 overflow-hidden"
            >
              <div className="p-3 border-b border-gray-50">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] px-2 mb-1">Interview Tools</p>
              </div>
              <div className="p-2 space-y-1">
                <button 
                  onClick={() => {
                    handleStartCall();
                    setIsMeetingExpanded(false);
                  }} 
                  className="w-full flex items-center gap-3 p-4 hover:bg-orange-50 rounded-2xl transition-all group"
                >
                  <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-100 group-hover:scale-110 transition-transform">
                    <Video className="w-4 h-4 fill-current" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest block">Start Instant Meet</span>
                    <span className="text-[8px] text-gray-400 font-bold">Generates link in chat</span>
                  </div>
                </button>

                <a 
                  href={generateWhatsAppLink()} 
                  target="_blank" 
                  rel="noreferrer" 
                  onClick={() => setIsMeetingExpanded(false)}
                  className="flex items-center gap-3 p-4 hover:bg-green-50 rounded-2xl transition-all group"
                >
                  <div className="p-2.5 bg-green-50 text-green-500 rounded-xl group-hover:bg-green-500 group-hover:text-white transition-all">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest block font-bold">WhatsApp Call</span>
                    <span className="text-[8px] text-gray-400 font-bold">Open mobile app</span>
                  </div>
                </a>

                <a 
                  href={generateCalendarLink()} 
                  target="_blank" 
                  rel="noreferrer" 
                  onClick={() => setIsMeetingExpanded(false)}
                  className="flex items-center gap-3 p-4 hover:bg-blue-50 rounded-2xl transition-all group"
                >
                  <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest block font-bold">Schedule Event</span>
                    <span className="text-[8px] text-gray-400 font-bold">Add to Google Calendar</span>
                  </div>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30"
      >
        {messages.map((msg, idx) => {
          const isOwn = msg.senderId === profile?.uid;
          const isVideoCall = msg.text.startsWith('[VIDEO_CALL]');
          const meetUrl = isVideoCall ? msg.text.replace('[VIDEO_CALL] ', '') : '';

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.id || idx}
              className={cn(
                "flex flex-col max-w-[80%]",
                isOwn ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              {isVideoCall ? (
                <div className={cn(
                  "p-5 rounded-[32px] shadow-xl border overflow-hidden relative",
                  isOwn ? "bg-orange-500 border-orange-400 text-white" : "bg-white border-gray-100 text-gray-900"
                )}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("p-2 rounded-xl", isOwn ? "bg-white/20" : "bg-orange-50")}>
                      <Video className={cn("w-5 h-5", isOwn ? "text-white" : "text-orange-500")} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Video Interview</span>
                  </div>
                  <p className="text-xs font-bold mb-4">Click to join the meeting room</p>
                  <a 
                    href={meetUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-black italic uppercase tracking-tighter text-sm transition-all active:scale-95",
                      isOwn ? "bg-white text-orange-500" : "bg-orange-500 text-white shadow-lg shadow-orange-100"
                    )}
                  >
                    Join Meet
                  </a>
                </div>
              ) : (
                <div className={cn(
                  "p-4 rounded-[24px] font-medium text-sm shadow-sm",
                  isOwn 
                    ? "bg-black text-white rounded-br-none" 
                    : "bg-white text-gray-900 rounded-bl-none border border-gray-100"
                )}>
                  {msg.text}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5 px-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {isOwn && (
                  msg.read ? (
                    <CheckCheck className="w-3 h-3 text-orange-500" />
                  ) : (
                    <Check className="w-3 h-3 text-gray-300" />
                  )
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-6 bg-white border-t border-gray-100 safe-bottom">
        <form onSubmit={handleSend} className="flex gap-3">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 font-medium text-sm outline-none ring-2 ring-transparent focus:ring-orange-500/10 transition-all"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center disabled:opacity-50 shadow-xl shadow-orange-100 active:scale-95 transition-all"
          >
            <Send className="w-5 h-5 fill-current" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
