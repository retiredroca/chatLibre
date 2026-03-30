import { useIdentityStore } from '../stores/identityStore';

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
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
    };
  }

  async decryptMessage(_encrypted: EncryptedPayload, _senderPublicKey: string): Promise<string> {
    return 'decrypted_message_placeholder';
  }

  generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const cryptoService = new CryptoService();
