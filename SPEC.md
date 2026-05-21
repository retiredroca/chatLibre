# chatLibre — Specification v1.0.0

**C++23 implementation — Boost.Beast + libsodium + SDL2/ImGui**

---

## 1. Architecture

```
┌─────────────────────────────────────────────┐
│                 chatLibre                     │
├─────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │   Server (C++23) │  │  Client (C++23)  │ │
│  │                  │  │                  │ │
│  │  WebSocket relay │  │  SDL2 + ImGui    │ │
│  │  Pure stateless  │  │  E2EE messages   │ │
│  │  3-thread ASIO   │  │  Binary protocol │ │
│  └────────┬─────────┘  └────────┬─────────┘ │
│           │                     │            │
│           └─────────────────────┘            │
│                  Binary WS                   │
└─────────────────────────────────────────────┘
```

### Key Design Decisions

- **Single binary wire protocol** — 9-byte header (type + lengths), no JSON, no MessagePack
- **Stateless server** — No message storage, no databases, pure relay
- **Inline functions over classes** — All handlers are `inline` functions in headers, zero virtual dispatch
- **Flat dispatch** — Single `switch` on packet type byte, no state machines
- **Thread pool ASIO** — 3 worker threads on server, 1 background thread on client

---

## 2. Protocol

### 2.1 Transport

- WebSocket (TCP) for messaging
- Binary frames only (`ws.binary(true)`) — all payloads are opaque byte sequences
- Default server port: 9733

### 2.2 Packet Format

```
┌─────────┬──────────────┬──────────────┐
│ 1 byte  │  4 bytes     │  4 bytes     │  = 9-byte header
│  type   │  sender_len  │  payload_len │
├─────────┴──────────────┴──────────────┤
│  sender_id (sender_len bytes)          │
├───────────────────────────────────────┤
│  payload (payload_len bytes)           │
└───────────────────────────────────────┘
```

All integers are big-endian. `PacketHeader::HEADER_SIZE = 9`.

### 2.3 Packet Types

| Code | Direction | Name | Purpose |
|------|-----------|------|---------|
| 0x01 | C→S | CS_AUTH | Auth challenge request / signed response |
| 0x02 | C→S | CS_SEND_MESSAGE | Encrypted message to room |
| 0x03 | C→S | CS_CREATE_ROOM | Create a new room |
| 0x04 | C→S | CS_JOIN_ROOM | Join an existing room |
| 0x05 | C→S | CS_LEAVE_ROOM | Leave a room |
| 0x06 | C→S | CS_RELAY_REQUEST | Cross-server relay request |
| 0x07 | C→S | CS_PEER_DISCOVERY | Announce peer address |
| 0x08 | C→S | CS_VOICE_OFFER | Voice channel offer |
| 0x09 | C→S | CS_REQUEST_KEY | Request user's public key |
| 0x0A | C→S | CS_DISCORD_IMPORT | Import Discord template |
| 0x0B | C→S | CS_ADD_REACTION | Add message reaction |
| 0x0C | C→S | CS_INVITE_USER | Invite user to room |
| 0x0D | C→S | CS_SET_ROLE | Set user role |
| 0x0E | C→S | CS_GET_HISTORY | Request message history |
| 0x0F | C→S | CS_LIST_ROOMS | Request room list |
| 0x81 | S→C | SC_AUTH_OK | Auth success + server identity |
| 0x82 | S→C | SC_ROOM_LIST | Room list response |
| 0x83 | S→C | SC_MESSAGE | Relayed chat message |
| 0x84 | S→C | SC_SYSTEM_MSG | System notification |
| 0x85 | S→C | SC_RELAY_RESPONSE | Cross-server relay result |
| 0x86 | S→C | SC_PEER_LIST | Peer address list |
| 0x87 | S→C | SC_VOICE_ANSWER | Voice channel answer |
| 0x88 | S→C | SC_KEY_RESPONSE | Public key response |
| 0x89 | S→C | SC_REACTION | Reaction broadcast |
| 0xFF | S→C | SC_ERROR | Error message |

### 2.4 Auth Flow

```
Client                  Server
  │                       │
  │──── WebSocket ───────►│  Connect, HTTP upgrade
  │                       │
  │◄── CS_AUTH (chal) ────│  Server sends 32-byte random challenge
  │                       │
  │──── CS_AUTH (resp) ──►│  Client signs (challenge || ed25519_pk)
  │                       │  Server verifies signature
  │                       │  Derives X25519 session key
  │◄── SC_AUTH_OK ────────│  Server sends its ed25519_pk (base64)
  │                       │
  │── CS_LIST_ROOMS ──────►│  Client requests room list
  │◄── SC_ROOM_LIST ──────│  Server responds
```

After auth, the client derives the session key:
```
server_x25519 = crypto_sign_ed25519_pk_to_curve25519(server_ed25519_pk)
session_key  = crypto_kx_client(client_x25519_pk, client_x25519_sk, server_x25519)
```

### 2.5 Message Format (ChatMessagePayload)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 24 | Nonce (XSalsa20-Poly1305 nonce) |
| 24 | 4 | Encrypted body length (big-endian) |
| 28 | N | Encrypted body (ciphertext + MAC) |
| 28+N | 32 | Room ID |
| 60+N | 4 | Timestamp (Unix seconds, big-endian) |

### 2.6 Room Info Format (SC_ROOM_LIST payload)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | Room count (big-endian) |
| 4 | * | RoomInfo entries |

Each RoomInfo entry:

| Offset | Size | Field |
|--------|------|-------|
| 0 | 32 | Room ID |
| 32 | 4 | Name length (big-endian) |
| 36 | N | Name (UTF-8) |
| 36+N | 1 | Encrypted flag |
| 37+N | 4 | Member count (big-endian) |

