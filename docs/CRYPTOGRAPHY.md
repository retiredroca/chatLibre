# Cryptographic Design

## Overview

chatLibre uses a layered cryptographic approach to ensure privacy, integrity, and authenticity. This document details the cryptographic primitives and protocols used.

## Identity System

### User Identity

Every user is identified by an Ed25519 keypair:

```
Private Key: 32 bytes (random)
Public Key:  32 bytes (derived)
User ID:     "kf_" + base58(sha256(public_key))[:16]
```

The private key is the **sole credential** for the user's account. There is no password, email, or recovery mechanism (by design).

### Key Recovery

Users receive a 24-word BIP39 mnemonic that encodes their private key:

```
Entropy (256 bits) → BIP39 Mnemonic (24 words)
```

**Critical**: The mnemonic must be backed up securely. Loss of the private key means permanent loss of the account.

### Server Identity

Servers also have Ed25519 keypairs:

```
Server Identity Key: Used to sign federation messages
                    Never used for user authentication
                    Stored server-side (not secret for public key)
```

## Message Encryption

### Double Ratchet Protocol

chatLibre uses the Double Ratchet algorithm (from Signal Protocol) for message encryption:

```
┌─────────────────────────────────────────────────────────────┐
│                   DOUBLE RATCHET OVERVIEW                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Alice ──────────────────────────────── Bob                 │
│    │                                              │          │
│    │  1. Initial Key Exchange (X3DH)              │          │
│    │ ───────────────────────────────────────────► │          │
│    │                                              │          │
│    │  2. Ratcheting (Symmetric + DH)             │          │
│    │ ◄────── Encrypted Message 1 ────────────────►│          │
│    │ ──────── Encrypted Message 2 ───────────────►│          │
│    │ ◄────── Encrypted Message 3 ────────────────│          │
│    │                                              │          │
│    │  3. Forward Secrecy                          │          │
│    │     Each message uses a unique key           │          │
│    │     Compromised key doesn't expose past      │          │
│    │     or future messages                       │          │
│    │                                              │          │
└─────────────────────────────────────────────────────────────┘
```

### X3DH Initial Key Exchange

Extended Triple Diffie-Hellman for asynchronous key exchange:

```
┌─────────────────────────────────────────────────────────────┐
│                        X3DH                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Alice has:                                                 │
│    • Identity Key (IK_A) - Ed25519                         │
│    • Signed Pre-Key (SPK_A) - X25519                       │
│    • One-Time Pre-Key (OPK_A) - X25519                     │
│                                                             │
│  Bob has published to server:                               │
│    • Identity Key (IK_B)                                    │
│    • Signed Pre-Key (SPK_B)                                │
│    • One-Time Pre-Keys (OPK_B)                            │
│                                                             │
│  Shared Secret = KDF(                                       │
│    DH1 || DH2 || DH3 || DH4                                │
│  )                                                          │
│                                                             │
│  Where:                                                     │
│    DH1 = DH(IK_A, SPK_B)                                   │
│    DH2 = DH(EK_A, IK_B)                                    │
│    DH3 = DH(EK_A, SPK_B)                                   │
│    DH4 = DH(EK_A, OPK_B)  (if available)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Symmetric Ratcheting

After initial key exchange:

```
For each message:
  1. Derive message key from chain key (HKDF)
  2. Encrypt message with message key
  3. Ratchet chain key forward
  4. If DH ratchet trigger, perform DH ratchet
```

### Group Messages

For group DMs (2-10 participants):
- Each pair of participants maintains a Double Ratchet session
- Sender encrypts message N times (once per recipient)
- Storage efficient for small groups

For large groups (10+):
- Use sender keys (MLS-inspired)
- Each sender has a sender key
- Recipients maintain sender key for each member
- Trade-off: Forward secrecy per sender, not per message

## File Encryption

Files are encrypted with AES-256-GCM:

```
┌─────────────────────────────────────────────────────────────┐
│                    FILE ENCRYPTION                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Generate random 256-bit file key (FK)                  │
│  2. Encrypt file: AES-256-GCM(plaintext, nonce, FK)       │
│  3. Compute content hash: BLAKE3(encrypted_blob)          │
│  4. Encrypt FK to each recipient:                         │
│     E(recipient_public_key, FK)                           │
│  5. Upload: encrypted_blob + encrypted_FKs + metadata      │
│                                                             │
│  Server stores:                                            │
│    • encrypted_blob (unreadable)                          │
│    • metadata (type, size, hash)                          │
│    • encrypted_FKs (recipient-specific)                   │
│                                                             │
│  Client stores:                                            │
│    • FK (in message bundle)                               │
│    • Decrypted file (temporary, in memory)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Cryptographic Parameters

