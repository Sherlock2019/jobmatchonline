import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Chat, Message, UserProfile } from '../types';

export async function getOrCreateChat(
  candidate: UserProfile, 
  employer: UserProfile
): Promise<string> {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef, 
    where('participants', 'array-contains', candidate.uid)
  );

  const snapshot = await getDocs(q);
  const existingChat = snapshot.docs.find(doc => 
    (doc.data() as Chat).participants.includes(employer.uid)
  );

  if (existingChat) {
    return existingChat.id;
  }

  const newChat: Omit<Chat, 'id'> = {
    participants: [candidate.uid, employer.uid],
    candidateName: candidate.displayName,
    candidatePhoto: candidate.photoURL || '',
    employerName: employer.displayName,
    employerPhoto: employer.photoURL || '',
    lastMessage: 'Match established! Say hello.',
    lastTimestamp: Date.now()
  };

  const docRef = await addDoc(chatsRef, newChat);
  return docRef.id;
}

export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', userId),
    orderBy('lastTimestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
    callback(chats);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'chats');
  });
}

export function subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
    callback(messages);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
  });
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatRef = doc(db, 'chats', chatId);

    const timestamp = Date.now();
    
    await addDoc(messagesRef, {
      senderId,
      text,
      timestamp,
      read: false
    });

    await updateDoc(chatRef, {
      lastMessage: text,
      lastTimestamp: timestamp
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
  }
}

export async function markMessagesAsRead(chatId: string, userId: string, messages: Message[]) {
  try {
    const unreadMessages = messages.filter(m => m.senderId !== userId && !m.read);
    
    if (unreadMessages.length === 0) return;

    await Promise.all(unreadMessages.map(m => {
      const msgRef = doc(db, 'chats', chatId, 'messages', m.id);
      return updateDoc(msgRef, { read: true });
    }));
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}
