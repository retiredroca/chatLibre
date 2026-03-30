# Federation Protocol

## Overview

chatLibre federation allows servers to relay encrypted messages between each other, enabling cross-server communication while maintaining end-to-end encryption.

## Federation Model

Unlike Matrix's complex federation (with its own homeserver network, delegation, and CS API), chatLibre uses a simple trust-based federation:

1. Server operators exchange public keys out-of-band (or via discovery)
2. Servers mutually add each other to their trust list
3. Once trusted, servers relay encrypted payloads bidirectionally
4. No server ever decrypts or stores message content

## Federation States

```
    ┌─────────────┐
    │   Unknown   │
    └──────┬──────┘
           │
           │ Exchange public keys + manual approval
           ▼
    ┌─────────────┐
    │   Pending   │ (Awaiting admin approval on target server)
    └──────┬──────┘
           │
           │ Admin approves
           ▼
    ┌─────────────┐
    │   Trusted   │ (Bidirectional relay enabled)
    └──────┬──────┘
           │
           │ Either party revokes
           ▼
    ┌─────────────┐
    │   Revoked   │
    └─────────────┘
```

## Protocol Flow

### 1. Capability Discovery

Before federation, servers exchange capabilities:

```
GET /capabilities
```

Response:
```json
{
  "version": "1.0",
  "features": ["e2ee", "federation", "voice", "threads"],
  "server_pubkey": "-----BEGIN ED25519-----\n...\n-----END ED25519-----",
  "server_id": "kf_abc123..."
}
```

### 2. Trust Establishment

Two-step handshake:

**Step 1: Trust Request** (from Server A to Server B)
```json
POST /federation/handshake
{
  "action": "trust_request",
  "server_pubkey": "-----BEGIN ED25519-----\n<Server A's public key>\n-----END ED25519-----",
  "signature": "<Ed25519 signature of action + timestamp>"
}
```

Server B's admin reviews the request and decides whether to approve.

**Step 2: Trust Confirm** (from Server B to Server A)
```json
POST /federation/handshake
{
  "action": "trust_confirm",
  "server_pubkey": "-----BEGIN ED25519-----\n<Server B's public key>\n-----END ED25519-----",
  "signature": "<Ed25519 signature of action + timestamp>"
}
```

Server A automatically trusts Server B upon receiving confirmation.

### 3. Message Relay

Once federated, messages flow like this:

```
User A (Server A) ──► User B (Server A)   : Direct relay
User A (Server A) ──► User C (Server B)   : Cross-server relay via federation
```

**Cross-server relay format:**
```json
POST /federation/relay
{
  "source_server": "kf_serverA...",
  "target_server": "kf_serverB...",
  "encrypted_payload": "<base64-encoded encrypted message>",
  "signature": "<Server A's signature>",
  "forward": true
}
```

Server B verifies:
1. Signature from trusted server
2. Payload is valid encrypted blob
3. Target user exists on Server B

Then delivers to User C via WebSocket.

## Server Discovery

### Manual Addition (Recommended)

```bash
# Admin of Server A adds Server B manually:
curl -X POST https://serverA.com/admin/federation/add \
  -H "Content-Type: application/json" \
  -d '{"server_url": "https://serverB.com", "server_pubkey": "-----BEGIN..."}'
```

### Discovery Protocol (Future)

A lightweight discovery system:

```
GET /.well-known/chatlibre/server
```

Response:
```json
{
  "server_id": "kf_abc123...",
  "capabilities_url": "https://serverB.com/capabilities",
  "federation_port": 443
}
```

## Federation Security

### Trust Model

- Servers trust each other's **public keys**, not domains
- DNS changes don't affect trust (no TOFU)
- Trust revocation is immediate and permanent
- Compromised keys require new keypair generation

### Signature Verification

Every federation message must include:
1. The sender's public key
2. A signature over the message content
3. A timestamp to prevent replay attacks

### What Servers Verify

- ✅ Signature validity
- ✅ Sender is in trust list
- ✅ Message format is valid
- ✅ Timestamp is recent (within 5 minutes)
- ❌ Message content (encrypted)
- ❌ Sender's identity (verified client-side)

## Federation Limits

To prevent abuse:

| Limit | Value |
|-------|-------|
| Max trusted servers | 100 (configurable) |
| Max pending requests | 10 |
| Relay rate limit | 100 msg/min per server |
| Request timeout | 30 seconds |

## Federation API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/capabilities` | Get server capabilities and public key |
| GET | `/info` | Get server metadata |
| POST | `/federation/handshake` | Federation handshake |
| POST | `/federation/relay` | Relay message to federated server |
| GET | `/federation/list` | List trusted servers (admin only) |
| DELETE | `/federation/revoke/:server_id` | Revoke federation (admin only) |

### Error Codes

| Code | Meaning |
|------|---------|
| `TRUST_NOT_ESTABLISHED` | Server not in trust list |
| `INVALID_SIGNATURE` | Signature verification failed |
| `TIMESTAMP_EXPIRED` | Message too old |
| `SERVER_NOT_FOUND` | Unknown server ID |
| `RATE_LIMITED` | Too many requests |

## Federation with Matrix

chatLibre is not compatible with Matrix federation out of the box. However, a bridge could be developed:

```
chatLibre ◄──────► Matrix Bridge ◄──────► Matrix Server
   │                   │                      │
   │  chatLibre E2EE    │  Matrix CS API       │  Matrix Federation
   │  WebSocket        │  (unencrypted)       │  (Matrix protocol
   │                   │                      │   + HS federation)
   ▼                   ▼                      ▼
```

The bridge would:
1. Implement chatLibre federation on one side
2. Implement Matrix client-server API on the other
3. Translate between encrypted formats
4. Handle identity mapping (Ed25519 ↔ Matrix ID)

This is a future project, not in initial scope.

## Federation Best Practices

1. **Verify Keys Manually**: Don't trust discovery alone for production
2. **Start Small**: Federate with a few trusted servers first
3. **Monitor Activity**: Log federation traffic for anomalies
4. **Keep Keys Secure**: Server's Ed25519 private key is critical
5. **Backup Trust List**: Store trusted server keys in backup location
