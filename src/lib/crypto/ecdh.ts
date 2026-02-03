// ECDH Key Exchange and HKDF Key Derivation

import { HKDF_INFO, KEY_SIZE } from './constants';
import type { KeyPair } from './keys';

/**
 * Perform ECDH key agreement to derive a shared secret
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    256 // 256 bits = 32 bytes
  );
}

/**
 * Derive a session key from shared secret using HKDF
 */
export async function deriveSessionKey(
  sharedSecret: ArrayBuffer,
  salt?: Uint8Array,
  info: Uint8Array = HKDF_INFO
): Promise<CryptoKey> {
  // Import the shared secret as HKDF key material
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Use empty salt if not provided (not ideal, but valid)
  const hkdfSalt = salt ? (salt.buffer as ArrayBuffer) : new ArrayBuffer(KEY_SIZE);

  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: hkdfSalt,
      info: info.buffer as ArrayBuffer,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable for testing
    ['encrypt', 'decrypt']
  );
}

/**
 * Perform full key exchange between two parties
 * Returns the derived session key
 */
export async function performKeyExchange(
  myKeyPair: KeyPair,
  theirPublicKey: CryptoKey,
  salt?: Uint8Array
): Promise<CryptoKey> {
  const sharedSecret = await deriveSharedSecret(myKeyPair.privateKey, theirPublicKey);
  return deriveSessionKey(sharedSecret, salt);
}

/**
 * Derive session keys for bidirectional communication
 * Returns separate keys for sending and receiving
 */
export async function deriveBidirectionalKeys(
  myKeyPair: KeyPair,
  theirPublicKey: CryptoKey,
  myFingerprint: string,
  theirFingerprint: string
): Promise<{ sendKey: CryptoKey; receiveKey: CryptoKey }> {
  const sharedSecret = await deriveSharedSecret(myKeyPair.privateKey, theirPublicKey);
  
  // Determine key order based on fingerprint comparison
  // This ensures both parties derive keys in the same order
  const iAmLower = myFingerprint < theirFingerprint;
  
  const info1 = new TextEncoder().encode('chit-chat-session-key-1');
  const info2 = new TextEncoder().encode('chit-chat-session-key-2');

  const key1 = await deriveSessionKey(sharedSecret, undefined, info1);
  const key2 = await deriveSessionKey(sharedSecret, undefined, info2);

  return {
    sendKey: iAmLower ? key1 : key2,
    receiveKey: iAmLower ? key2 : key1,
  };
}
