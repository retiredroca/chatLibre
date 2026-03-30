# chatLibre — Federated Privacy-First Communication Platform

## Project Specification v0.1.0

---

## 1. Concept & Vision

**chatLibre** is a 100% open-source, self-hostable, federated communication platform that prioritizes privacy above all else. Every user's identity is a cryptographic keypair they alone control — no accounts, no emails, no passwords, no data collection. Servers are pure stateless relays that never store plaintext messages; all chat history, media, and sensitive data live exclusively on clients with end-to-end encryption. Built for users who demand military-grade privacy without sacrificing modern UX.

---

## 2. Design Language

### Aesthetic Direction
**"Secure Minimalism"** — Clean, professional interface inspired by Signal's privacy focus meets Discord's functionality. Dark mode default with high-contrast text for readability. Subtle visual cues (lock icons, encryption indicators) that reinforce security without being intrusive.

### Color Palette
```
Primary Background:    #0D1117 (deep charcoal)
Secondary Background:  #161B22 (elevated surfaces)
Tertiary Background:   #21262D (cards, inputs)
Primary Text:         #E6EDF3 (high contrast)
Secondary Text:       #8B949E (muted)
Accent Primary:       #58A6FF (links, interactive)
Accent Success:       #3FB950 (online, success states)
Accent Warning:       #D29922 (warnings, stars)
Accent Danger:        #F85149 (errors, delete)
Encryption Indicator: #A371F7 (purple, trust signal)
```

### Typography
- **Headings**: JetBrains Mono (monospace, technical feel)
- **Body**: Inter (clean, highly readable)
- **Code/Keys**: Fira Code (ligatures for key display)

### Spatial System
- Base unit: 4px
- Component padding: 12px / 16px / 24px
- Channel list width: 240px
- Member sidebar: 240px
- Message spacing: 8px between messages, 24px between message groups

### Motion Philosophy
- **Micro-interactions**: 150ms ease-out for hover states
- **Panel transitions**: 200ms ease-in-out for sidebars
- **Message appear**: Slide-up 100ms + fade 150ms
- **Encryption unlock**: 300ms radial reveal animation
- No gratuitous animations — every motion serves function

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FEDERATION NETWORK                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Server A    │◄───►│  Server B    │◄───►│  Server C    │                │
│  │  chatlibre.io │     │  community.ok│    │  priv.chat   │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     CLIENTS (Encrypted Payload Relay)               │     │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │     │
│  │  │ Tauri   │  │ Tauri   │  │ Web/PWA │  │ Tauri   │  │ Tauri   │  │     │
│  │  │ Desktop │  │ Desktop │  │ Browser │  │ Desktop │  │ Desktop │  │     │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │     │
│  │       │            │            │            │            │       │     │
│  │       ▼            ▼            ▼            ▼            ▼       │     │
│  │  ┌─────────────────────────────────────────────────────────────┐   │     │
│  │  │              LOCAL ENCRYPTED STORAGE (IndexedDB/SQLite)       │   │     │
│  │  │  • Message history (encrypted blobs)                         │   │     │
│  │  │  • Contact key bundles                                      │   │     │
│  │  │  • Server trust anchors                                      │   │     │
│  │  │  • File attachments (encrypted)                             │   │     │
│  │  └─────────────────────────────────────────────────────────────┘   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

SERVER INTERNAL ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│                        KEYFORGE SERVER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ WebSocket   │  │ WebRTC      │  │ Federation  │              │
│  │ Handler     │  │ Signaling   │  │ Protocol    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┴────────────────┘                      │
│                          │                                       │
│                    ┌─────▼─────┐                                 │
│                    │  Relay    │  ←─ STATELESS                   │
│                    │  Engine   │     (no message storage)        │
│                    └─────┬─────┘                                 │
│                          │                                       │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Metadata   │  │   Channel   │  │   Role/     │              │
│  │  Store      │  │   Registry  │  │   Permission│              │
│  │  (sled)     │  │  (sled)     │  │   Store     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  SERVER STORES ONLY:                                             │
│  • Server identity (Ed25519 keypair)                            │
│  • Server metadata (name, description, icon)                     │
│  • Channel list + metadata (NOT message content)                 │
│  • Pinned messages (encrypted blobs only)                       │
│  • Trusted federation keys                                       │
│  • Role definitions + permission templates                       │
│  • User public keys (for identity only, not authentication)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Cryptographic Design

