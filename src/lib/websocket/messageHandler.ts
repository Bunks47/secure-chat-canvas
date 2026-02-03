// WebSocket Message Handler with E2E Encryption
// Implements Phase 4: Real-Time Communication Layer

import { WebSocketClient, type WebSocketMessage, type ConnectionState } from './client';
import { 
  establishSecureSession, 
  encryptSessionMessage, 
  decryptSessionMessage,
  type SecureSession,
  type SecureMessagePayload,
  type KeyPair,
} from '@/lib/crypto';
import { messageStore, sessionStore, type StoredMessage } from '@/lib/storage/messageStore';
import type { Message, TypingIndicator, PresenceUpdate } from '@/lib/chat/types';

// Protocol message types
export type ProtocolMessageType = 
  | 'message'           // Encrypted chat message
  | 'message_ack'       // Message delivery acknowledgment
  | 'typing'            // Typing indicator
  | 'presence'          // Presence update
  | 'key_request'       // Request peer's public key
  | 'key_response'      // Response with public key
  | 'session_init'      // Initialize secure session
  | 'read_receipt'      // Read receipt
  | 'sync_request'      // Request message history
  | 'sync_response';    // History sync response

export interface ProtocolMessage<T = unknown> {
  type: ProtocolMessageType;
  payload: T;
  timestamp: number;
  messageId: string;
}

// Payload interfaces
export interface EncryptedMessagePayload {
  conversationId: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  timestamp: number;
}

export interface KeyRequestPayload {
  requesterId: string;
  targetUserId: string;
}