| Primitive | Algorithm | Parameters |
|-----------|-----------|------------|
| User Identity | Ed25519 | Curve25519 |
| Key Exchange | X25519 | ECDH on Curve25519 |
| Symmetric Encryption | ChaCha20-Poly1305 | 256-bit key, 96-bit nonce |
| File Encryption | AES-256-GCM | 256-bit key, 96-bit nonce |
| Hashing | BLAKE3 | 256-bit output |
| Key Derivation | HKDF | SHA-256 |
| Signatures | Ed25519 | - |

## Key Management

### Client-Side Keys

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT KEY STORAGE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Identity Key Pair:                                         │
│    • Private: Stored in secure storage (Keychain/Keystore) │
│    • Public: Shared freely                                   │
│                                                             │
│  Session Keys:                                              │
│    • Stored in local encrypted database                    │
│    • Encrypted with master key derived from identity key   │
│    • One session per contact                               │
│                                                             │
│  File Keys:                                                 │
│    • Generated per file                                     │
│    • Encrypted to recipient's identity key                 │
│    • Stored in message metadata                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Rotation

| Key Type | Rotation | Notes |
|----------|----------|-------|
| Identity Key | Never (unless compromised) | Loss = account loss |
| Signed Pre-Key | Monthly | Used for X3DH |
| One-Time Pre-Keys | Each use | Exhausted = generate more |
| Session Keys | Each message | Automatic ratcheting |
| File Keys | Per file | Generated on encrypt |

## Security Properties

### Achieved Properties

1. **Confidentiality**: Only intended recipients can read messages
2. **Integrity**: Tampering with messages is detectable
3. **Authentication**: Messages are verifiably from sender
4. **Forward Secrecy**: Compromise of current key doesn't expose past
5. **Future Secrecy**: Compromise doesn't expose future (after ratchet)

### Not Achieved (By Design)

1. **No Server-Side Recovery**: Lost keys cannot be recovered
2. **No Multi-Device Sync**: Currently single-device only
3. **Metadata Privacy**: Server sees sender/recipient keys (but not content)
4. **Deniability**: Messages are non-repudiable (signatures)

## Threat Model

### Protected Against

- ✅ Server operator reading messages
- ✅ Network eavesdropping (TLS + E2EE)
- ✅ Mass surveillance (no centralized storage)
- ✅ Server database compromise (no plaintext stored)
- ✅ Replay attacks (nonces + timestamps)
- ✅ Malleability (AEAD authentication)

### Not Protected Against

- ❌ Compromised client device
- ❌ Keyloggers / malware
- ❌ Physical device access
- ❌ Social engineering
- ❌ Compromised identity key

## Implementation Notes

### Using libsodium

chatLibre uses libsodium via `sodiumoxide` (Rust) or `libsodium-wasm` (JavaScript):

```rust
// Encryption
let nonce = secretbox::Nonce::gen();
let ciphertext = secretbox::seal(plaintext, &nonce, &key);

// Decryption
let plaintext = secretbox::open(&ciphertext, &nonce, &key).unwrap();
```

### Using ring

For Ed25519 operations:

```rust
use ring::signature::{Ed25519KeyPair, KeyPair};

let key_pair = Ed25519KeyPair::from_pkcs8(
    ED25519,
    pkcs8_bytes
).unwrap();

let signature = key_pair.sign(message);
let public_key = key_pair.public_key();
```

## Auditing

All cryptographic code should be auditable:

1. **No custom crypto**: Only established, reviewed libraries
2. **Clear specifications**: This document describes exact algorithms
3. **Test vectors**: Cryptographic functions have test vectors
4. **Reproducible builds**: Binaries can be verified against source

## Future Improvements

1. **MLS for Groups**: More efficient large group encryption
2. **Post-Quantum Keys**: Kyber for QKD resistance
3. **Secure Enclaves**: Hardware-backed key storage
4. **Sealed Sender**: Hide sender from server
