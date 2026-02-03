import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Contact, Conversation, Message, TypingIndicator, PresenceUpdate } from '@/lib/chat/types';
import { useAuth } from './AuthContext';
import { messageStore } from '@/lib/storage/messageStore';
import { WebSocketClient, type ConnectionState } from '@/lib/websocket/client';

interface ChatContextType {
  // State
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  contacts: Contact[];
  typingIndicators: Map<string, Set<string>>;
  presenceMap: Map<string, PresenceUpdate>;
  isLoading: boolean;
  error: string | null;
  connectionState: ConnectionState;
  
  // Actions
  selectConversation: (conversationId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  startConversation: (contact: Contact) => void;
  setTyping: (isTyping: boolean) => void;
  markAsRead: (conversationId: string) => void;
  searchContacts: (query: string) => Promise<Contact[]>;
  addContact: (username: string) => Promise<Contact>;
  clearError: () => void;
  refreshConversations: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

// Demo contacts for testing
const demoContacts: Contact[] = [
  {
    id: 'contact-1',
    username: 'alice',
    displayName: 'Alice Chen',
    avatar: undefined,
    publicKey: 'BK7x1yZ2mV9c4P6wF0aQ3dE8hU5tR2nL7jM1kX9sG4oC',
    fingerprint: 'A1B2-C3D4-E5F6-7890',
    isOnline: true,
  },
  {
    id: 'contact-2',
    username: 'bob',
    displayName: 'Bob Smith',
    avatar: undefined,
    publicKey: 'CL8y2zA3nW0d5Q7xG1bR4eF9iV6uS3oM8kN2lY0tH5pD',
    fingerprint: 'B2C3-D4E5-F6A7-8901',
    isOnline: false,
    lastSeen: Date.now() - 3600000,
  },
  {
    id: 'contact-3',
    username: 'carol',
    displayName: 'Carol Williams',
    avatar: undefined,
    publicKey: 'DM9z3AB4oX1e6R8yH2cS5fG0jW7vT4pN9lO3mZ1uI6qE',
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
  const { user, isAuthenticated, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>(demoContacts);
  const [typingIndicators, setTypingIndicators] = useState<Map<string, Set<string>>>(new Map());
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceUpdate>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  
  const typingTimeoutRef = useRef<number | null>(null);
  const wsClientRef = useRef<WebSocketClient | null>(null);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (isAuthenticated && token && user) {
      // In production, this would connect to actual WebSocket server
      // For demo, we simulate the connection
      setConnectionState('connected');
      
      // Initialize presence for demo contacts
      const initialPresence = new Map<string, PresenceUpdate>();
      demoContacts.forEach(contact => {
        initialPresence.set(contact.id, {
          userId: contact.id,
          isOnline: contact.isOnline,
          lastSeen: contact.lastSeen,
        });
      });
      setPresenceMap(initialPresence);
    } else {
      setConnectionState('disconnected');
    }

    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
      }
    };
  }, [isAuthenticated, token, user]);

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

  // Simulate typing indicators from other users
  useEffect(() => {
    if (!activeConversation) return;

    // Demo: simulate typing occasionally
    const interval = setInterval(() => {
      if (Math.random() > 0.95 && activeConversation.contact.isOnline) {
        const convId = activeConversation.id;
        const userId = activeConversation.contact.id;

        setTypingIndicators(prev => {
          const newMap = new Map(prev);
          const users = new Set(newMap.get(convId) || []);
          users.add(userId);
          newMap.set(convId, users);
          return newMap;
        });

        // Clear after 2 seconds
        setTimeout(() => {
          setTypingIndicators(prev => {
            const newMap = new Map(prev);
            const users = newMap.get(convId);
            if (users) {
              users.delete(userId);
              if (users.size === 0) {
                newMap.delete(convId);
              }
            }
            return newMap;
          });
        }, 2000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeConversation]);

  const selectConversation = useCallback((conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setActiveConversation(conv);
      setMessages(demoMessages[conversationId] || []);
      setHasMoreMessages(false); // Demo has all messages loaded
      
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

    // Store locally (in production, would encrypt first)
    try {
      await messageStore.saveMessage({
        id: newMessage.id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        recipientId: activeConversation.contact.id,
        ciphertext: btoa(content), // Demo: base64 encode (not real encryption)
        timestamp: newMessage.timestamp,
      });
    } catch (err) {
      console.error('Failed to store message:', err);
    }

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

    // Simulate reply after 2 seconds (only if online)
    if (activeConversation.contact.isOnline) {
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
    }
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

    // In production: send typing indicator via WebSocket
    if (wsClientRef.current) {
      // wsClientRef.current.send('typing', { conversationId: activeConversation.id, isTyping });
    }

    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        setTyping(false);
      }, 3000);
    }
  }, [activeConversation]);

  const markAsRead = useCallback(async (conversationId: string) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );

    // Mark all messages in conversation as read
    try {
      await messageStore.markConversationAsRead(conversationId);
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
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
      publicKey: 'EQ0A4BC5pY2f7S9zI3dT6gH1kW8wU5qO0mP4nA2vJ7rF',
      fingerprint: 'XXXX-XXXX-XXXX-XXXX',
      isOnline: false,
    };

    setContacts(prev => [...prev, newContact]);
    
    // Add to presence map
    setPresenceMap(prev => new Map(prev).set(newContact.id, {
      userId: newContact.id,
      isOnline: false,
    }));

    return newContact;
  }, []);

  const refreshConversations = useCallback(async () => {
    setIsLoading(true);
    // In production: fetch from server
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!activeConversation || !hasMoreMessages) return;
    setIsLoading(true);
    // In production: fetch older messages from IndexedDB or server
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  }, [activeConversation, hasMoreMessages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ChatContextType = {
    conversations,
    activeConversation,
    messages,
    contacts,
    typingIndicators,
    presenceMap,
    isLoading,
    error,
    connectionState,
    selectConversation,
    sendMessage,
    startConversation,
    setTyping,
    markAsRead,
    searchContacts,
    addContact,
    clearError,
    refreshConversations,
    loadMoreMessages,
    hasMoreMessages,
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
