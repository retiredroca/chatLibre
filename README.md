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
- Bitcoin-style peer discovery (DNS seeds + addr protocol)
- Federate with other chatLibre servers via public key exchange
- Cross-server channel membership
- Server discovery by URL + public key verification

### Voice
- Low-latency voice channels via WebRTC
- Mute/deafen controls
- Screen sharing support
- Cross-server voice communication

---

## Quick Start

### Prerequisites
- Rust 1.75+ (for server)
- Node.js 20+ (for client)
- Docker & Docker Compose (optional)

### Run with Docker

```bash
docker compose up -d
```

Access:
- **Chat client**: http://localhost
- **Nginx Proxy Manager**: http://localhost:81 (admin@admin.com / changeme)

### Run Server Manually

```bash
cd server
cargo build --release
KEYFORGE_SERVER_PORT=8080 ./target/release/chatlibre-server
```

### Run Client

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
| Encryption | Web Crypto API (AES-GCM, ECDH), libsodium |
| Messaging | WebSocket + WebRTC |
| Proxy | Nginx Proxy Manager |
| Styling | Tailwind CSS |

---

## Project Structure

```
chatlibre/
├── server/              # Rust relay server
│   └── src/
│       ├── main.rs           # Server entry, routes, handlers
│       ├── crypto/          # Identity, signatures, peer discovery
│       ├── protocol/        # Message types & validation
│       └── storage/         # Minimal relay storage (sled)
├── client/              # Tauri desktop client
│   └── src/
│       ├── components/      # React components
│       ├── hooks/          # Custom React hooks
│       ├── pages/          # Page components
│       ├── services/       # Crypto service (E2EE)
│       ├── stores/         # Zustand state stores
│       └── styles/         # CSS styles
├── docker/              # Docker configuration
├── .github/
│   └── workflows/       # GitHub Actions CI/CD
└── docker-compose.yml   # Docker Compose config
```

---

## Building

### Manual Build

```bash
# Server
cd server && cargo build --release

# Client
cd client && npm install && npm run tauri build
```

### GitHub Actions

Trigger builds via:
- **Manual**: Actions → Build → Run workflow
- **Comment**: Post `/build` on any PR or issue

Builds run on macOS, Ubuntu, and Windows in parallel.

---

## Security

We take security seriously. Please read our [Security Policy](SECURITY.md) before reporting vulnerabilities.

### Privacy Guarantees
- No plaintext messages on servers
- No account databases
- No message metadata correlation
- No third-party dependencies that phone home
- Configurable client-side message retention

### Cryptographic Design
- **Identity**: Ed25519 keypairs
- **Key Exchange**: X25519/ECDH (Curve25519)
- **Message Encryption**: AES-256-GCM
- **File Encryption**: Per-file keys with ECDH key wrapping
- **Signatures**: Ed25519 for server identity and message authentication

---

## License

MIT — see [LICENSE](LICENSE)