### 4.1 Identity System

```
USER IDENTITY CREATION:
┌─────────────────────────────────────────────────────────────┐
│                    Generated Entropy (256-bit)                │
│                         RNG (OS/CSPRNG)                       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Ed25519 Keypair Generation                       │
│  • Private key: User's sole credential                        │
│  • Public key: User's universal identifier                     │
│  • Shape: kf_1a2b3c4d5e6f... (base58-encoded public key)       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Recovery Phrase                            │
│  • BIP39 mnemonic (24 words)                                 │
│  • Encodes the same entropy as raw key                       │
│  • User MUST back up — loss = account loss                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Message Encryption (Double Ratchet)

```
ENCRYPTION FLOW:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Sender    │    │   Server    │    │  Recipient  │
│   Client    │    │   (Relay)   │    │   Client    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                 │                   │
       │  1. DH Ratchet Step                │
       │ ───────────────►                   │
       │                 │                   │
       │  2. Symmetric Key Derivation        │
       │     (HKDF)       │                   │
       │                 │                   │
       │  3. Encrypt Message                 │
       │     AES-256-GCM                     │
       │                 │                   │
       │  4. Send Encrypted Blob             │
       │ ───────────────►───────────────────►
       │                 │                   │
       │                 │    5. Decrypt     │
       │                 │       (verified   │
       │                 │        with DH    │
       │                 │        key)      │
       ▼                 ▼                   ▼

SERVER NEVER SEES:
✗ Plaintext message
✗ Encryption keys
✗ DH ratchet state
✗ Sender/recipient relationship metadata (beyond relay)
```

### 4.3 File Encryption

```
FILE UPLOAD FLOW:
┌──────────────────────────────────────────────────────────────┐
│                      CLIENT-SIDE                              │
│  1. Generate random AES-256-GCM key (file_key)               │
│  2. Encrypt file contents → encrypted_blob                    │
│  3. Derive Content-Hash (Blake3) of encrypted blob           │
│  4. Create metadata packet:                                  │
│     {                                                        │
│       "file_key_encrypted": E(their_public_key, file_key),  │
│       "content_hash":Blake3(encrypted_blob),                 │
│       "mime_type": "image/png",                              │
│       "size_encrypted": 1048576                              │
│     }                                                        │
│  5. Upload: encrypted_blob + metadata to server               │
└──────────────────────────────────────────────────────────────┘

SERVER STORES:
✓ Encrypted blob (unreadable without file_key)
✓ Metadata (no plaintext filename or content)

CLIENT STORES LOCALLY:
✓ file_key (in message bundle, encrypted with recipient key)
```

### 4.4 Federation Handshake

```
SERVER FEDERATION PROTOCOL:
┌─────────────────┐                    ┌─────────────────┐
│   Server A      │                    │   Server B      │
│  (initiator)    │                    │   (responder)   │
└───────┬─────────┘                    └───────┬─────────┘
        │                                    │
        │  1. GET /federation/capabilities    │
        │ ──────────────────────────────────►
        │                                    │
        │  2. Capabilities response          │
        │ ◄─────────────────────────────────
        │    {                               │
        │      "version": "1.0",            │
        │      "features": ["e2ee","voice"],│
        │      "server_pubkey": "Ed25519..."│
        │    }                               │
        │                                    │
        │  3. Trust proposal                 │
        │ ──────────────────────────────────►
        │    {                               │
        │      "action": "trust_request",   │
        │      "server_a_pubkey": "...",    │
        │      "signature": Sig(privkey, ...)│
        │    }                               │
        │                                    │
        │                         4. Admin approves on Server B
        │                                    │
        │  5. Trust confirmation            │
        │ ◄─────────────────────────────────
        │    {                               │
        │      "action": "trust_confirm",   │
        │      "server_b_pubkey": "...",    │
        │      "signature": Sig(privkey, ...)│
        │    }                               │
        │                                    │
        │  6. Federation ESTABLISHED         │
        │     (bidirectional relay enabled)  │
        ▼                                    ▼
