# chatLibre

**The privacy-first, federated, self-hostable communication platform.**

chatLibre is a complete open-source alternative to centralized chat platforms. Every user's identity is a cryptographic keypair they alone control — no accounts, no emails, no passwords. Servers are pure relays that never store plaintext messages.

## Key Features

### Identity & Privacy
- **No accounts** — Ed25519 keypair identity, never stored server-side
- **No passwords** — Your private key is your only credential
- **Zero server storage** — All messages encrypted client-side
- **No data collection** — No analytics, no telemetry, no phone-home

### Messaging
- Real-time E2EE messaging via WebSocket
- Message reactions
- Threaded replies
- Direct Messages with forward-secret key exchange

### Server Management
- Create and manage your own rooms
- Role-based permissions and invites
- **Discord import** — Import messages from Discord JSON exports

### Federation
- Self-host your own server in minutes
- Bitcoin-style peer discovery (DNS seeds + addr protocol)
- Cross-server message relay via public key exchange

### Voice
- Low-latency voice channels via server-relayed encrypted Opus over UDP
- Mute/deafen controls
- No WebRTC, no STUN/TURN required

---

## Quick Start

### Prerequisites
- **MSVC 2026+** or **GCC 14+** (C++23)
- **CMake 3.20+**
- **vcpkg** with dependencies (automatic)

### Build

```bash
cmake -B build -S . \
  -DCMAKE_TOOLCHAIN_FILE="path/to/vcpkg/scripts/buildsystems/vcpkg.cmake" \
  -DVCPKG_TARGET_TRIPLET=x64-windows
cmake --build build --config Release
```

### Run Server

```bash
./build/Release/chatlibre-server.exe --port 9733
```

The server automatically creates an Ed25519 identity at `~/.chatlibre/identity.bin` on first launch.

### Run Client

```bash
./build/Release/chatlibre-client.exe
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FEDERATION NETWORK                        │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │ Server A │◄────►│ Server B │◄────►│ Server C │          │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘          │
│       │                 │                 │                 │
│       └─────────────────┴─────────────────┘                 │
│                         │                                   │
│       ┌─────────────────┼─────────────────┐                 │
│       │                 │                 │                 │
│       ▼                 ▼                 ▼                 │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐            │
│  │ Client  │      │ Client  │      │ Client  │            │
│  │ (Local  │      │ (Local  │      │ (Local  │            │
│  │ Storage)│      │ Storage)│      │ Storage)│            │
│  └─────────┘      └─────────┘      └─────────┘            │
└──────────────────────────────────────────────────────────────┘

SERVER: Pure relay (no plaintext message storage)
CLIENT: Full E2EE, local encrypted storage
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | C++23 (C++26 preview with MSVC) |
| Networking | Boost.Beast + Boost.Asio (3-thread pool) |
| Server | Single-process, stateless relay |
| Client | SDL2 + Dear ImGui immediate-mode GUI |
| Encryption | libsodium (Ed25519, X25519, XSalsa20-Poly1305) |
| Voice | Opus codec, server-relayed UDP |
| Messaging | Binary WebSocket protocol (no JSON) |
| File Storage | Flat `.enc` files with AEAD encryption |

---

## Project Structure

```
chatlibre/
├── src/
│   ├── main.cpp          # Server entry point
│   ├── crypto.hpp        # libsodium wrappers (all inline)
│   ├── identity.hpp      # Ed25519 keypair identity
│   ├── protocol.hpp      # Binary message + file format
│   ├── server.hpp        # ServerState, Session, event loop
│   ├── ws.hpp            # WebSocket packet dispatch
│   ├── http.hpp          # REST endpoint helpers
│   ├── federation.hpp    # Peer discovery & relay
│   ├── storage.hpp       # Encrypted file & message log
│   ├── voice.hpp         # Voice channel relay
│   ├── ratelimit.hpp     # Token-bucket rate limiter
│   └── client/
│       ├── main.cpp      # SDL2+ImGui entry point
│       ├── app.hpp       # Client state & event queue
│       ├── gui.hpp       # ImGui rendering
│       ├── network.hpp   # WebSocket connection
│       ├── discord_import.hpp
│       ├── imgui_impl_sdl2.cpp
│       └── imgui_impl_opengl3.cpp
├── CMakeLists.txt
└── README.md
```

---

## Design Principles

- **Minimal abstractions** — No virtual dispatch, no RAII wrappers beyond necessity
- **Zero-copy hot path** — Binary protocol parsed in-place from WebSocket buffer
- **Server stores nothing in memory** — Messages appended to encrypted log on disk
- **Flat if/else routing** — Single dispatch function per packet type, no state machines
- **All crypto inline** — Direct libsodium C API calls, no wrapper layer

---

## Cryptographic Design

- **Identity**: Ed25519 keypairs (BIP39 mnemonic recovery)
- **Key Exchange**: X25519 key exchange per session
- **Message Encryption**: XSalsa20-Poly1305 (secretbox)
- **File Encryption**: Per-file XChaCha20-Poly1305 with header magic
- **Signatures**: Ed25519 for server identity and message authentication
- **Channel Binding**: X25519 shared secret derived per (client x25519_pk, server x25519_sk)

---

## Security

- No plaintext messages on servers
- No account databases
- No message metadata correlation
- No third-party dependencies that phone home
- Configurable client-side message retention

---

## License

MIT — see [LICENSE](LICENSE)
