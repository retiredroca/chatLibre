import { useIdentityStore } from '../stores/identityStore';

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  senderKey: string;
  timestamp: number;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  sizeOriginal: number;
  sizeEncrypted: number;
  contentHash: string;
}

export interface EncryptedFile {
  metadata: FileMetadata;
  encryptedBlob: string;
  nonce: string;
  keyNonce: string;
  keyCiphertext: string;
  senderPublicKey: string;
}

const ENCRYPTION_CONTEXT = 'chatlibre-message-encryption-v1';
const FILE_KEY_CONTEXT = 'chatlibre-file-encryption-v1';
const PBKDF2_ITERATIONS = 100000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveSymmetricKey(
  sharedSecret: ArrayBuffer,
  context: string,
  keyLength: number = 32
): Promise<CryptoKey> {
  const contextBytes = new TextEncoder().encode(context);
  const keyData = new Uint8Array([
    ...new Uint8Array(sharedSecret),
    ...contextBytes
  ]);
  
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  
  return crypto.subtle.importKey(
    'raw',
    hash.slice(0, keyLength),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function performECDHKeyExchange(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  
  return deriveSymmetricKey(sharedSecret, ENCRYPTION_CONTEXT);
}

function generateSecureId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

class CryptoService {
  async encryptMessage(plaintext: string, recipientPublicKeyBase64: string): Promise<EncryptedPayload> {
    const identity = useIdentityStore.getState();
    if (!identity.keyPair) {
      throw new Error('No identity available');
    }

    const senderPublicKey = await crypto.subtle.exportKey('raw', identity.keyPair.publicKey);
    const recipientPublicKeyBytes = base64ToArrayBuffer(recipientPublicKeyBase64);
    const recipientPublicKey = await crypto.subtle.importKey(
      'raw',
      recipientPublicKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const symmetricKey = await performECDHKeyExchange(identity.keyPair.privateKey, recipientPublicKey);

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const nonce = generateNonce();
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      symmetricKey,
      data
    );

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      nonce: arrayBufferToBase64(nonce.buffer),
      senderKey: arrayBufferToBase64(senderPublicKey),
      timestamp: Date.now(),
    };
  }

  async decryptMessage(encrypted: EncryptedPayload): Promise<string> {
    try {
      const identity = useIdentityStore.getState();
      if (!identity.keyPair) {
        throw new Error('No identity available');
      }

      const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
      const nonce = base64ToArrayBuffer(encrypted.nonce);
      const senderPublicKeyBytes = base64ToArrayBuffer(encrypted.senderKey);

      const senderPublicKey = await crypto.subtle.importKey(
        'raw',
        senderPublicKeyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );

      const symmetricKey = await performECDHKeyExchange(identity.keyPair.privateKey, senderPublicKey);

      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        symmetricKey,
        ciphertext
      );
      
      return new TextDecoder().decode(plaintext);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Unable to decrypt message]';
    }
  }

  async encryptFile(
    fileData: ArrayBuffer,
    fileName: string,
    mimeType: string,
    recipientPublicKey: CryptoKey
  ): Promise<EncryptedFile> {
    const identity = useIdentityStore.getState();
    if (!identity.keyPair) {
      throw new Error('No identity available');
    }

    const fileKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const nonce = generateNonce();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      fileKey,
      fileData
    );

    const exportedFileKey = await crypto.subtle.exportKey('raw', fileKey);
    const keyNonce = generateNonce();
    
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: recipientPublicKey },
      identity.keyPair.privateKey,
      256
    );
    const sharedKey = await deriveSymmetricKey(sharedSecret, FILE_KEY_CONTEXT);
    
    const keyCiphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: keyNonce },
      sharedKey,
      exportedFileKey
    );

    const exportedSenderKey = await crypto.subtle.exportKey('raw', identity.keyPair.publicKey);

    const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);

    return {
      metadata: {
        originalName: fileName,
        mimeType,
        sizeOriginal: fileData.byteLength,
        sizeEncrypted: ciphertext.byteLength,
        contentHash: arrayBufferToBase64(hashBuffer),
      },
      encryptedBlob: arrayBufferToBase64(ciphertext),
      nonce: arrayBufferToBase64(nonce.buffer),
      keyNonce: arrayBufferToBase64(keyNonce.buffer),
      keyCiphertext: arrayBufferToBase64(keyCiphertext),
      senderPublicKey: arrayBufferToBase64(exportedSenderKey),
    };
  }

  async decryptFile(encryptedFile: EncryptedFile): Promise<ArrayBuffer> {
    const identity = useIdentityStore.getState();
    if (!identity.keyPair) {
      throw new Error('No identity available');
    }

    const senderPublicKeyBytes = base64ToArrayBuffer(encryptedFile.senderPublicKey);
    const senderPublicKey = await crypto.subtle.importKey(
      'raw',
      senderPublicKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const ciphertext = base64ToArrayBuffer(encryptedFile.encryptedBlob);
    const fileNonce = base64ToArrayBuffer(encryptedFile.nonce);
    const keyNonce = base64ToArrayBuffer(encryptedFile.keyNonce);
    const keyCiphertext = base64ToArrayBuffer(encryptedFile.keyCiphertext);

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: senderPublicKey },
      identity.keyPair.privateKey,
      256
    );
    const sharedKey = await deriveSymmetricKey(sharedSecret, FILE_KEY_CONTEXT);
    
    const exportedKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: keyNonce },
      sharedKey,
      keyCiphertext
    );

    const fileKey = await crypto.subtle.importKey(
      'raw',
      exportedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fileNonce },
      fileKey,
      ciphertext
    );
  }

  generateMessageId(): string {
    return `${Date.now()}-${generateSecureId()}`;
  }
}

export const cryptoService = new CryptoService();
