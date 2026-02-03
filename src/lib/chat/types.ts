// Chat Types and Interfaces

export interface Contact {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  publicKey: string;
  fingerprint: string;
  isOnline: boolean;
  lastSeen?: number;
}

export interface Conversation {
  id: string;
  contact: Contact;
  lastMessage?: Message;
  unreadCount: number;
  isEncrypted: boolean;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isEncrypted: boolean;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  lastSeen?: number;
}

export type ChatEvent = 
  | { type: 'message'; payload: Message }
  | { type: 'typing'; payload: TypingIndicator }
  | { type: 'presence'; payload: PresenceUpdate }
  | { type: 'read'; payload: { conversationId: string; lastReadId: string } };
