// Message History Hook
// Implements offline-first message loading with sync

import { useState, useEffect, useCallback, useRef } from 'react';
import { messageStore, type StoredMessage } from '@/lib/storage/messageStore';
import type { Message } from '@/lib/chat/types';

interface UseMessagesOptions {
  conversationId: string | undefined;
  pageSize?: number;
  autoLoad?: boolean;
}

interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Convert stored message to UI message
 * Note: In production, this would include decryption
 */
function storedToMessage(stored: StoredMessage, currentUserId: string): Message {
  return {
    id: stored.id,
    conversationId: stored.conversationId,
    senderId: stored.senderId,
    // In production: decrypt ciphertext here
    content: '[Encrypted message - decryption pending]',
    timestamp: stored.timestamp,
    status: stored.synced ? 'delivered' : 'sending',
    isEncrypted: true,
  };
}

export function useMessages({
  conversationId,
  pageSize = 50,
  autoLoad = true,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const oldestTimestampRef = useRef<number | undefined>(undefined);
  const currentUserIdRef = useRef<string>('current-user');

  // Load initial messages
  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const stored = await messageStore.getConversationMessages(conversationId, {
        limit: pageSize,
      });

      const loadedMessages = stored.map(s => storedToMessage(s, currentUserIdRef.current));
      
      // Sort by timestamp ascending (oldest first)
      loadedMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      setMessages(loadedMessages);
      setHasMore(stored.length === pageSize);
      
      if (stored.length > 0) {
        oldestTimestampRef.current = Math.min(...stored.map(m => m.timestamp));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, pageSize]);

  // Load more (older) messages
  const loadMore = useCallback(async () => {
    if (!conversationId || isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const stored = await messageStore.getConversationMessages(conversationId, {
        limit: pageSize,
        beforeTimestamp: oldestTimestampRef.current,
      });

      if (stored.length === 0) {
        setHasMore(false);
        return;
      }

      const olderMessages = stored.map(s => storedToMessage(s, currentUserIdRef.current));
      olderMessages.sort((a, b) => a.timestamp - b.timestamp);

      setMessages(prev => [...olderMessages, ...prev]);
      setHasMore(stored.length === pageSize);
      oldestTimestampRef.current = Math.min(...stored.map(m => m.timestamp));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading, hasMore, pageSize]);

  // Add a new message to the list
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      // Check if message already exists
      if (prev.some(m => m.id === message.id)) {
        return prev.map(m => m.id === message.id ? message : m);
      }
      return [...prev, message];
    });
  }, []);

  // Update an existing message
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages(prev => 
      prev.map(m => m.id === messageId ? { ...m, ...updates } : m)
    );
  }, []);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await messageStore.deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
    }
  }, []);

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await messageStore.markAsRead(messageId);
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, status: 'read' as const } : m)
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Refresh messages
  const refresh = useCallback(async () => {
    oldestTimestampRef.current = undefined;
    setHasMore(true);
    await loadMessages();
  }, [loadMessages]);

  // Auto-load on conversation change
  useEffect(() => {
    if (autoLoad && conversationId) {
      oldestTimestampRef.current = undefined;
      setHasMore(true);
      loadMessages();
    } else if (!conversationId) {
      setMessages([]);
    }
  }, [conversationId, autoLoad, loadMessages]);

  return {
    messages,
    isLoading,
    hasMore,
    error,
    loadMore,
    addMessage,
    updateMessage,
    deleteMessage,
    markAsRead,
    refresh,
  };
}

/**
 * Hook for syncing messages with server
 */
export function useMessageSync(
  isOnline: boolean,
  onSyncComplete?: (count: number) => void
): {
  isSyncing: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
} {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Update pending count
  useEffect(() => {
    const updateCount = async () => {
      const unsynced = await messageStore.getUnsynced();
      setPendingCount(unsynced.length);
    };

    updateCount();
    const interval = setInterval(updateCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const unsynced = await messageStore.getUnsynced();
      // In production: send each message to server
      // For now, just mark as synced (simulating successful sync)
      for (const msg of unsynced) {
        await messageStore.markSynced(msg.id);
      }
      setPendingCount(0);
      onSyncComplete?.(unsynced.length);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, onSyncComplete]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow();
    }
  }, [isOnline, pendingCount, syncNow]);

  return { isSyncing, pendingCount, syncNow };
}

/**
 * Hook for managing unread counts
 */
export function useUnreadCounts(): {
  counts: Map<string, number>;
  getCount: (conversationId: string) => number;
  refresh: () => Promise<void>;
} {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    // In production: fetch from server or calculate from local storage
    // For now, return empty map
    setCounts(new Map());
  }, []);

  const getCount = useCallback((conversationId: string): number => {
    return counts.get(conversationId) ?? 0;
  }, [counts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, getCount, refresh };
}
