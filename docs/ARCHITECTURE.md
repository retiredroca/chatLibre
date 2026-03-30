# chatLibre Architecture

## Overview

chatLibre is a federated, end-to-end encrypted communication platform designed with privacy as the primary requirement. This document describes the high-level architecture.

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  Tauri     │  │  Web/PWA    │  │  (Future)   │                │
│  │  Desktop   │  │  Browser    │  │  Mobile     │                │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘                │
│         │                │                                      │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │              ENCRYPTED LOCAL STORAGE                      │   │
│  │  • Message history (encrypted blobs)                      │   │
│  │  • Contact key bundles                                    │   │
│  │  • User identity keys                                     │   │
│  │  • Server trust anchors                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RELAY LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  Server A   │◄─┼─►│  Server B  │◄─┼─►│  Server C  │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │
│         │                │                │                      │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │              METADATA STORE (sled)                       │   │
│  │  • Server identity key                                   │   │
│  │  • Channel registry (names, topics, positions)          │   │
│  │  • Role definitions                                     │   │
│  │  • Trusted federation keys                               │   │
│  │  • Pinned messages (encrypted blobs)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚠️ SERVER NEVER STORES:                                         │
│     ✗ Plaintext messages                                        │
│     ✗ Message encryption keys                                    │
│     ✗ User private keys                                         │
│     ✗ Contact relationships                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Message Send Flow

```
1. Client A writes message
         │
         ▼
2. Client A encrypts with recipient keys (Double Ratchet)
         │
         ▼
3. Client A sends encrypted blob via WebSocket
         │
         ▼
4. Server relays encrypted blob to connected recipients
         │
         ▼
5. Server MAY store encrypted blob for offline recipients
         │
         ▼
6. Recipient Client B receives encrypted blob
         │
         ▼
7. Client B decrypts with stored session keys
         │
         ▼
8. Client B stores plaintext in local encrypted database
```

### Federation Flow

```
Server A                              Server B
    │                                     │
    │──── GET /capabilities ──────────────►│
    │◄─── Server capabilities + pubkey ────│
    │                                     │
    │──── POST /federation/handshake ────►│  (trust_request)
    │      { action: "trust_request",     │
    │        server_pubkey: "A...",        │
    │        signature: SigA("request") } │
    │                                     │
    │                    Admin reviews and approves
    │                                     │
    │◄─── POST /federation/handshake ─────│  (trust_confirm)
    │      { action: "trust_confirm",      │
    │        server_pubkey: "B...",        │
    │        signature: SigB("confirm") } │
    │                                     │
    │  Federation ESTABLISHED              │
    │                                     │
    │◄══════════ Messages relayed ════════►│
```

## Storage Architecture

### Client Storage (IndexedDB / SQLite)

```
┌─────────────────────────────────────────────────────┐
│                  ENCRYPTED DATABASE                  │
├─────────────────────────────────────────────────────┤
│ messages                                             │
│ ├── id (UUID)                                       │
│ ├── channel_id                                      │
│ ├── sender_key                                      │
│ ├── ciphertext (encrypted)                          │
│ ├── nonce                                           │
│ ├── timestamp                                       │
│ ├── is_starred                                      │
│ └── reply_to / thread_id                            │
├─────────────────────────────────────────────────────┤
│ contacts                                            │
│ ├── public_key                                      │
│ ├── display_name (encrypted)                       │
│ ├── key_bundle                                      │
│ └── first_seen                                      │
├─────────────────────────────────────────────────────┤
│ servers                                             │
│ ├── id                                              │
│ ├── url                                             │
│ ├── public_key (trust anchor)                       │
│ └── is_trusted                                      │
├─────────────────────────────────────────────────────┤
│ sessions (Double Ratchet state)                      │
│ ├── remote_key                                      │
│ ├── root_key                                        │
│ ├── chain_key                                       │
│ └── message_number                                  │
├─────────────────────────────────────────────────────┤
│ settings                                            │
│ ├── key                                             │
│ └── value (encrypted)                              │
└─────────────────────────────────────────────────────┘
```

### Server Storage (sled)

