// WebSocket Hook for React Components
// Provides reactive WebSocket state and message handling

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketClient, type ConnectionState, type WebSocketConfig } from '@/lib/websocket/client';
import { MessageHandler, type MessageHandlerCallbacks } from '@/lib/websocket/messageHandler';
import type { KeyPair } from '@/lib/crypto';
import type { Message, TypingIndicator, PresenceUpdate } from '@/lib/chat/types';

interface UseWebSocketOptions {
  url: string;
  token?: string;
  userId?: string;
  keyPair?: KeyPair | null;
  autoConnect?: boolean;
  callbacks?: MessageHandlerCallbacks;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (
    recipientId: string,
    conversationId: string,
    content: string,
    recipientPublicKey: string,
    recipientFingerprint: string
  ) => Promise<Message>;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  sendReadReceipt: (conversationId: string, messageId: string) => void;
  hasSession: (peerId: string) => boolean;
}

export function useWebSocket({
  url,
  token,
  userId,
  keyPair,
  autoConnect = true,
  callbacks,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const clientRef = useRef<WebSocketClient | null>(null);
  const handlerRef = useRef<MessageHandler | null>(null);

  // Initialize client and handler
  useEffect(() => {
    if (!url) return;

    const client = new WebSocketClient({
      url,
      token: token || '',
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });

    const handler = new MessageHandler(client);
    
    clientRef.current = client;
    handlerRef.current = handler;

    // Set up connection state tracking
    const unsubscribe = client.onConnectionChange((state) => {
      setConnectionState(state);
    });

    return () => {
      unsubscribe();
      handler.destroy();
      client.disconnect();
      clientRef.current = null;
      handlerRef.current = null;
    };
  }, [url, token]);

  // Initialize handler with user identity
  useEffect(() => {
    if (handlerRef.current && userId && keyPair) {
      handlerRef.current.initialize(userId, keyPair);
    }
  }, [userId, keyPair]);

  // Set callbacks
  useEffect(() => {
    if (handlerRef.current && callbacks) {
      handlerRef.current.setCallbacks(callbacks);
    }
  }, [callbacks]);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && clientRef.current && token) {
      clientRef.current.connect();
    }
  }, [autoConnect, token]);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const sendMessage = useCallback(async (
    recipientId: string,
    conversationId: string,
    content: string,
    recipientPublicKey: string,
    recipientFingerprint: string
  ): Promise<Message> => {
    if (!handlerRef.current) {
      throw new Error('WebSocket not initialized');
    }
    return handlerRef.current.sendMessage(
      recipientId,
      conversationId,
      content,
      recipientPublicKey,
      recipientFingerprint
    );
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    handlerRef.current?.sendTyping(conversationId, isTyping);
  }, []);

  const sendReadReceipt = useCallback((conversationId: string, messageId: string) => {
    handlerRef.current?.sendReadReceipt(conversationId, messageId);
  }, []);

  const hasSession = useCallback((peerId: string): boolean => {
    return handlerRef.current?.hasSession(peerId) ?? false;
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    sendReadReceipt,
    hasSession,
  };
}

/**
 * Hook for presence tracking
 */
export function usePresence(
  userId: string | undefined,
  wsClient: WebSocketClient | null
): {
  presenceMap: Map<string, PresenceUpdate>;
  updatePresence: (userId: string, update: PresenceUpdate) => void;
} {
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceUpdate>>(new Map());

  useEffect(() => {
    if (!wsClient) return;

    const unsubscribe = wsClient.on('presence', (msg) => {
      const update = msg.payload as PresenceUpdate;
      setPresenceMap(prev => new Map(prev).set(update.userId, update));
    });

    return unsubscribe;
  }, [wsClient]);

  const updatePresence = useCallback((userId: string, update: PresenceUpdate) => {
    setPresenceMap(prev => new Map(prev).set(userId, update));
  }, []);

  return { presenceMap, updatePresence };
}

/**
 * Hook for typing indicators
 */
export function useTypingIndicators(
  wsClient: WebSocketClient | null
): {
  typingMap: Map<string, Set<string>>;
  isTyping: (conversationId: string, userId: string) => boolean;
} {
  const [typingMap, setTypingMap] = useState<Map<string, Set<string>>>(new Map());
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!wsClient) return;

    const unsubscribe = wsClient.on('typing', (msg) => {
      const indicator = msg.payload as TypingIndicator;
      const key = `${indicator.conversationId}-${indicator.userId}`;

      // Clear existing timeout
      const existingTimeout = timeoutsRef.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      setTypingMap(prev => {
        const newMap = new Map(prev);
        const users = newMap.get(indicator.conversationId) || new Set();
        
        if (indicator.isTyping) {
          users.add(indicator.userId);
          // Auto-clear after 3 seconds
          const timeout = window.setTimeout(() => {
            setTypingMap(p => {
              const m = new Map(p);
              const u = m.get(indicator.conversationId);
              if (u) {
                u.delete(indicator.userId);
                if (u.size === 0) m.delete(indicator.conversationId);
              }
              return m;
            });
          }, 3000);
          timeoutsRef.current.set(key, timeout);
        } else {
          users.delete(indicator.userId);
        }
        
        if (users.size > 0) {
          newMap.set(indicator.conversationId, users);
        } else {
          newMap.delete(indicator.conversationId);
        }
        
        return newMap;
      });
    });

    return () => {
      unsubscribe();
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, [wsClient]);

  const isTyping = useCallback((conversationId: string, userId: string): boolean => {
    return typingMap.get(conversationId)?.has(userId) ?? false;
  }, [typingMap]);

  return { typingMap, isTyping };
}