export interface KeyResponsePayload {
  userId: string;
  publicKey: string;
  fingerprint: string;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresencePayload {
  userId: string;
  isOnline: boolean;
  lastSeen?: number;
}

export interface ReadReceiptPayload {
  conversationId: string;
  messageId: string;
  readBy: string;
  readAt: number;
}

// Event callbacks
export interface MessageHandlerCallbacks {
  onMessage?: (message: Message) => void;
  onTyping?: (indicator: TypingIndicator) => void;
  onPresence?: (update: PresenceUpdate) => void;
  onReadReceipt?: (conversationId: string, messageId: string) => void;
  onConnectionChange?: (state: ConnectionState) => void;
  onSessionEstablished?: (peerId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket Message Handler
 * Manages encrypted message flow and session establishment
 */
export class MessageHandler {
  private client: WebSocketClient;
  private myKeyPair: KeyPair | null = null;
  private myUserId: string = '';
  private sessions: Map<string, SecureSession> = new Map();
  private pendingKeyRequests: Map<string, (key: KeyResponsePayload) => void> = new Map();
  private callbacks: MessageHandlerCallbacks = {};
  private unsubscribes: (() => void)[] = [];

  constructor(client: WebSocketClient) {
    this.client = client;
    this.setupHandlers();
  }

  /**
   * Initialize with user identity
   */
  async initialize(userId: string, keyPair: KeyPair): Promise<void> {
    this.myUserId = userId;
    this.myKeyPair = keyPair;

    // Load existing sessions from storage
    const storedSessions = await sessionStore.getAllSessions();
    for (const session of storedSessions) {
      // Sessions will be re-established on demand
      console.log(`[MessageHandler] Found stored session with ${session.peerId}`);
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: MessageHandlerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Set up WebSocket message handlers
   */
  private setupHandlers(): void {
    // Handle encrypted messages
    this.unsubscribes.push(
      this.client.on('message', async (msg) => {
        await this.handleEncryptedMessage(msg.payload as EncryptedMessagePayload);
      })
    );

    // Handle key requests
    this.unsubscribes.push(
      this.client.on('key_request', async (msg) => {
        await this.handleKeyRequest(msg.payload as KeyRequestPayload);
      })
    );

    // Handle key responses
    this.unsubscribes.push(
      this.client.on('key_response', (msg) => {
        this.handleKeyResponse(msg.payload as KeyResponsePayload);
      })
    );

    // Handle typing indicators
    this.unsubscribes.push(
      this.client.on('typing', (msg) => {
        const payload = msg.payload as TypingPayload;
        this.callbacks.onTyping?.({
          conversationId: payload.conversationId,
          userId: payload.userId,
          isTyping: payload.isTyping,
        });
      })
    );

    // Handle presence updates
    this.unsubscribes.push(
      this.client.on('presence', (msg) => {
        const payload = msg.payload as PresencePayload;
        this.callbacks.onPresence?.({
          userId: payload.userId,
          isOnline: payload.isOnline,
          lastSeen: payload.lastSeen,
        });
      })
    );

    // Handle read receipts
    this.unsubscribes.push(
      this.client.on('read_receipt', async (msg) => {
        const payload = msg.payload as ReadReceiptPayload;
        await messageStore.markAsRead(payload.messageId);
        this.callbacks.onReadReceipt?.(payload.conversationId, payload.messageId);
      })
    );

    // Handle connection changes
    this.unsubscribes.push(
      this.client.onConnectionChange((state) => {
        this.callbacks.onConnectionChange?.(state);
        
        if (state === 'connected') {
          this.syncPendingMessages();
        }
      })
    );
  }

  /**
   * Send an encrypted message
   */
  async sendMessage(
    recipientId: string,
    conversationId: string,
    content: string,
    recipientPublicKey: string,
    recipientFingerprint: string
  ): Promise<Message> {
    if (!this.myKeyPair || !this.myUserId) {
      throw new Error('Handler not initialized');
    }

    // Get or establish session
    let session = this.sessions.get(recipientId);
    if (!session) {
      session = await this.establishSession(recipientId, recipientPublicKey, recipientFingerprint);
    }

    // Create message
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timestamp = Date.now();

    // Encrypt message
    const encrypted = await encryptSessionMessage(
      session,
      this.myUserId,
      recipientId,
      content
    );

    // Store locally
    const storedMessage = await messageStore.saveMessage({
      id: messageId,
      conversationId,
      senderId: this.myUserId,
      recipientId,
      ciphertext: encrypted.encrypted.ciphertext,
      timestamp,
    });

    // Send via WebSocket
    const payload: EncryptedMessagePayload = {
      conversationId,
      senderId: this.myUserId,
      recipientId,
      ciphertext: encrypted.encrypted.ciphertext,
      timestamp,
    };

    const sent = this.client.send('message', payload);

    // Return message object
    const message: Message = {
      id: messageId,
      conversationId,
      senderId: this.myUserId,
      content,
      timestamp,
      status: sent ? 'sent' : 'sending',
      isEncrypted: true,
    };

    return message;
  }

  /**
   * Handle incoming encrypted message
   */
  private async handleEncryptedMessage(payload: EncryptedMessagePayload): Promise<void> {
    try {
      const session = this.sessions.get(payload.senderId);
      
      if (!session) {
        // Request key and queue message for later decryption
        console.log('[MessageHandler] No session for sender, requesting key');
        await this.requestPublicKey(payload.senderId);
        // Store encrypted message for later
        await messageStore.saveMessage({
          id: `msg-${Date.now()}`,
          conversationId: payload.conversationId,
          senderId: payload.senderId,
          recipientId: this.myUserId,
          ciphertext: payload.ciphertext,
          timestamp: payload.timestamp,
        });
        return;
      }

      // Decrypt message
      const decrypted = await decryptSessionMessage(session, {
        sessionId: session.sessionId,
        senderId: payload.senderId,
        recipientId: this.myUserId,
        encrypted: {
          ciphertext: payload.ciphertext,
          timestamp: payload.timestamp,
        },
      });

      // Create message object
      const message: Message = {
        id: `msg-${payload.timestamp}`,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: decrypted.plaintext,
        timestamp: payload.timestamp,
        status: 'delivered',
        isEncrypted: true,
      };

      // Store decrypted reference locally
      await messageStore.saveMessage({
        id: message.id,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        recipientId: this.myUserId,
        ciphertext: payload.ciphertext,
        timestamp: payload.timestamp,
      });

      // Notify callback
      this.callbacks.onMessage?.(message);

      // Send delivery acknowledgment
      this.client.send('message_ack', {
        messageId: message.id,
        conversationId: payload.conversationId,
        status: 'delivered',
      });
    } catch (error) {
      console.error('[MessageHandler] Failed to decrypt message:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error('Decryption failed'));
    }
  }

  /**
   * Establish secure session with a peer
   */
  private async establishSession(
    peerId: string,
    publicKey: string,
    fingerprint: string
  ): Promise<SecureSession> {
    if (!this.myKeyPair) {
      throw new Error('No key pair available');
    }

    const session = await establishSecureSession(
      this.myKeyPair,
      publicKey,
      fingerprint
    );

    this.sessions.set(peerId, session);

    // Store session
    await sessionStore.saveSession({
      id: session.sessionId,
      peerId,
      peerPublicKey: publicKey,
      peerFingerprint: fingerprint,
      createdAt: session.createdAt,
      lastActivity: Date.now(),
    });

    this.callbacks.onSessionEstablished?.(peerId);
    return session;
  }

  /**
   * Request peer's public key
   */
  private async requestPublicKey(userId: string): Promise<KeyResponsePayload> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingKeyRequests.delete(userId);
        reject(new Error('Key request timeout'));
      }, 10000);

      this.pendingKeyRequests.set(userId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.client.send('key_request', {
        requesterId: this.myUserId,
        targetUserId: userId,
      });
    });
  }

  /**
   * Handle incoming key request
   */
  private async handleKeyRequest(payload: KeyRequestPayload): Promise<void> {
    if (!this.myKeyPair || payload.targetUserId !== this.myUserId) return;

    const { arrayBufferToBase64 } = await import('@/lib/crypto/utils');
    
    this.client.send('key_response', {
      userId: this.myUserId,
      publicKey: arrayBufferToBase64(this.myKeyPair.publicKeyRaw),
      fingerprint: this.myKeyPair.fingerprint,
    });
  }

  /**
   * Handle key response
   */
  private handleKeyResponse(payload: KeyResponsePayload): void {
    const resolver = this.pendingKeyRequests.get(payload.userId);
    if (resolver) {
      resolver(payload);
      this.pendingKeyRequests.delete(payload.userId);
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId: string, isTyping: boolean): void {
    this.client.send('typing', {
      conversationId,
      userId: this.myUserId,
      isTyping,
    });
  }

  /**
   * Send read receipt
   */
  sendReadReceipt(conversationId: string, messageId: string): void {
    this.client.send('read_receipt', {
      conversationId,
      messageId,
      readBy: this.myUserId,
      readAt: Date.now(),
    });
  }

  /**
   * Sync pending messages when reconnected
   */
  private async syncPendingMessages(): Promise<void> {
    const unsynced = await messageStore.getUnsynced();
    console.log(`[MessageHandler] Syncing ${unsynced.length} pending messages`);

    for (const msg of unsynced) {
      // Re-send unsynced messages
      const sent = this.client.send('message', {
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        ciphertext: msg.ciphertext,
        timestamp: msg.timestamp,
      });

      if (sent) {
        await messageStore.markSynced(msg.id);
      }
    }
  }

  /**
   * Get or create session for a peer
   */
  async getOrCreateSession(
    peerId: string,
    publicKey: string,
    fingerprint: string
  ): Promise<SecureSession> {
    let session = this.sessions.get(peerId);
    if (!session) {
      session = await this.establishSession(peerId, publicKey, fingerprint);
    }
    return session;
  }

  /**
   * Check if session exists for peer
   */
  hasSession(peerId: string): boolean {
    return this.sessions.has(peerId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
    this.sessions.clear();
    this.pendingKeyRequests.clear();
    this.myKeyPair = null;
    this.myUserId = '';
  }
}

/**
 * Create a configured message handler
 */
export function createMessageHandler(wsUrl: string, token: string): {
  client: WebSocketClient;
  handler: MessageHandler;
} {
  const client = new WebSocketClient({
    url: wsUrl,
    token,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
  });

  const handler = new MessageHandler(client);

  return { client, handler };
}