```

---

## 5. Folder Structure

```
chatlibre/
├── SPEC.md
├── README.md
├── LICENSE (AGPL-3.0)
├── CONTRIBUTING.md
├── SECURITY.md
├── docker-compose.yml
├── docker/
│   └── Dockerfile.server
│
├── server/                          # Rust-based relay server
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── src/
│   │   ├── main.rs                  # Entry point, server bootstrap
│   │   ├── lib.rs                   # Library root
│   │   │
│   │   ├── config/                  # Configuration management
│   │   │   ├── mod.rs
│   │   │   └── settings.rs
│   │   │
│   │   ├── crypto/                  # Cryptographic operations
│   │   │   ├── mod.rs
│   │   │   ├── identity.rs          # Server identity keypair
│   │   │   ├── signatures.rs        # Ed25519 signing/verification
│   │   │   └── federation.rs        # Federation protocol crypto
│   │   │
│   │   ├── storage/                 # Metadata storage (sled)
│   │   │   ├── mod.rs
│   │   │   ├── db.rs                # Database initialization
│   │   │   ├── server_meta.rs       # Server identity storage
│   │   │   ├── channels.rs          # Channel registry
│   │   │   ├── roles.rs             # Roles and permissions
│   │   │   └── federation_keys.rs    # Trusted server keys
│   │   │
│   │   ├── protocol/                # Protocol definitions
│   │   │   ├── mod.rs
│   │   │   ├── messages.rs          # Protocol message types
│   │   │   └── validation.rs        # Message validation
│   │   │
│   │   ├── ws/                      # WebSocket handling
│   │   │   ├── mod.rs
│   │   │   ├── handler.rs           # Connection handler
│   │   │   ├── router.rs            # Message routing
│   │   │   └── session.rs           # Session management
│   │   │
│   │   ├── federation/              # Federation protocol
│   │   │   ├── mod.rs
│   │   │   ├── protocol.rs          # Federation handshake
│   │   │   ├── relay.rs             # Cross-server relay
│   │   │   └── discovery.rs         # Server discovery
│   │   │
│   │   ├── webrtc/                  # WebRTC signaling
│   │   │   ├── mod.rs
│   │   │   ├── signaling.rs         # SDP/ICE relay
│   │   │   └── turn.rs              # TURN integration
│   │   │
│   │   └── api/                     # HTTP API (minimal)
│   │       ├── mod.rs
│   │       ├── routes.rs
│   │       └── handlers/
│   │           ├── federation.rs
│   │           ├── metadata.rs
│   │           └── health.rs
│   │
│   └── tests/
│       ├── crypto_tests.rs
│       ├── federation_tests.rs
│       └── protocol_tests.rs
│
├── client/                          # Tauri 2.0 desktop client
│   ├── package.json
│   ├── src-tauri/                   # Rust backend
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   ├── icons/
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── lib.rs
│   │   │   ├── commands/           # Tauri IPC commands
│   │   │   │   ├── mod.rs
│   │   │   │   ├── identity.rs
│   │   │   │   ├── storage.rs
│   │   │   │   └── crypto.rs
│   │   │   ├── storage/            # Local encrypted storage
│   │   │   │   ├── mod.rs
│   │   │   │   ├── sqlite.rs
│   │   │   │   ├── schema.rs
│   │   │   │   └── retention.rs
│   │   │   └── crypto/              # Client-side crypto
│   │   │       ├── mod.rs
│   │   │       ├── identity.rs
│   │   │       ├── ratchet.rs       # Double ratchet impl
│   │   │       ├── keybundle.rs     # Key exchange bundles
│   │   │       └── files.rs         # File encryption
│   │   │
│   │   └── capabilities/
│   │       └── default.json
│   │
│   └── src/                        # React/TypeScript frontend
│       ├── index.html
│       ├── index.tsx
│       ├── App.tsx
│       ├── main.tsx
│       │
│       ├── components/             # UI components
│       │   ├── Layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── ChannelList.tsx
│       │   │   ├── ServerHeader.tsx
│       │   │   └── UserPanel.tsx
│       │   │
│       │   ├── Chat/
│       │   │   ├── MessageList.tsx
│       │   │   ├── Message.tsx
│       │   │   ├── MessageInput.tsx
│       │   │   ├── ThreadView.tsx
│       │   │   └── ReactionPicker.tsx
│       │   │
│       │   ├── Voice/
│       │   │   ├── VoiceChannel.tsx
│       │   │   ├── ParticipantList.tsx
│       │   │   └── ScreenShare.tsx
│       │   │
│       │   ├── Modals/
│       │   │   ├── CreateServer.tsx
│       │   │   ├── JoinServer.tsx
│       │   │   ├── Settings.tsx
│       │   │   └── BackupIdentity.tsx
│       │   │
│       │   └── Common/
│       │       ├── Avatar.tsx
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       └── Tooltip.tsx
│       │
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── Channel.tsx
│       │   ├── DirectMessages.tsx
│       │   ├── ServerSettings.tsx
│       │   └── Onboarding.tsx
│       │
│       ├── hooks/                  # React hooks
│       │   ├── useWebSocket.ts
│       │   ├── useCrypto.ts
│       │   ├── useStorage.ts
│       │   └── useVoice.ts
│       │
│       ├── stores/                 # State management (Zustand)
│       │   ├── identityStore.ts
│       │   ├── serverStore.ts
│       │   ├── channelStore.ts
│       │   ├── messageStore.ts
│       │   └── voiceStore.ts
│       │
│       ├── services/               # Business logic
│       │   ├── crypto.ts           # Encryption service
│       │   ├── protocol.ts         # Protocol handling
│       │   ├── storage.ts          # Storage service
│       │   └── federation.ts       # Federation service
│       │
│       ├── crypto/                 # Cryptographic utilities
│       │   ├── ratchet.ts
│       │   ├── keybundle.ts
│       │   └── utils.ts
│       │
│       ├── styles/                 # CSS/Tailwind
│       │   ├── globals.css
│       │   ├── themes.css
│       │   └── components/
│       │
│       ├── i18n/                   # Internationalization
│       │   ├── en.json
│       │   └── [locale]/
│       │
│       └── utils/
│           ├── formatting.ts
│           ├── validation.ts
│           └── constants.ts
│
├── web/                            # Web client (PWA)
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/                        # Shared with client, optimized for web
│       ├── App.tsx
│       ├── main.tsx
│       ├── sw.ts                   # Service worker
│       └── ...
│
├── protocol/                       # Shared protocol definitions
│   ├── SPEC.md                     # Full protocol specification
│   ├── src/
│   │   ├── types.ts                # TypeScript types
│   │   ├── messages.ts             # Message schemas
│   │   └── errors.ts               # Error codes
│   └── Cargo.toml                  # Rust definitions for server
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEDERATION.md
│   ├── CRYPTOGRAPHY.md
│   ├── SELF_HOSTING.md
│   └── CLIENT_DEVELOPMENT.md
│
└── scripts/
    ├── generate_identity.sh
    ├── run_dev_server.sh
    └── docker_entrypoint.sh
