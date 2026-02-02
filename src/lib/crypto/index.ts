// Main Crypto Module Export
// Complete E2EE implementation for Chit-Chat

export * from './constants';
export * from './utils';
export * from './keys';
export * from './ecdh';
export * from './aes-gcm';

// Re-export commonly used types
export type { KeyPair, ExportedKeyPair, EncryptedKeyBackup } from './keys';
export type { EncryptedMessage, DecryptedMessage } from './aes-gcm';

// High-level encryption API
import { generateIdentityKeyPair, importPublicKey, type KeyPair } from './keys';
import { performKeyExchange, deriveBidirectionalKeys } from './ecdh';
import { encryptMessage, decryptMessage, createAAD } from './aes-gcm';
import type { EncryptedMessage, DecryptedMessage } from './aes-gcm';

export interface SecureSession {
  sessionId: string;
  sendKey: CryptoKey;
  receiveKey: CryptoKey;
  theirFingerprint: string;
  createdAt: number;
}

export interface SecureMessagePayload {
  sessionId: string;
  senderId: string;
  recipientId: string;
  encrypted: EncryptedMessage;
}

/**
 * High-level API for establishing a secure session
 */
export async function establishSecureSession(
  myKeyPair: KeyPair,
  theirPublicKeyBase64: string,
  theirFingerprint: string
): Promise<SecureSession> {
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  
  const { sendKey, receiveKey } = await deriveBidirectionalKeys(
    myKeyPair,
    theirPublicKey,
    myKeyPair.fingerprint,
    theirFingerprint
  );

  // Create a unique session ID
  const sessionId = `${myKeyPair.fingerprint}-${theirFingerprint}-${Date.now()}`;

  return {
    sessionId,
    sendKey,
    receiveKey,
    theirFingerprint,
    createdAt: Date.now(),
  };
}

/**
 * High-level API for encrypting a message in a session
 */
export async function encryptSessionMessage(
  session: SecureSession,
  senderId: string,
  recipientId: string,
  message: string
): Promise<SecureMessagePayload> {
  const timestamp = Date.now();
  const aad = createAAD(senderId, recipientId, timestamp);
  
  const encrypted = await encryptMessage(session.sendKey, message, aad);

  return {
    sessionId: session.sessionId,
    senderId,
    recipientId,
    encrypted,
  };
}

/**
 * High-level API for decrypting a message in a session
 */
export async function decryptSessionMessage(
  session: SecureSession,
  payload: SecureMessagePayload
): Promise<DecryptedMessage> {
  const aad = createAAD(
    payload.senderId,
    payload.recipientId,
    payload.encrypted.timestamp
  );

  return decryptMessage(session.receiveKey, payload.encrypted, aad);
}

/**
 * Run crypto self-test to verify implementation
 */
export async function runCryptoSelfTest(): Promise<{
  success: boolean;
  steps: { name: string; success: boolean; details?: string }[];
}> {
  const steps: { name: string; success: boolean; details?: string }[] = [];

  try {
    // Step 1: Generate Alice's identity
    const alice = await generateIdentityKeyPair();
    steps.push({
      name: "Generate Alice's identity",
      success: true,
      details: `Public key fingerprint: ${alice.fingerprint}`,
    });

    // Step 2: Generate Bob's identity
    const bob = await generateIdentityKeyPair();
    steps.push({
      name: "Generate Bob's identity",
      success: true,
      details: `Public key fingerprint: ${bob.fingerprint}`,
    });

    // Step 3: Export and import keys
    const { exportKeyPair, importKeyPair } = await import('./keys');
    const aliceExported = await exportKeyPair(alice);
    const aliceImported = await importKeyPair(aliceExported);
    steps.push({
      name: 'Key serialization round-trip',
      success: aliceImported.fingerprint === alice.fingerprint,
      details: 'Keys can be exported and imported correctly',
    });

    // Step 4: ECDH Key Exchange
    const { deriveSharedSecret } = await import('./ecdh');
    const aliceShared = await deriveSharedSecret(alice.privateKey, bob.publicKey);
    const bobShared = await deriveSharedSecret(bob.privateKey, alice.publicKey);
    
    const { arrayBufferToHex } = await import('./utils');
    const sharedMatch = arrayBufferToHex(aliceShared) === arrayBufferToHex(bobShared);
    steps.push({
      name: 'ECDH Key Exchange',
      success: sharedMatch,
      details: sharedMatch ? 'Both parties derived identical shared secret' : 'Shared secrets do not match!',
    });

    // Step 5: HKDF Session Key Derivation
    const { deriveSessionKey } = await import('./ecdh');
    const sessionKey = await deriveSessionKey(aliceShared);
    steps.push({
      name: 'HKDF Session Key Derivation',
      success: true,
      details: 'AES-256-GCM key derived successfully',
    });

    // Step 6: AES-256-GCM Encryption (THE FIX)
    const testMessage = 'Hello, this is a secret message! 🔐';
    const encrypted = await encryptMessage(sessionKey, testMessage);
    steps.push({
      name: 'AES-256-GCM Encryption',
      success: encrypted.ciphertext.length > 0,
      details: `Ciphertext length: ${encrypted.ciphertext.length} chars`,
    });

    // Step 7: AES-256-GCM Decryption
    const decrypted = await decryptMessage(sessionKey, encrypted);
    const decryptSuccess = decrypted.plaintext === testMessage;
    steps.push({
      name: 'AES-256-GCM Decryption',
      success: decryptSuccess,
      details: decryptSuccess ? 'Message decrypted correctly' : 'Decryption failed!',
    });

    // Step 8: Full session test
    const aliceSession = await establishSecureSession(
      alice,
      aliceExported.publicKey.replace(aliceExported.publicKey, await exportKeyPair(bob).then(e => e.publicKey)),
      bob.fingerprint
    );
    
    // Actually fix the session test
    const bobExported = await exportKeyPair(bob);
    const realAliceSession = await establishSecureSession(alice, bobExported.publicKey, bob.fingerprint);
    const realBobSession = await establishSecureSession(bob, aliceExported.publicKey, alice.fingerprint);

    const sessionMessage = await encryptSessionMessage(
      realAliceSession,
      'alice',
      'bob',
      'Secret session message!'
    );

    const decryptedSession = await decryptSessionMessage(realBobSession, sessionMessage);
    
    steps.push({
      name: 'Full E2EE Session Test',
      success: decryptedSession.plaintext === 'Secret session message!',
      details: 'Alice successfully sent encrypted message to Bob',
    });

    return {
      success: steps.every(s => s.success),
      steps,
    };
  } catch (error) {
    steps.push({
      name: 'Unexpected Error',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
    return { success: false, steps };
  }
}
