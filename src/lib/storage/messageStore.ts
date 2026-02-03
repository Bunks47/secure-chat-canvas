// Enhanced Message Store with Full CRUD Operations
// Implements Phase 5: Message History & Storage

import {
  initDatabase,
  storeMessage,
  getMessages,
  getUnsyncedMessages,
  markMessageSynced,
  storeSession,
  getSession,
  clearAllData,
  type StoredMessage,
  type StoredSession,
} from './indexeddb';
import { MESSAGE_STORE, SESSION_STORE } from '../crypto/constants';

// Message sync status
export type MessageSyncStatus = 'pending' | 'synced' | 'failed';

// Extended message with sync metadata
export interface MessageWithMeta extends StoredMessage {
  syncStatus: MessageSyncStatus;
  retryCount: number;
  lastRetryAt?: number;
}

/**
 * Message Store Manager - Singleton for message operations
 */
class MessageStoreManager {
  private initialized = false;
  private pendingSync = new Map<string, MessageWithMeta>();
  private syncInterval: number | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
    this.startSyncMonitor();
  }

  private startSyncMonitor(): void {
    if (this.syncInterval) return;
    
    // Check for unsynced messages every 30 seconds
    this.syncInterval = window.setInterval(async () => {
      await this.processPendingSync();
    }, 30000);
  }

  stopSyncMonitor(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Save a new message (Create)
   */
  async saveMessage(message: Omit<StoredMessage, 'synced' | 'read'>): Promise<StoredMessage> {
    await this.init();
    
    const fullMessage: StoredMessage = {
      ...message,
      synced: false,
      read: false,
    };

    await storeMessage(fullMessage);
    
    // Track for sync
    this.pendingSync.set(message.id, {
      ...fullMessage,
      syncStatus: 'pending',
      retryCount: 0,
    });

    return fullMessage;
  }

  /**
   * Get messages for a conversation (Read)
   * Supports pagination via beforeTimestamp
   */
  async getConversationMessages(
    conversationId: string,
    options: {
      limit?: number;
      beforeTimestamp?: number;
      afterTimestamp?: number;
    } = {}
  ): Promise<StoredMessage[]> {
    await this.init();
    const { limit = 50, beforeTimestamp } = options;
    return getMessages(conversationId, limit, beforeTimestamp);
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<StoredMessage | null> {
    await this.init();
    const db = await initDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGE_STORE, 'readonly');
      const store = transaction.objectStore(MESSAGE_STORE);
      const request = store.get(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * Update a message (Update)
   */
  async updateMessage(
    messageId: string,
    updates: Partial<Pick<StoredMessage, 'ciphertext' | 'read' | 'synced'>>
  ): Promise<StoredMessage | null> {
    await this.init();
    const message = await this.getMessage(messageId);
    
    if (!message) return null;

    const updated: StoredMessage = {
      ...message,
      ...updates,
    };

    await storeMessage(updated);
    return updated;
  }

  /**
   * Delete a message (Delete)
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    await this.init();
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGE_STORE, 'readwrite');
      const store = transaction.objectStore(MESSAGE_STORE);
      const request = store.delete(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  /**
   * Delete all messages in a conversation
   */
  async deleteConversationMessages(conversationId: string): Promise<number> {
    await this.init();
    const messages = await getMessages(conversationId, 10000);
    
    let deletedCount = 0;
    for (const msg of messages) {
      await this.deleteMessage(msg.id);
      deletedCount++;
    }

    return deletedCount;
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.updateMessage(messageId, { read: true });
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId: string): Promise<void> {
    await this.init();
    const messages = await getMessages(conversationId, 10000);
    
    for (const msg of messages) {
      if (!msg.read) {
        await this.updateMessage(msg.id, { read: true });
      }
    }
  }

  /**
   * Mark message as synced with server
   */
  async markSynced(messageId: string): Promise<void> {
    await markMessageSynced(messageId);
    this.pendingSync.delete(messageId);
  }

  /**
   * Get all unsynced messages
   */
  async getUnsynced(): Promise<StoredMessage[]> {
    await this.init();
    return getUnsyncedMessages();
  }

  /**
   * Process pending sync queue
   */
  private async processPendingSync(): Promise<void> {
    const unsynced = await this.getUnsynced();
    
    // In production, this would batch send to server
    console.log(`[MessageStore] ${unsynced.length} messages pending sync`);
    
    // For now, mark them as tracked
    for (const msg of unsynced) {
      if (!this.pendingSync.has(msg.id)) {
        this.pendingSync.set(msg.id, {
          ...msg,
          syncStatus: 'pending',
          retryCount: 0,
        });
      }
    }
  }

  /**
   * Import messages from server (for history fetch)
   */
  async importMessages(messages: StoredMessage[]): Promise<number> {
    await this.init();
    let importedCount = 0;

    for (const msg of messages) {
      const existing = await this.getMessage(msg.id);
      if (!existing) {
        await storeMessage({ ...msg, synced: true });
        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * Get message count for a conversation
   */
  async getMessageCount(conversationId: string): Promise<number> {
    const messages = await getMessages(conversationId, 10000);
    return messages.length;
  }

  /**
   * Get unread count for a conversation
   */
  async getUnreadCount(conversationId: string): Promise<number> {
    const messages = await getMessages(conversationId, 10000);
    return messages.filter(m => !m.read).length;
  }

  /**
   * Search messages by content (requires decrypted content)
   * Note: This operates on encrypted data, so actual search needs decryption layer
   */
  async searchMessages(
    query: string,
    options?: { conversationId?: string; limit?: number }
  ): Promise<StoredMessage[]> {
    // In production, this would need a full-text search index on decrypted content
    // For now, return empty as ciphertext can't be searched
    console.log('[MessageStore] Search not available on encrypted content');
    return [];
  }

  /**
   * Clear all message data (for logout)
   */
  async clearAll(): Promise<void> {
    await clearAllData();
    this.pendingSync.clear();
    this.initialized = false;
  }
}

// Session Store Manager
class SessionStoreManager {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  /**
   * Save or update a session
   */
  async saveSession(session: StoredSession): Promise<void> {
    await this.init();
    await storeSession(session);
  }

  /**
   * Get session for a peer
   */
  async getSessionForPeer(peerId: string): Promise<StoredSession | null> {
    await this.init();
    return getSession(peerId);
  }

  /**
   * Update session activity
   */
  async updateActivity(peerId: string): Promise<void> {
    await this.init();
    const session = await this.getSessionForPeer(peerId);
    if (session) {
      await storeSession({
        ...session,
        lastActivity: Date.now(),
      });
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.init();
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readwrite');
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.delete(sessionId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<StoredSession[]> {
    await this.init();
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readonly');
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Clear all sessions
   */
  async clearAll(): Promise<void> {
    await this.init();
    const db = await initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readwrite');
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Export singleton instances
export const messageStore = new MessageStoreManager();
export const sessionStore = new SessionStoreManager();

// Convenience exports
export type { StoredMessage, StoredSession };
