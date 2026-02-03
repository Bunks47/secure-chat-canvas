import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Contact, Conversation, Message, TypingIndicator, PresenceUpdate } from '@/lib/chat/types';
import { useAuth } from './AuthContext';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  contacts: Contact[];
  typingIndicators: Map<string, boolean>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  selectConversation: (conversationId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  startConversation: (contact: Contact) => void;
  setTyping: (isTyping: boolean) => void;
  markAsRead: (conversationId: string) => void;
  searchContacts: (query: string) => Promise<Contact[]>;
  addContact: (username: string) => Promise<Contact>;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

// Demo contacts for testing
const demoContacts: Contact[] = [
  {
    id: 'contact-1',
    username: 'alice',
    displayName: 'Alice Chen',
    avatar: undefined,
    publicKey: 'demo-pk-1',
    fingerprint: 'A1B2-C3D4-E5F6-7890',
    isOnline: true,
  },
  {
    id: 'contact-2',
    username: 'bob',
    displayName: 'Bob Smith',
    avatar: undefined,
    publicKey: 'demo-pk-2',
    fingerprint: 'B2C3-D4E5-F6A7-8901',
    isOnline: false,
    lastSeen: Date.now() - 3600000,
  },
  {
    id: 'contact-3',
    username: 'carol',
    displayName: 'Carol Williams',
    avatar: undefined,
    publicKey: 'demo-pk-3',
    fingerprint: 'C3D4-E5F6-A7B8-9012',
    isOnline: true,
  },
];

const demoMessages: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'contact-1',
      content: 'Hey! How are you doing?',
      timestamp: Date.now() - 3600000,
      status: 'read',
      isEncrypted: true,
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'current-user',
      content: "I'm good! Just testing out this E2EE chat app 🔐",
      timestamp: Date.now() - 3500000,
      status: 'read',
      isEncrypted: true,
    },
    {
      id: 'msg-3',
      conversationId: 'conv-1',
      senderId: 'contact-1',
      content: 'Nice! The encryption looks solid. Love the key fingerprint verification.',
      timestamp: Date.now() - 3400000,
      status: 'read',
      isEncrypted: true,
    },
  ],
  'conv-2': [
    {
      id: 'msg-4',
      conversationId: 'conv-2',
      senderId: 'contact-2',
      content: 'Did you get the files I sent?',
      timestamp: Date.now() - 86400000,
      status: 'read',
      isEncrypted: true,
    },
  ],
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>(demoContacts);
  const [typingIndicators, setTypingIndicators] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Initialize demo conversations when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const demoConversations: Conversation[] = [
        {
          id: 'conv-1',
          contact: demoContacts[0],
          lastMessage: demoMessages['conv-1'][2],
          unreadCount: 0,
          isEncrypted: true,
          updatedAt: Date.now() - 3400000,
        },
        {
          id: 'conv-2',
          contact: demoContacts[1],
          lastMessage: demoMessages['conv-2'][0],
          unreadCount: 1,
          isEncrypted: true,
          updatedAt: Date.now() - 86400000,
        },
      ];
      setConversations(demoConversations);
    } else {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
    }
  }, [isAuthenticated, user]);

  const selectConversation = useCallback((conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setActiveConversation(conv);
      setMessages(demoMessages[conversationId] || []);
      
      // Mark as read
      setConversations(prev => 
        prev.map(c => 
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    }
  }, [conversations]);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConversation || !user) return;

    const newMessage: Message = {
      id: 'msg-' + Date.now(),
      conversationId: activeConversation.id,
      senderId: 'current-user',
      content,
      timestamp: Date.now(),
      status: 'sending',
      isEncrypted: true,
    };

    setMessages(prev => [...prev, newMessage]);

    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 500));

    setMessages(prev => 
      prev.map(m => 
        m.id === newMessage.id ? { ...m, status: 'sent' as const } : m
      )
    );

    // Update conversation
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConversation.id
          ? { ...c, lastMessage: { ...newMessage, status: 'sent' as const }, updatedAt: Date.now() }
          : c
      )
    );

    // Simulate reply after 2 seconds
    setTimeout(() => {
      const reply: Message = {
        id: 'msg-' + Date.now(),
        conversationId: activeConversation.id,
        senderId: activeConversation.contact.id,
        content: '👍 Got it! (This is a demo response)',
        timestamp: Date.now(),
        status: 'delivered',
        isEncrypted: true,
      };
      
      setMessages(prev => [...prev, reply]);
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConversation.id
            ? { ...c, lastMessage: reply, updatedAt: Date.now() }
            : c
        )
      );
    }, 2000);
  }, [activeConversation, user]);

  const startConversation = useCallback((contact: Contact) => {
    // Check if conversation exists
    const existing = conversations.find(c => c.contact.id === contact.id);
    if (existing) {
      selectConversation(existing.id);
      return;
    }

    // Create new conversation
    const newConversation: Conversation = {
      id: 'conv-' + Date.now(),
      contact,
      unreadCount: 0,
      isEncrypted: true,
      updatedAt: Date.now(),
    };

    setConversations(prev => [newConversation, ...prev]);
    setActiveConversation(newConversation);
    setMessages([]);
  }, [conversations, selectConversation]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!activeConversation) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // In real app, send typing indicator via WebSocket
    console.log('Typing:', isTyping);

    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        setTyping(false);
      }, 3000);
    }
  }, [activeConversation]);

  const markAsRead = useCallback((conversationId: string) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
  }, []);

  const searchContacts = useCallback(async (query: string): Promise<Contact[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const lowerQuery = query.toLowerCase();
    return contacts.filter(c =>
      c.username.toLowerCase().includes(lowerQuery) ||
      c.displayName.toLowerCase().includes(lowerQuery)
    );
  }, [contacts]);

  const addContact = useCallback(async (username: string): Promise<Contact> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newContact: Contact = {
      id: 'contact-' + Date.now(),
      username,
      displayName: username,
      publicKey: 'demo-pk-' + Date.now(),
      fingerprint: 'XXXX-XXXX-XXXX-XXXX',
      isOnline: false,
    };

    setContacts(prev => [...prev, newContact]);
    return newContact;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ChatContextType = {
    conversations,
    activeConversation,
    messages,
    contacts,
    typingIndicators,
    isLoading,
    error,
    selectConversation,
    sendMessage,
    startConversation,
    setTyping,
    markAsRead,
    searchContacts,
    addContact,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
