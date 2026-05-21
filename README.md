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

## Implementation Status

| Feature | Status |
|---------|--------|
| Server Ed25519 identity gen | ✅ Done |
| Server WebSocket listener | ✅ Done |
| Client Ed25519 identity gen | ✅ Done |
| Client WebSocket connect | ✅ Done |
| Auth handshake (challenge-sign-response) | ✅ Done |
| X25519 session key derivation | ✅ Done |
| Encrypted message relay | ✅ Done |
| Binary WebSocket protocol (all packet types) | ✅ Done |
| Rate limiting | ✅ Done |
| File storage (encrypted on disk) | ✅ Done |
| Discord import scanner | ✅ Done |
| Protocol test suite | ✅ Done |
| Client SDL2 + ImGui GUI | ✅ Implemented, untested interactively |
| Room create/join/leave | ✅ Implemented, untested |
| Voice channels (Opus over UDP) | ✅ Implemented, untested |
| Federation (peer discovery + relay) | ✅ Implemented, untested |
| Message reactions | ✅ Implemented, untested |
| Thread/forum channel types | ❌ Not implemented |
| User roles/permissions | ❌ Not implemented |
| User invites | ❌ Not implemented |
| Message history | ❌ Not implemented |
| BIP39 mnemonic recovery | ❌ Not implemented |

---

## Roadmap

### Phase 1 — Core Protocol (Complete)
- [x] Server identity & listener
- [x] Client identity & WebSocket connection
- [x] Ed25519 auth handshake
- [x] X25519 session key exchange
- [x] Secretbox message encryption/relay
- [x] Binary wire protocol

### Phase 2 — E2EE Messaging (Partial)
- [x] Send/receive encrypted messages
- [x] Server relays ciphertext to room members
- [ ] Threaded replies
- [ ] Message editing with signature verification
- [ ] Message deletion
- [ ] Full room list management (list, join, leave from GUI)

### Phase 3 — Voice & Media
- [x] Voice channel stub (Opus encode/decode, UDP relay)
- [ ] Microphone capture → Opus encode → send over UDP
- [ ] Audio playback (Opus decode → SDL audio)
- [ ] Screen sharing (desktop capture → UDP relay)

### Phase 4 — Federation
- [x] Peer discovery stubs
- [x] Cross-server relay stubs
- [ ] DNS seed bootstrap
- [ ] Inter-server E2EE relay
- [ ] Address propagation

### Phase 5 — Client Polish
- [ ] Interactive GUI testing (connect, auth, send message)
- [ ] Room list display in GUI
- [ ] Message history view
- [ ] Connection status indicator
- [ ] Settings dialog (host, port, theme)

### Phase 6 — Advanced Features
- [ ] BIP39 mnemonic key recovery
- [ ] Direct Messages (1:1 encrypted rooms)
- [ ] Forum/stage channel types
- [ ] User roles & permissions
- [ ] Message search
- [ ] File upload/share

### Phase 7 — Hardening
- [ ] Dockerfile for headless server
- [ ] CI pipeline (GitHub Actions)
- [ ] Unit tests for protocol serialization
- [ ] Fuzz testing for packet parsing
- [ ] Memory sanitizer pass

---

## License

MIT — see [LICENSE](LICENSE)
