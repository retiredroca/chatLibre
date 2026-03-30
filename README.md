# chatLibre

**The privacy-first, federated, self-hostable communication platform.**

chatLibre is a complete open-source alternative to centralized chat platforms. Built from the ground up with privacy as a non-negotiable requirement. Every user's identity is a cryptographic keypair they alone control — no accounts, no emails, no passwords, no data collection. Servers are pure relays that never store plaintext messages.

## Key Features

### Identity & Privacy
- **No accounts** — Ed25519 keypair identity, never stored server-side
- **No passwords** — Your private key is your only credential  
- **Recovery phrase** — 24-word mnemonic for account recovery
- **Zero server storage** — All messages encrypted client-side
- **No data collection** — No analytics, no telemetry, no phone-home

### Messaging
- Real-time text messaging via WebSocket
- Message editing and deletion with cryptographic verification
- Reactions with emoji support
- Threaded replies for organized conversations
- Direct Messages (1:1) with end-to-end encryption
- Group DMs with symmetric encryption

### Server Management
- Create and manage your own servers/communities
- Text, voice, announcement, stage, and forum channels
- Channel categories for organization
- Role-based permissions
- **Discord template import** — Import server structures from Discord template JSON URLs

### Federation
- Self-host your own server in minutes
- Federate with other chatLibre servers via public key exchange
- Cross-server channel membership
- Server discovery by URL + public key verification

### Voice (In Development)
- Low-latency voice channels (WebRTC planned)
- Screen sharing support
- Cross-server voice communication

---

## Quick Start

### Prerequisites
- Rust 1.75+ (for server)
- Node.js 20+ (for client)
- Tauri CLI (`npm install -g @tauri-apps/cli`)

### Run the Server

```bash
# Build and run
cd server
cargo build --release
./target/release/chatlibre-server

# Or with Docker
docker compose up -d
```

### Run the Client

```bash
cd client
npm install
npm run tauri dev
```

### Create Your Identity

1. Launch the client
2. Click "Create Identity"
3. **IMPORTANT**: Save your recovery phrase (24 words)
4. Back it up securely — losing it means losing your account

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FEDERATION NETWORK                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐      ┌──────────┐      ┌──────────┐             │
│  │ Server A │◄────►│ Server B │◄────►│ Server C │             │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘             │
│       │                 │                 │                    │
│       └─────────────────┴─────────────────┘                    │
│                         │                                      │
│       ┌─────────────────┼─────────────────┐                    │
│       │                 │                 │                    │
│       ▼                 ▼                 ▼                    │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐               │
│  │ Client  │      │ Client  │      │ Client  │               │
│  │ (Local  │      │ (Local  │      │ (Local  │               │
│  │ Storage)│      │ Storage)│      │ Storage)│               │
│  └─────────┘      └─────────┘      └─────────┘               │
└─────────────────────────────────────────────────────────────────┘

SERVER: Pure relay (no message storage)
CLIENT: Full E2EE, local encrypted storage
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Rust + Tokio + Axum + Sled |
| Desktop Client | Tauri 2.0 + React + TypeScript |
| Encryption | Web Crypto API (AES-GCM, Ed25519) |
| Messaging | WebSocket + WebRTC |
| Styling | Tailwind CSS |

---

## Project Structure

```
chatlibre/
├── server/              # Rust relay server
│   ├── src/
│   │   ├── main.rs
│   │   ├── crypto/      # Server identity & crypto
│   │   ├── protocol/    # Message types & validation
│   │   └── storage/     # Minimal relay storage
├── client/              # Tauri desktop client
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Page components
│   │   ├── services/    # Crypto service
│   │   ├── stores/      # Zustand state stores
│   │   └── styles/      # CSS styles
│   └── src-tauri/       # Tauri Rust backend
├── protocol/            # Shared protocol definitions
├── docs/                # Architecture documentation
├── docker/              # Docker configuration
└── scripts/             # Utility scripts
```

---

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Federation Protocol](docs/FEDERATION.md)
- [Cryptographic Design](docs/CRYPTOGRAPHY.md)
- [Self-Hosting Guide](docs/SELF_HOSTING.md)
- [Specification](SPEC.md)

---

## Development Status

| Component | Status |
|-----------|--------|
| Server core | ✅ Complete |
| WebSocket handlers | ✅ Complete |
| Client UI | ✅ Complete |
| Discord template import | ✅ Complete |
| E2EE messaging | 🔄 In Progress |
| Voice channels | 🔄 Planned |
| Federation | 🔄 Planned |
| File encryption | 🔄 Planned |

---

## Security

We take security seriously. Please read our [Security Policy](SECURITY.md) before reporting vulnerabilities.

### Privacy Guarantees
- No plaintext messages on servers
- No account databases
- No message metadata correlation
- No third-party dependencies that phone home
- Configurable client-side message retention

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Server
cd server
cargo build
cargo test

# Client
cd client
npm install
npm run dev
```

---

## License

AGPL-3.0 or later — see [LICENSE](LICENSE)

---

## Status

**Active Development** — Building foundation components

The project is in active development. Core server and client structure are complete. E2EE messaging, voice channels, and federation are planned.
