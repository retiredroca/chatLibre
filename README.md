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
- *(Planned)* Threaded replies
- *(Planned)* Direct Messages with forward-secret key exchange

### Server Management
- Create and manage your own rooms
- **Discord template import** — Import server structure from Discord templates
- *(Planned)* Role-based permissions and invites

### Federation
- Self-host your own server in minutes
- *(Planned)* Bitcoin-style peer discovery (DNS seeds + addr protocol)
- *(Planned)* Cross-server message relay via public key exchange

### Voice
- *(Planned)* Low-latency voice channels via server-relayed encrypted Opus over UDP
- *(Planned)* Mute/deafen controls
- No WebRTC, no STUN/TURN required

---

## Quick Start

### Prerequisites
| Platform | Compiler | Package Manager |
|----------|----------|----------------|
| **Windows** | MSVC 2026 Build Tools | vcpkg (`x64-windows`) |
| **Linux** | GCC 14+ or Clang 18+ | vcpkg or distro packages |
| **macOS** | Apple Clang 16+ (Xcode 16+) | vcpkg or Homebrew |

Dependencies (installed automatically by vcpkg): Boost.Beast, libsodium, Opus, SDL2, Dear ImGui.

### Build with vcpkg (all platforms)

```bash
# Install vcpkg if needed
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg && bootstrap-vcpkg.sh   # Linux/macOS, or bootstrap-vcpkg.bat on Windows

# Build chatLibre
cmake -B build -S . \
  -DCMAKE_TOOLCHAIN_FILE="path/to/vcpkg/scripts/buildsystems/vcpkg.cmake"
cmake --build build --config Release
```

On Windows, pass `-DVCPKG_TARGET_TRIPLET=x64-windows` to CMake.

On Windows, copy `opus.dll` to the build output for the client:
```bash
cp /c/Users/.../vcpkg/installed/x64-windows/bin/opus.dll build/Release/
```

Run the protocol test to verify the build:
```bash
# Start server, then:
./build/Release/protocol-test      # Linux/macOS
.\build\Release\protocol-test.exe  # Windows
```

### Build with system packages (Linux)

```bash
# Debian/Ubuntu
sudo apt install build-essential cmake libboost-dev libsodium-dev \
  libopus-dev libsdl2-dev

# Fedora
sudo dnf install gcc-c++ cmake boost-devel libsodium-devel \
  opus-devel SDL2-devel

# Arch
sudo pacman -S base-devel cmake boost libsodium opus sdl2

cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

### Build with system packages (macOS)

```bash
brew install cmake boost libsodium opus sdl2
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

### Run Server

```bash
./build/Release/chatlibre-server     # Linux/macOS
.\build\Release\chatlibre-server.exe  # Windows
```

The server automatically creates an Ed25519 identity at `~/.chatlibre/identity.bin` on first launch.

### Run with Docker

```bash
docker build -t chatlibre-server .
docker run -d -p 9733:9733 -v chatlibre-data:/root/.chatlibre chatlibre-server
```

### Run Client

```bash
./build/Release/chatlibre-client      # Linux/macOS
.\build\Release\chatlibre-client.exe  # Windows
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
├── Dockerfile
├── tests/
│   └── protocol_test.cpp
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md
```

---

## Design Principles

- **Minimal abstractions** — No virtual dispatch, no RAII wrappers beyond necessity
- **Zero-copy hot path** — Binary protocol parsed in-place from WebSocket buffer
- **Pure relay server** — No plaintext messages stored on disk or in memory
- **Flat if/else routing** — Single dispatch function per packet type, no state machines
- **All crypto inline** — Direct libsodium C API calls, no wrapper layer

---

## Cryptographic Design

- **Identity**: Ed25519 keypairs (BIP39 mnemonic recovery)
- **Key Exchange**: X25519 key exchange per session
- **Message Encryption**: XSalsa20-Poly1305 (secretbox)
- **File Encryption**: Per-file XChaCha20-Poly1305 with header magic *(stub)*
- **Signatures**: Ed25519 for server identity and message authentication
- **Channel Binding**: X25519 shared secret derived per (client x25519_pk, server x25519_sk)

---

## Security

- No plaintext messages on servers (pure relay)
- No account databases
- No message metadata correlation
- No third-party dependencies that phone home

---

## Roadmap

### Phase 1 — Core Protocol (Complete)
- [x] Server identity & listener
- [x] Client identity & WebSocket connection
- [x] Ed25519 auth handshake
- [x] X25519 session key exchange
- [x] Secretbox message encryption/relay
- [x] Binary wire protocol
- [x] Protocol test suite

### Phase 2 — E2EE Messaging (Complete)
- [x] Send/receive encrypted messages
- [x] Server relays ciphertext to room members
- [x] Room create/list/join/leave
- [x] Room list display in GUI
- [x] Message display (filtered by room)
- [x] Message send from GUI

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
- [x] Room list display in GUI
- [x] Message send from GUI
- [x] Message display (filtered by room)
- [ ] Connection status indicator
- [ ] Settings dialog (theme)

### Phase 6 — Advanced Features
- [ ] BIP39 mnemonic key recovery
- [ ] Direct Messages (1:1 encrypted rooms)
- [ ] Forum/stage channel types
- [ ] User roles & permissions
- [ ] Message search
- [ ] File upload/share

### Phase 7 — Hardening
- [x] Dockerfile for headless server
- [x] CI pipeline (GitHub Actions)
- [ ] Unit tests for protocol serialization
- [ ] Fuzz testing for packet parsing
- [ ] Memory sanitizer pass

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE)
