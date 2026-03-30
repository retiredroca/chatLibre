export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  senderKey: string;
  timestamp: number;
}

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface RatchetState {
  rootKey: CryptoKey;
  chainKey: CryptoKey;
  messageNumber: number;
  senderKeyPair: KeyPair;
  recipientRatchetKey: CryptoKey;
}

const ALGORITHM = { name: 'AES-GCM', length: 256 };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(masterKey: CryptoKey, info: string): Promise<CryptoKey> {
  const material = await crypto.subtle.exportKey('raw', masterKey);
  const keyData = new Uint8Array([...new Uint8Array(material), ...new TextEncoder().encode(info)]);
  return crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', keyData),
    ALGORITHM,
    true,
    ['encrypt', 'decrypt']
  );
}

async function performKeyAgreement(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
}

export class E2EECryptoService {
  private ratchetStates: Map<string, RatchetState> = new Map();
  
  async generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
  }

  async generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
  }

  async performX3DH(
    selfPrivateKey: CryptoKey,
    selfPublicKey: CryptoKey,
    recipientIdentityKey: CryptoKey,
    recipientSignedPreKey?: CryptoKey,
    recipientOneTimePreKey?: CryptoKey
  ): Promise<CryptoKey> {
    const dh1 = await performKeyAgreement(selfPrivateKey, recipientIdentityKey);
    
    let sharedSecret = new Uint8Array(dh1);
    
    if (recipientSignedPreKey) {
      const dh2 = await performKeyAgreement(selfPrivateKey, recipientSignedPreKey);
      sharedSecret = new Uint8Array([...sharedSecret, ...new Uint8Array(dh2)]);
    }
    
    if (recipientOneTimePreKey) {
      const dh3 = await performKeyAgreement(selfPrivateKey, recipientOneTimePreKey);
      sharedSecret = new Uint8Array([...sharedSecret, ...new Uint8Array(dh3)]);
    }
    
    const dh4 = await performKeyAgreement(selfPublicKey, recipientIdentityKey);
    sharedSecret = new Uint8Array([...sharedSecret, ...new Uint8Array(dh4)]);
    
    const keyData = await crypto.subtle.digest('SHA-256', sharedSecret);
    
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async initializeRatchet(
    recipientPublicKey: string,
    sharedSecret: CryptoKey
  ): Promise<void> {
    const recipientKey = await crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(recipientPublicKey),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const rootKey = sharedSecret;
    const chainKey = await deriveKey(rootKey, 'chain');

    this.ratchetStates.set(recipientPublicKey, {
      rootKey,
      chainKey,
      messageNumber: 0,
      senderKeyPair: await this.generateIdentityKeyPair(),
      recipientRatchetKey: recipientKey,
    });
  }

  async encryptMessage(plaintext: string, recipientPublicKey: string): Promise<EncryptedPayload> {
    let state = this.ratchetStates.get(recipientPublicKey);
    
    if (!state) {
      const defaultKey = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
      );
      const fakeShared = await crypto.subtle.exportKey('raw', defaultKey.publicKey);
      const sharedSecret = await crypto.subtle.importKey(
        'raw',
        fakeShared,
        ALGORITHM,
        true,
        ['encrypt', 'decrypt']
      );
      await this.initializeRatchet(recipientPublicKey, sharedSecret);
      state = this.ratchetStates.get(recipientPublicKey)!;
    }

    const chainKeyMaterial = await crypto.subtle.exportKey('raw', state.chainKey);
    const chainKeyInfo = new Uint8Array([...new Uint8Array(chainKeyMaterial), 0x01]);
    const messageKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', chainKeyInfo),
      ALGORITHM,
      true,
      ['encrypt']
    );

    const chainKeyInfoForNext = new Uint8Array([...new Uint8Array(chainKeyMaterial), 0x02]);
    state.chainKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', chainKeyInfoForNext),
      ALGORITHM,
      true,
      ['encrypt', 'decrypt']
    );

    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      messageKey,
      data
    );

    state.messageNumber++;

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      nonce: arrayBufferToBase64(nonce.buffer),
      senderKey: arrayBufferToBase64(await this.exportPublicKey(state.senderKeyPair.publicKey)),
      timestamp: Date.now(),
    };
  }

  async decryptMessage(
    encrypted: EncryptedPayload,
    senderPublicKey: string
  ): Promise<string> {
    const state = this.ratchetStates.get(senderPublicKey);
    
    if (!state) {
      throw new Error('No ratchet state found for sender');
    }

    const chainKeyMaterial = await crypto.subtle.exportKey('raw', state.chainKey);
    const chainKeyInfo = new Uint8Array([...new Uint8Array(chainKeyMaterial), 0x01]);
    const messageKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', chainKeyInfo),
      ALGORITHM,
      true,
      ['decrypt']
    );

    const chainKeyInfoForNext = new Uint8Array([...new Uint8Array(chainKeyMaterial), 0x02]);
    state.chainKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', chainKeyInfoForNext),
      ALGORITHM,
      true,
      ['encrypt', 'decrypt']
    );

    const nonce = new Uint8Array(base64ToArrayBuffer(encrypted.nonce));
    const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      messageKey,
      ciphertext
    );

    state.messageNumber++;

    return new TextDecoder().decode(plaintext);
  }

  async exportPublicKey(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey('raw', key);
  }

  async importPublicKey(keyData: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(keyData),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
  }

  generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const e2eeService = new E2EECryptoService();
