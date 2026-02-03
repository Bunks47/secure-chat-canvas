// X25519 Key Generation and Management
// Using WebCrypto API for ECDH with P-256 (X25519 not directly available in WebCrypto)
// In production, consider using libsodium-wrappers for true X25519 support

import { SALT_LENGTH, PBKDF2_ITERATIONS } from './constants';
import { arrayBufferToBase64, base64ToArrayBuffer, generateRandomBytes, generateFingerprint } from './utils';

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyRaw: ArrayBuffer;
  fingerprint: string;
}

export interface ExportedKeyPair {
  publicKey: string; // Base64 encoded
  privateKey: string; // Base64 encoded JWK
  fingerprint: string;
}

export interface EncryptedKeyBackup {
  encryptedPrivateKey: string; // Base64
  salt: string; // Base64
  iv: string; // Base64
  publicKey: string; // Base64
  fingerprint: string;
}

/**
 * Generate a new ECDH key pair for identity
 */
export async function generateIdentityKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256', // Using P-256 as WebCrypto doesn't support X25519 directly
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const fingerprint = generateFingerprint(publicKeyRaw);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyRaw,
    fingerprint,
  };
}

/**
 * Export key pair to portable format
 */
export async function exportKeyPair(keyPair: KeyPair): Promise<ExportedKeyPair> {
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicKeyRaw),
    privateKey: JSON.stringify(privateKeyJwk),
    fingerprint: keyPair.fingerprint,
  };
}

/**
 * Import key pair from portable format
 */
export async function importKeyPair(exported: ExportedKeyPair): Promise<KeyPair> {
  const publicKeyRaw = base64ToArrayBuffer(exported.publicKey);
  const privateKeyJwk = JSON.parse(exported.privateKey);

  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  return {
    publicKey,
    privateKey,
    publicKeyRaw,
    fingerprint: exported.fingerprint,
  };
}

/**
 * Import a public key from Base64
 */
export async function importPublicKey(base64PublicKey: string): Promise<CryptoKey> {
  const publicKeyRaw = base64ToArrayBuffer(base64PublicKey);
  
  return crypto.subtle.importKey(
    'raw',
    publicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * Derive a password-based key for encrypting the private key backup
 */
async function derivePasswordKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordBuffer = new TextEncoder().encode(password);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Create a password-protected backup of the private key
 */
export async function createKeyBackup(
  keyPair: KeyPair,
  password: string
): Promise<EncryptedKeyBackup> {
  const salt = generateRandomBytes(SALT_LENGTH);
  const iv = generateRandomBytes(12);
  
  const passwordKey = await derivePasswordKey(password, salt);
  
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const privateKeyData = new TextEncoder().encode(JSON.stringify(privateKeyJwk));

  const encryptedPrivateKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    passwordKey,
    privateKeyData
  );

  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);

  return {
    encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    publicKey: arrayBufferToBase64(publicKeyRaw),
    fingerprint: keyPair.fingerprint,
  };
}

/**
 * Restore a key pair from an encrypted backup
 */
export async function restoreKeyFromBackup(
  backup: EncryptedKeyBackup,
  password: string
): Promise<KeyPair> {
  const salt = new Uint8Array(base64ToArrayBuffer(backup.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(backup.iv));
  const encryptedPrivateKey = base64ToArrayBuffer(backup.encryptedPrivateKey);
  
  const passwordKey = await derivePasswordKey(password, salt);

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    passwordKey,
    encryptedPrivateKey
  );

  const privateKeyJwk = JSON.parse(new TextDecoder().decode(decryptedData));

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKeyRaw = base64ToArrayBuffer(backup.publicKey);
  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  return {
    publicKey,
    privateKey,
    publicKeyRaw,
    fingerprint: backup.fingerprint,
  };
}