```

---

## 6. Tech Stack

### Server (Rust)

| Component | Technology | Justification |
|-----------|------------|---------------|
| Runtime | Tokio | Async runtime for WebSocket/WebRTC handling |
| HTTP | Axum | Lightweight, fast, type-safe HTTP |
| WebSocket | Tungstenite | Battle-tested WebSocket library |
| Storage | Sled | Embedded key-value store, zero-config |
| Crypto | ring | Constant-time crypto operations |
| Serialization | serde + bincode | Fast binary serialization |
| Logging | tracing | Structured logging |
| Config | figment | Environment variable config |

### Client Desktop (Tauri 2.0)

| Component | Technology | Justification |
|-----------|------------|---------------|
| Framework | Tauri 2.0 | Native performance, Rust backend |
| Frontend | React 18 + TypeScript | Component-based UI |
| State | Zustand | Lightweight, no boilerplate |
| Styling | Tailwind CSS | Rapid development |
| Storage | SQLCipher | SQLite with encryption |
| Crypto | libsodium (via sodiumoxide) | Proven crypto library |
| WebRTC | webrtc | Rust WebRTC implementation |
| Bundler | Vite | Fast HMR for development |

### Client Web (Progressive Web App)

| Component | Technology | Justification |
|-----------|------------|---------------|
| Framework | React 18 + TypeScript | Same as desktop |
| Bundler | Vite | Fast builds |
| Crypto | libsodium-wasm | Browser crypto |
| Storage | IndexedDB + OPFS | Large file support |
| PWA | vite-plugin-pwa | Service worker generation |
| State | Zustand | Shared with desktop |

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
**Goal**: Single-server E2EE chat MVP

- [ ] Project scaffolding (server + client repos)
- [ ] Server: Basic WebSocket relay infrastructure
- [ ] Client: Onboarding flow (identity generation)
- [ ] Client: Server connection UI
- [ ] Crypto: Ed25519 identity implementation
- [ ] Crypto: Basic AES-256-GCM encryption
- [ ] Protocol: Basic message format definition
- [ ] Client: Channel list and message view
- [ ] Client: Message sending/receiving (encrypted)
- [ ] Client: Local storage (IndexedDB/SQLite)
- [ ] Basic testing and documentation

### Phase 2: Core Features (Weeks 5-8)
**Goal**: Full messaging feature parity with basic chat

- [ ] Direct Messages (1:1 E2EE)
- [ ] Message reactions
- [ ] Message editing (E2EE update)
- [ ] Message replies/threads
- [ ] File uploads (client-side encrypted)
- [ ] Server metadata (name, icon, description)
- [ ] Channel creation and management
- [ ] Role system (basic)
- [ ] Permission system (basic)
- [ ] Invite links
- [ ] Pinned messages (server-stored encrypted)
- [ ] Client storage retention policies

### Phase 3: Federation (Weeks 9-12)
**Goal**: Multi-server federation

- [ ] Server federation protocol
- [ ] Public key exchange handshake
- [ ] Cross-server channel membership
- [ ] Cross-server DMs
- [ ] Server discovery (manual URL + key)
- [ ] Federation trust management UI
- [ ] Cross-server presence
- [ ] Federation stress testing
- [ ] Security audit prep

### Phase 4: Voice (Weeks 13-16)
**Goal**: Real-time voice communication

- [ ] WebRTC signaling infrastructure
- [ ] Voice channel management
- [ ] Audio streaming (DTLS-SRTP)
- [ ] Video (optional, screen share priority)
- [ ] TURN server integration
- [ ] Voice channel UI
- [ ] Cross-server voice
- [ ] Voice quality optimization

### Phase 5: Polish & Mobile (Weeks 17-20)
**Goal**: Production-ready release

- [ ] Mobile client (React Native or Tauri Mobile)
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Theme system expansion
- [ ] Custom emoji/stickers
- [ ] Group DM improvements
- [ ] Full documentation
- [ ] Security audit
- [ ] Release preparation

---

## 8. Protocol Specification

### 8.1 WebSocket Message Format

```typescript
// All messages are binary (MessagePack) or JSON depending on payload size
// Binary preferred for messages with binary attachments