---

## 3. Cryptography

| Operation | Algorithm | libsodium API |
|-----------|-----------|---------------|
| Identity | Ed25519 | `crypto_sign_keypair` |
| Key exchange | X25519 (via Ed25519 conversion) | `crypto_sign_ed25519_sk_to_curve25519` + `crypto_kx_*` |
| Message encryption | XSalsa20-Poly1305 | `crypto_secretbox_easy` |
| Signatures | Ed25519 | `crypto_sign_detached` |
| Random bytes | CSPRNG | `randombytes_buf` |
| Hashing | SHA-256 | `crypto_hash_sha256` |
| Key derivation | BLAKE2B (via `crypto_kx_*`) | Internal to `crypto_kx_*` |

### 3.1 Identity Format

Stored as 160 bytes in `identity.bin`:

| Offset | Size | Field |
|--------|------|-------|
| 0 | 64 | Ed25519 secret key |
| 64 | 32 | Ed25519 public key |
| 96 | 32 | X25519 secret key |
| 128 | 32 | X25519 public key |

The X25519 keys are derived from Ed25519 keys via `crypto_sign_ed25519_sk_to_curve25519` / `crypto_sign_ed25519_pk_to_curve25519`.

### 3.2 Session Key Exchange

Uses `crypto_kx_*`:
- Client: `crypto_kx_client_session_keys(rx, tx, client_pk, client_sk, server_pk)` → returns `rx`
- Server: `crypto_kx_server_session_keys(rx, tx, server_pk, server_sk, client_pk)` → returns `tx`

Where `client_rx == server_tx`, giving both sides the same symmetric key.

---

## 4. Project Structure

```
chatlibre/
├── src/
│   ├── main.cpp               # Server entry point
│   ├── crypto.hpp             # libsodium wrappers (all inline)
│   ├── identity.hpp           # Ed25519 keypair load/create
│   ├── protocol.hpp           # Binary packet format + message structs
│   ├── server.hpp             # ServerState, Session, accept loop
│   ├── ws.hpp                 # WebSocket packet dispatch (handle_packet)
│   ├── http.hpp               # REST endpoint helpers (stub)
│   ├── federation.hpp         # Peer discovery + relay stubs
│   ├── storage.hpp            # Encrypted file on disk
│   ├── voice.hpp              # Opus/UDP voice relay
│   ├── ratelimit.hpp          # Token-bucket rate limiter
│   └── client/
│       ├── main.cpp           # SDL2+ImGui entry point
│       ├── app.hpp            # ClientState, ChatEvent queue
│       ├── gui.hpp            # ImGui rendering (rooms, messages, input)
│       ├── network.hpp        # WebSocket connect, auth, read loop
│       ├── discord_import.hpp # Discord template JSON scanner
│       ├── imgui_impl_sdl2.cpp
│       └── imgui_impl_opengl3.cpp
├── tests/
│   └── protocol_test.cpp      # Full auth + room + message test
├── CMakeLists.txt             # Build config (vcpkg)
├── Dockerfile                 # Multi-stage server build
├── .github/workflows/ci.yml   # GitHub Actions CI
├── README.md                  # Quick start + roadmap
└── SPEC.md                    # This file
```

---

## 5. Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Boost.Beast | ≥1.83 | WebSocket client/server |
| libsodium | ≥1.0.18 | All cryptographic operations |
| Opus | ≥1.4 | Voice codec |
| SDL2 | ≥2.30 | Window, input, OpenGL context |
| Dear ImGui | ≥1.91 | GUI rendering |

All managed via vcpkg. Boost.Beast is header-only.

---

## 6. Implementation Status

### Complete
- Server identity (Ed25519) creation and loading
- WebSocket listener (3-thread ASIO pool)
- Client identity (Ed25519 + X25519) creation and loading
- Client WebSocket connection + binary mode
- Auth handshake (challenge → sign → verify → session key)
- X25519 session key derivation (crypto_kx)
- Secretbox message encryption/decryption
- Message relay to room members
- Room create, list, join, leave
- Room list display in GUI
- Message display (filtered by room)
- Message send from GUI
- Binary wire protocol (all packet types defined)
- Rate limiting (token bucket)
- Discord template import scanner
- File encryption stubs (on-disk .enc format)
- Dockerfile (multi-stage server build)
- GitHub Actions CI pipeline (Linux/macOS/Windows)
- Protocol test suite (auth + room + message)

### Implemented, Untested
- Voice channels (Opus encode/decode, UDP relay)
- Federation (peer discovery + cross-server relay)
- Message reactions

### Not Implemented
- Threaded replies
- Message edit/delete
- Message history
- Direct Messages (1:1 rooms)
- User roles/permissions
- User invites
- BIP39 mnemonic recovery
- Forum/stage channel types

---

## 7. Build & Run

See `README.md` for full build instructions per platform.

Quick summary:
```bash
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build
./build/chatlibre-server --port 9733   # start server
./build/chatlibre-client               # start client (requires display)
./build/protocol-test                  # run protocol test
```

---

## 8. Security Model

- **No plaintext on server** — Server only sees encrypted blobs; all decryption is client-side
- **No accounts** — Ed25519 keypair is the sole credential; no passwords, no email
- **No databases** — Server stores only ephemeral room state in memory (room list, member list)
- **Forward secrecy** — Session key derived per-connection via X25519; no long-term message key
- **Perfect forward secrecy** — Compromise of long-term key does not expose past sessions (session key derived fresh each connection)
- **No metadata correlation** — Server only sees ciphertext; cannot determine message content, file content, or attachment plaintext

---

## 9. License

MIT