```
┌─────────────────────────────────────────────────────┐
│                     SLED DATABASE                   │
├─────────────────────────────────────────────────────┤
│ Tree: server_identity                               │
│ ├── private_key (server's Ed25519 private)         │
│ └── created_at                                      │
├─────────────────────────────────────────────────────┤
│ Tree: channels                                      │
│ └── channel_<id> → ChannelMeta (JSON)              │
├─────────────────────────────────────────────────────┤
│ Tree: federation                                    │
│ ├── trusted_<server_pubkey> → timestamp            │
│ └── pending_<server_pubkey> → timestamp            │
├─────────────────────────────────────────────────────┤
│ Tree: server_meta                                    │
│ └── server_info → ServerInfo (JSON)                │
├─────────────────────────────────────────────────────┤
│ Tree: pinned_messages                               │
│ └── pin_<id> → PinnedMessage (encrypted blob)     │
└─────────────────────────────────────────────────────┘
```

## Security Boundaries

```
┌────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARY                         │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                    CLIENT                             │ │
│  │                                                        │ │
│  │  • Identity key (private)                             │ │
│  │  • Double Ratchet state                               │ │
│  │  • Plaintext messages                                 │ │
│  │  • Session keys                                       │ │
│  │                                                        │ │
│  │  ⭐ HIGHEST TRUST - User's sole credential            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    UNTRUSTED ZONE                          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                    SERVER                             │ │
│  │                                                        │ │
│  │  • Server identity key (public trust anchor)         │ │
│  │  • Channel metadata                                   │ │
│  │  • Encrypted message blobs                            │ │
│  │  • Pinned messages (encrypted)                       │ │
│  │  • Federation trust list                              │ │
│  │                                                        │ │
│  │  ⭐ ZERO TRUST for message confidentiality           │ │
│  │  ⭐ PARTIAL TRUST for server identity                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Key Hierarchy

```
User Identity Key (Ed25519)
    │
    ├── Used for: Signing key bundles, message signatures
    │
    └── Never: Shared with servers or other users directly

        │
        ▼

Key Bundle (Published to server)
    │
    ├── Identity Key (public)
    ├── Signed Pre-Key (X25519)
    └── One-Time Pre-Keys (X25519)

        │
        ▼

Session Keys (Double Ratchet)
    │
    ├── Root Key (HKDF)
    ├── Chain Key (symmetric)
    └── Message Keys (AEAD)

        │
        ▼

File Encryption Keys (AES-256)
    │
    ├── Randomly generated per file
    └── Encrypted to recipient's identity key
```

## Network Protocols

### WebSocket Protocol

Messages are JSON (for small metadata) or binary (for large payloads).

```json
{
  "id": "uuid-v4",
  "version": 1,
  "timestamp": 1700000000000,
  "sender": "kf_publickey...",
  "type": "chat.message",
  "payload": {
    "channel_id": "ch_...",
    "ciphertext": "base64...",
    "nonce": "base64..."
  }
}
```

### Federation Protocol

Servers communicate via HTTPS POST requests.

```json
// POST /federation/handshake
{
  "action": "trust_request | trust_confirm | trust_revoke",
  "server_pubkey": "-----BEGIN ED25519-----\n...\n-----END ED25519-----",
  "signature": "base64..."
}

// POST /federation/relay
{
  "source_server": "kf_serverid...",
  "target_server": "kf_serverid...",
  "encrypted_payload": "base64...",
  "signature": "base64..."
}
```

## Performance Considerations

### Client
- IndexedDB operations are async but may block UI
- Use Web Workers for crypto operations
- Batch database writes for bulk operations
- Implement message virtualization for large channels

### Server
- Stateless relay design enables horizontal scaling
- sled provides fast embedded storage
- WebSocket connections require connection pooling
- Consider Redis for pub/sub in multi-instance deployments

## Future Architecture Considerations

1. **Multi-Device Support**: Master key + device subkeys with secure sync
2. **MLS Migration**: More efficient group encryption
3. **Decentralized Discovery**: DHT for server discovery
4. **Storage Proofs**: Verify server compliance with no-storage policy