interface ProtocolMessage {
  id: string;           // UUID v4
  version: 1;
  timestamp: number;   // Unix milliseconds
  sender: string;      // Public key (base58)
  type: MessageType;
  payload: EncryptedPayload | ServerMetadata | ...;
}

type MessageType = 
  | "chat.message"
  | "chat.edit"
  | "chat.delete"
  | "chat.reaction"
  | "chat.thread_reply"
  | "channel.create"
  | "channel.update"
  | "channel.delete"
  | "voice.join"
  | "voice.leave"
  | "voice.signal"
  | "federation.relay"
  | "federation.handshake"
  | "presence.update"
  | "sync.request"
  | "sync.response";

interface EncryptedPayload {
  ciphertext: string;      // Base64
  nonce: string;           // Base64
  recipient_key: string;   // Target public key (for DM) or channel key
  sender_key: string;      // Sender's public key (for verification)
  signature: string;       // Ed25519 signature of ciphertext
}
```

### 8.2 Server Metadata Format

```json
{
  "server": {
    "id": "kf_abc123...",
    "name": "Privacy First Community",
    "description": "A safe space for privacy enthusiasts",
    "icon_url": "https://...",
    "banner_url": "https://...",
    "public_key": "-----BEGIN ED25519-----\n...\n-----END ED25519-----",
    "created_at": 1700000000000,
    "version": "1.0.0"
  },
  "channels": [
    {
      "id": "ch_general",
      "name": "general",
      "topic": "General discussion",
      "position": 0,
      "type": "text",
      "created_at": 1700000000000
    },
    {
      "id": "ch_voice",
      "name": "General Voice",
      "topic": "Voice chat room",
      "position": 1,
      "type": "voice",
      "created_at": 1700000000000
    }
  ],
  "roles": [
    {
      "id": "role_admin",
      "name": "Admin",
      "color": "#F85149",
      "permissions": ["manage_server", "manage_channels", "kick_members"],
      "position": 99
    },
    {
      "id": "role_member",
      "name": "Member",
      "color": "#58A6FF",
      "permissions": ["read_messages", "send_messages", "join_voice"],
      "position": 0
    }
  ],
  "pinned_messages": [
    {
      "id": "pin_001",
      "channel_id": "ch_general",
      "encrypted_blob": "...",
      "pinned_by": "kf_user1...",
      "pinned_at": 1700000000000
    }
  ]
}
```

---

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Server operator reads messages | E2EE - server never sees plaintext |
| Network eavesdropping | TLS for transport, E2EE for content |
| Client device compromise | User's key protection (future: secure enclave) |
| Identity theft | Key is user's sole credential; loss = loss |
| Man-in-middle (federation) | Public key signature verification |
| Replay attacks | Nonce + timestamp validation |
| Metadata correlation | DMs use recipient key; no server-side contact lists |

### 9.2 Privacy Guarantees

- **Zero server storage**: Chat history never touches server storage
- **No metadata correlation**: Server doesn't know which users DMed each other
- **No phone-home**: No analytics, telemetry, or external dependencies
- **No account recovery**: Keypair is unrecoverable; privacy by design
- **Client-side purging**: Configurable retention; user controls their data

---

## 10. Open Source Commitment

### License
AGPL-3.0 or later — ensures all modifications remain open source

### Community
- Public GitHub/Gitea organization
- Public issue tracker
- Public discussion forum (self-hosted)
- Regular security audits (community-funded)

### Transparency
- All dependencies documented
- Reproducible builds
- No proprietary components
- Audit-friendly architecture (clear crypto flows, minimal complexity)

---

## 11. Future Considerations

- **Secure enclave integration**: Hardware-backed key storage
- **Multi-device support**: Key derivation for multiple devices (master key + device keys)
- **MLS for group encryption**: More efficient group messaging
- **Decentralized identity**: Integration with existing DID systems
- **ActivityPub bridge**: Federation with ActivityPub ecosystem
