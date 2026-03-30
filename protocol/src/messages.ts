import { ChannelMeta, RoleMeta, ServerMeta, UserPresence, InviteInfo } from './types';

export * from './types';

export interface ClientMessage {
  id: string;
  version: number;
  timestamp: number;
  sender: string;
  type: string;
  payload: unknown;
}

export interface ServerMessage {
  id: string;
  version: number;
  timestamp: number;
  sender: string;
  type: string;
  payload: unknown;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  sender_key: string;
  recipient_key?: string;
  signature: string;
}

export interface ChatMessage {
  type: 'chat.message';
  channel_id: string;
  ciphertext: string;
  nonce: string;
  reply_to?: string;
  thread_id?: string;
}

export interface ChatEdit {
  type: 'chat.edit';
  channel_id: string;
  message_id: string;
  ciphertext: string;
  nonce: string;
}

export interface ChatDelete {
  type: 'chat.delete';
  channel_id: string;
  message_id: string;
}

export interface ChatReaction {
  type: 'chat.reaction';
  channel_id: string;
  message_id: string;
  emoji: string;
  action: 'add' | 'remove';
}

export interface ChannelCreate {
  type: 'channel.create';
  name: string;
  topic?: string;
  channel_type: 'text' | 'voice';
}

export interface ChannelUpdate {
  type: 'channel.update';
  channel_id: string;
  name?: string;
  topic?: string;
}

export interface ChannelDelete {
  type: 'channel.delete';
  channel_id: string;
}

export interface PresenceUpdate {
  type: 'presence.update';
  status: 'online' | 'idle' | 'dnd' | 'offline';
}

export interface SyncRequest {
  type: 'sync.request';
  since?: number;
  channel_id?: string;
}

export type InboundMessage =
  | ChatMessage
  | ChatEdit
  | ChatDelete
  | ChatReaction
  | ChannelCreate
  | ChannelUpdate
  | ChannelDelete
  | PresenceUpdate
  | SyncRequest;

export interface ChatMessageReceived {
  type: 'chat.message';
  id: string;
  channel_id: string;
  sender: string;
  ciphertext: string;
  nonce: string;
  timestamp: number;
  reply_to?: string;
  thread_id?: string;
}

export interface ChatEditReceived {
  type: 'chat.edit';
  channel_id: string;
  message_id: string;
  ciphertext: string;
  nonce: string;
  timestamp: number;
}

export interface ChatDeleteReceived {
  type: 'chat.delete';
  channel_id: string;
  message_id: string;
  timestamp: number;
}

export interface ReactionReceived {
  type: 'chat.reaction';
  channel_id: string;
  message_id: string;
  emoji: string;
  user_key: string;
  action: 'add' | 'remove';
}

export interface ChannelListReceived {
  type: 'channel.list';
  channels: ChannelMeta[];
}

export interface SyncResponseReceived {
  type: 'sync.response';
  channels: ChannelMeta[];
  pinned_messages: PinnedMessage[];
  timestamp: number;
}

export interface ErrorReceived {
  type: 'error';
  code: string;
  message: string;
}

export type OutboundMessage =
  | ChatMessageReceived
  | ChatEditReceived
  | ChatDeleteReceived
  | ReactionReceived
  | ChannelListReceived
  | SyncResponseReceived
  | ErrorReceived;

export interface PinnedMessage {
  id: string;
  channel_id: string;
  encrypted_blob: string;
  pinned_by: string;
  pinned_at: number;
}

export interface FederationMessage {
  action: 'trust_request' | 'trust_confirm' | 'trust_revoke';
  server_pubkey: string;
  signature: string;
}

export interface FederationResponse {
  status: 'pending_approval' | 'established' | 'revoked';
  message?: string;
  server_pubkey?: string;
  signature: string;
}

export interface RelayRequest {
  source_server: string;
  target_server: string;
  encrypted_payload: string;
  signature: string;
  forward: boolean;
}
