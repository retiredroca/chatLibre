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
  keyNonce: string;
  keyCiphertext: string;
}

class CryptoService {
  async encryptMessage(plaintext: string, _recipientPublicKey: string): Promise<EncryptedPayload> {
    const identity = useIdentityStore.getState();
    if (!identity.publicKey) {
      throw new Error('No identity available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      data
    );

    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      nonce: btoa(String.fromCharCode(...nonce)),
      senderKey: identity.publicKey,
      timestamp: Date.now(),
    };
  }

  async decryptMessage(encrypted: EncryptedPayload, _senderPublicKey: string): Promise<string> {
    try {
      const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));
      const nonce = Uint8Array.from(atob(encrypted.nonce), c => c.charCodeAt(0));
      
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['decrypt']
      );
      
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        ciphertext
      );
      
      return new TextDecoder().decode(plaintext);
    } catch {
      return '[Unable to decrypt message]';
    }
  }

  async encryptFile(fileData: ArrayBuffer, fileName: string, mimeType: string): Promise<EncryptedFile> {
    const fileKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      fileKey,
      fileData
    );

    const exportedKey = await crypto.subtle.exportKey('raw', fileKey);
    const keyNonce = crypto.getRandomValues(new Uint8Array(12));
    const masterKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32).fill(0),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const keyCiphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: keyNonce },
      masterKey,
      exportedKey
    );

    const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);

    return {
      metadata: {
        originalName: fileName,
        mimeType,
        sizeOriginal: fileData.byteLength,
        sizeEncrypted: ciphertext.byteLength,
        contentHash: btoa(String.fromCharCode(...new Uint8Array(hashBuffer))),
      },
      encryptedBlob: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      keyNonce: btoa(String.fromCharCode(...keyNonce)),
      keyCiphertext: btoa(String.fromCharCode(...new Uint8Array(keyCiphertext))),
    };
  }

  async decryptFile(encryptedFile: EncryptedFile): Promise<ArrayBuffer> {
    const ciphertext = Uint8Array.from(atob(encryptedFile.encryptedBlob), c => c.charCodeAt(0));
    const keyNonce = Uint8Array.from(atob(encryptedFile.keyNonce), c => c.charCodeAt(0));
    const keyCiphertext = Uint8Array.from(atob(encryptedFile.keyCiphertext), c => c.charCodeAt(0));

    const masterKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32).fill(0),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const exportedKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: keyNonce },
      masterKey,
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
      { name: 'AES-GCM', iv: ciphertext.slice(0, 12) },
      fileKey,
      ciphertext
    );
  }

  generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const cryptoService = new CryptoService();
