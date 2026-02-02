// IndexedDB Encrypted Storage for Keys and Messages

import { DB_NAME, DB_VERSION, KEY_STORE, MESSAGE_STORE, SESSION_STORE } from '../crypto/constants';

export interface StoredKeyPair {
  id: string;
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  fingerprint: string;
  createdAt: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  timestamp: number;
  synced: boolean;
  read: boolean;
}

export interface StoredSession {
  id: string;
  peerId: string;
  peerPublicKey: string;
  peerFingerprint: string;
  createdAt: number;
  lastActivity: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Keys store
      if (!database.objectStoreNames.contains(KEY_STORE)) {
        const keyStore = database.createObjectStore(KEY_STORE, { keyPath: 'id' });
        keyStore.createIndex('fingerprint', 'fingerprint', { unique: true });
      }

      // Messages store
      if (!database.objectStoreNames.contains(MESSAGE_STORE)) {
        const messageStore = database.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
        messageStore.createIndex('conversationId', 'conversationId', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        messageStore.createIndex('synced', 'synced', { unique: false });
      }

      // Sessions store
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        const sessionStore = database.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        sessionStore.createIndex('peerId', 'peerId', { unique: false });
      }
    };
  });
}

/**
 * Store an encrypted key pair
 */
export async function storeKeyPair(keyPair: StoredKeyPair): Promise<void> {
  const database = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readwrite');
    const store = transaction.objectStore(KEY_STORE);
    const request = store.put(keyPair);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get the stored key pair
 */
export async function getKeyPair(id: string = 'identity'): Promise<StoredKeyPair | null> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readonly');
    const store = transaction.objectStore(KEY_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Delete the stored key pair
 */
export async function deleteKeyPair(id: string = 'identity'): Promise<void> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readwrite');
    const store = transaction.objectStore(KEY_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Store a message
 */
export async function storeMessage(message: StoredMessage): Promise<void> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MESSAGE_STORE, 'readwrite');
    const store = transaction.objectStore(MESSAGE_STORE);
    const request = store.put(message);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  beforeTimestamp?: number
): Promise<StoredMessage[]> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MESSAGE_STORE, 'readonly');
    const store = transaction.objectStore(MESSAGE_STORE);
    const index = store.index('conversationId');
    const request = index.getAll(IDBKeyRange.only(conversationId));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      let messages = request.result as StoredMessage[];
      
      // Filter by timestamp if provided
      if (beforeTimestamp) {
        messages = messages.filter(m => m.timestamp < beforeTimestamp);
      }
      
      // Sort by timestamp descending and limit
      messages.sort((a, b) => b.timestamp - a.timestamp);
      resolve(messages.slice(0, limit));
    };
  });
}

/**
 * Get unsynced messages
 */
export async function getUnsyncedMessages(): Promise<StoredMessage[]> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MESSAGE_STORE, 'readonly');
    const store = transaction.objectStore(MESSAGE_STORE);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Mark message as synced
 */
export async function markMessageSynced(id: string): Promise<void> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MESSAGE_STORE, 'readwrite');
    const store = transaction.objectStore(MESSAGE_STORE);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const message = getRequest.result;
        message.synced = true;
        const putRequest = store.put(message);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
}

/**
 * Store a session
 */
export async function storeSession(session: StoredSession): Promise<void> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE, 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.put(session);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get session for a peer
 */
export async function getSession(peerId: string): Promise<StoredSession | null> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE, 'readonly');
    const store = transaction.objectStore(SESSION_STORE);
    const index = store.index('peerId');
    const request = index.get(peerId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Clear all data (for logout)
 */
export async function clearAllData(): Promise<void> {
  const database = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [KEY_STORE, MESSAGE_STORE, SESSION_STORE],
      'readwrite'
    );

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    transaction.objectStore(KEY_STORE).clear();
    transaction.objectStore(MESSAGE_STORE).clear();
    transaction.objectStore(SESSION_STORE).clear();
  });
}
