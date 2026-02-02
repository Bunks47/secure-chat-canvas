// AES-256-GCM Authenticated Encryption
// Fixed implementation with proper IV handling and TypeScript types

import { IV_LENGTH } from './constants';
import { arrayBufferToBase64, base64ToArrayBuffer, generateRandomBytes, concatUint8Arrays } from './utils';

export interface EncryptedMessage {
  ciphertext: string; // Base64 encoded (IV + ciphertext + auth tag)
  timestamp: number;
}

export interface DecryptedMessage {
  plaintext: string;
  timestamp: number;
}

/**
 * Encrypt a message using AES-256-GCM
 * The IV is prepended to the ciphertext for transport
 */
export async function encryptMessage(
  sessionKey: CryptoKey,
  plaintext: string,
  additionalData?: Uint8Array
): Promise<EncryptedMessage> {
  // Generate a random 12-byte IV for each message
  const iv = generateRandomBytes(IV_LENGTH);
  
  // Encode the plaintext
  const plaintextBytes = new TextEncoder().encode(plaintext);
  
  // Encrypt with AES-GCM
  const encryptParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as BufferSource,
    tagLength: 128, // 128-bit auth tag
  };

  // Add additional authenticated data if provided
  if (additionalData) {
    encryptParams.additionalData = additionalData as BufferSource;
  }

  const ciphertextBuffer = await crypto.subtle.encrypt(
    encryptParams,
    sessionKey,
    plaintextBytes
  );

  // Prepend IV to ciphertext (IV || ciphertext || auth tag)
  const combined = concatUint8Arrays(iv, new Uint8Array(ciphertextBuffer));

  return {
    ciphertext: arrayBufferToBase64(combined.buffer as ArrayBuffer),
    timestamp: Date.now(),
  };
}

/**
 * Decrypt a message using AES-256-GCM
 * Extracts the IV from the beginning of the ciphertext
 */
export async function decryptMessage(
  sessionKey: CryptoKey,
  encryptedMessage: EncryptedMessage,
  additionalData?: Uint8Array
): Promise<DecryptedMessage> {
  // Decode the combined ciphertext
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedMessage.ciphertext));
  
  // Extract IV (first 12 bytes) and actual ciphertext (rest)
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt with AES-GCM
  const decryptParams: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as BufferSource,
    tagLength: 128,
  };

  if (additionalData) {
    decryptParams.additionalData = additionalData as BufferSource;
  }

  const plaintextBuffer = await crypto.subtle.decrypt(
    decryptParams,
    sessionKey,
    ciphertext
  );

  return {
    plaintext: new TextDecoder().decode(plaintextBuffer),
    timestamp: encryptedMessage.timestamp,
  };
}

/**
 * Encrypt binary data (for file attachments)
 */
export async function encryptBinaryData(
  sessionKey: CryptoKey,
  data: ArrayBuffer
): Promise<ArrayBuffer> {
  const iv = generateRandomBytes(IV_LENGTH);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
    sessionKey,
    data
  );

  const combined = concatUint8Arrays(iv, new Uint8Array(ciphertext));
  return combined.buffer as ArrayBuffer;
}

/**
 * Decrypt binary data
 */
export async function decryptBinaryData(
  sessionKey: CryptoKey,
  encryptedData: ArrayBuffer
): Promise<ArrayBuffer> {
  const combined = new Uint8Array(encryptedData);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
    sessionKey,
    ciphertext
  );
}

/**
 * Create additional authenticated data for a message
 * This binds the ciphertext to metadata without encrypting it
 */
export function createAAD(
  senderId: string,
  recipientId: string,
  timestamp: number
): Uint8Array {
  const data = `${senderId}:${recipientId}:${timestamp}`;
  return new TextEncoder().encode(data);
}
