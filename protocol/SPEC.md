# chatLibre Protocol Specification

**Version:** 1.0.0  
**Status:** Draft

## Overview

This document defines the chatLibre protocol for federated, end-to-end encrypted communication.

## Terminology

| Term | Definition |
|------|------------|
| Client | User's application (desktop/web) |
| Server | Relay server (stateless message relay) |
| User ID | `kf_` prefix + base58-encoded public key |
| Server ID | `kf_` prefix + base58-encoded server public key hash |
| Channel | Virtual space for communication (text/voice) |

## Message Types

### Client → Server (WebSocket)

```typescript
// Chat message
{
  "type": "chat.message",
  "channel_id": string,
  "ciphertext": string,      // Base64-encoded encrypted content
  "nonce": string,           // Base64-encoded nonce
  "reply_to"?: string,       // Message ID
  "thread_id"?: string        // Thread ID
}

// Message edit
{
  "type": "chat.edit",
  "channel_id": string,
  "message_id": string,
  "ciphertext": string,
  "nonce": string
}

// Message delete
{
  "type": "chat.delete",
  "channel_id": string,
  "message_id": string
}

// Reaction
{
  "type": "chat.reaction",
  "channel_id": string,
  "message_id": string,
  "emoji": string,           // Unicode emoji or :emoji_name:
  "action": "add" | "remove"
}

// Channel create
{
  "type": "channel.create",
  "name": string,
  "topic"?: string,
  "channel_type": "text" | "voice"
}

// Channel update
{
  "type": "channel.update",
  "channel_id": string,
  "name"?: string,
  "topic"?: string
}

// Channel delete
{
  "type": "channel.delete",
  "channel_id": string
}

// Presence update
{
  "type": "presence.update",
  "status": "online" | "idle" | "dnd" | "offline"
}

// Sync request
{
  "type": "sync.request",
  "since"?: number,          // Timestamp
  "channel_id"?: string
}
```

### Server → Client (WebSocket)

```typescript
// Chat message received
{
  "type": "chat.message",
  "id": string,
  "channel_id": string,
  "sender": string,          // User public key
  "ciphertext": string,
  "nonce": string,
  "timestamp": number,
  "reply_to"?: string,
  "thread_id"?: string
}

// Message edited
{
  "type": "chat.edit",
  "channel_id": string,
  "message_id": string,
  "ciphertext": string,
  "nonce": string,
  "timestamp": number
}

// Message deleted
{
  "type": "chat.delete",
  "channel_id": string,
  "message_id": string,
  "timestamp": number
}

// Reaction update
{
  "type": "chat.reaction",
  "channel_id": string,
  "message_id": string,
  "emoji": string,
  "user_key": string,
  "action": "add" | "remove"
}

// Channel list
{
  "type": "channel.list",
  "channels": ChannelMeta[]
}

// Sync response
{
  "type": "sync.response",
  "channels": ChannelMeta[],
  "pinned_messages": PinnedMessage[],
  "timestamp": number
}

// Error
{
  "type": "error",
  "code": string,
  "message": string
}
```

### HTTP API

```typescript
// GET /capabilities
{
  "version": "1.0",
  "features": ["e2ee", "federation", "voice", "threads"],
  "server_pubkey": string,
  "server_id": string
}

// GET /info
{
  "name": string,
  "description"?: string,
  "icon_url"?: string,
  "banner_url"?: string,
  "server_id": string,
  "channels": ChannelMeta[],
  "roles": RoleMeta[]
}

// GET /health
{
  "status": "healthy" | "unhealthy",
  "version": string,
  "server_id": string,
  "uptime_seconds": number
}

// POST /federation/handshake
// Request
{
  "action": "trust_request" | "trust_confirm" | "trust_revoke",
  "server_pubkey": string,
  "signature": string
}
// Response
{
  "status": string,
  "message"?: string,
  "server_pubkey"?: string,
  "signature"?: string
}

// POST /federation/relay
// Request
{
  "source_server": string,
  "target_server": string,
  "encrypted_payload": string,  // Base64
  "signature": string,
  "forward": boolean
}
```

## Data Types

```typescript
interface ChannelMeta {
  id: string;
  name: string;
  topic?: string;
  position: number;
  type: "text" | "voice" | "category";
  parent_id?: string;
  created_at: number;
  created_by: string;
}

interface RoleMeta {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  hoist: boolean;
  managed: boolean;
}

interface PinnedMessage {
  id: string;
  channel_id: string;
  encrypted_blob: string;
  pinned_by: string;
  pinned_at: number;
}

interface EncryptedPayload {
  ciphertext: string;       // Base64
  nonce: string;            // Base64
  sender_key: string;       // Sender's public key
  recipient_key?: string;   // For DMs
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Malformed message format |
| `CHANNEL_NOT_FOUND` | Unknown channel ID |
| `UNAUTHORIZED` | Not allowed to perform action |
| `RATE_LIMITED` | Too many requests |
| `SERVER_ERROR` | Internal server error |
| `FEDERATION_UNTRUSTED` | Server not in trust list |
| `INVALID_SIGNATURE` | Signature verification failed |
| `PAYLOAD_TOO_LARGE` | Message exceeds size limit |

## Size Limits

| Item | Limit |
|------|-------|
| Message ciphertext | 64 KB |
| File attachment | 100 MB |
| Channel name | 100 chars |
| Username | 32 chars |
| Reason text | 500 chars |

## Rate Limits

| Action | Limit |
|--------|-------|
| Messages per channel | 60/minute |
| Messages per user | 120/minute |
| Channel creates | 5/hour |
| Federation requests | 10/minute |

## Connection

### WebSocket

- URL: `wss://server.com/ws`
- Protocol version: 1
- Heartbeat: 30 seconds
- Reconnection: Exponential backoff (1s, 2s, 4s, ... max 30s)

### Authentication

No traditional authentication. Identity is proven by:
1. Signing messages with private key
2. Server verifies signature using stored public key
3. New users announce public key on first connection

## Transport Encryption

While E2EE protects message content, transport encryption protects:
- Metadata (who's talking to whom)
- Connection integrity

All connections must use TLS 1.2+ (WSS/HTTPS).

## Compression

Messages may be compressed with zstd before encryption:
```typescript
{
  "compressed": true,
  "data": "base64(zstd(plaintext))"
}
```

## Extensions

Future protocol versions may add:
- Video calls
- Screen sharing
- File streaming
- Bots/integrations

Extensions use the `ext.` prefix:
```typescript
{
  "type": "ext.screen_share_offer",
  ...
}
```
