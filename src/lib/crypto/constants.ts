// Cryptographic constants for E2EE messaging

// Key derivation parameters
export const PBKDF2_ITERATIONS = 310000; // OWASP recommendation for SHA-256
export const SALT_LENGTH = 32;
export const IV_LENGTH = 12; // AES-GCM recommended IV length

// Key sizes in bytes
export const KEY_SIZE = 32; // 256 bits for AES-256
export const X25519_KEY_SIZE = 32;

// HKDF parameters
export const HKDF_INFO = new TextEncoder().encode('chit-chat-e2ee-v1');

// IndexedDB
export const DB_NAME = 'chit-chat-crypto';
export const DB_VERSION = 1;
export const KEY_STORE = 'keys';
export const MESSAGE_STORE = 'messages';
export const SESSION_STORE = 'sessions';
