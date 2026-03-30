export interface ChannelMeta {
  id: string;
  name: string;
  topic?: string;
  position: number;
  channel_type: 'text' | 'voice' | 'category';
  parent_id?: string;
  created_at: number;
  created_by: string;
}

export interface RoleMeta {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  hoist: boolean;
  managed: boolean;
}

export interface ServerMeta {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  owner_id: string;
  region: string;
  max_presences: number;
  max_members: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

export interface UserPresence {
  user_id: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  status_text?: string;
  status_emoji?: string;
  last_seen: number;
}

export interface InviteInfo {
  code: string;
  server_id: string;
  created_by: string;
  max_uses?: number;
  uses: number;
  expires_at?: number;
  temporary: boolean;
}

export interface ServerCapabilities {
  version: string;
  features: string[];
  server_pubkey: string;
  server_id: string;
}

export interface ServerInfo {
  name: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  server_id: string;
  channels: ChannelMeta[];
  roles: RoleMeta[];
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  server_id: string;
  uptime_seconds: number;
}

export const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 'CREATE_INSTANT_INVITE',
  KICK_MEMBERS: 'KICK_MEMBERS',
  BAN_MEMBERS: 'BAN_MEMBERS',
  MANAGE_ROLES: 'MANAGE_ROLES',
  MANAGE_CHANNELS: 'MANAGE_CHANNELS',
  MANAGE_SERVER: 'MANAGE_SERVER',
  READ_MESSAGES: 'READ_MESSAGES',
  SEND_MESSAGES: 'SEND_MESSAGES',
  SEND_TTS_MESSAGES: 'SEND_TTS_MESSAGES',
  MANAGE_MESSAGES: 'MANAGE_MESSAGES',
  EMBED_LINKS: 'EMBED_LINKS',
  ATTACH_FILES: 'ATTACH_FILES',
  READ_MESSAGE_HISTORY: 'READ_MESSAGE_HISTORY',
  MENTION_EVERYONE: 'MENTION_EVERYONE',
  USE_EXTERNAL_EMOJIS: 'USE_EXTERNAL_EMOJIS',
  CONNECT: 'CONNECT',
  SPEAK: 'SPEAK',
  MUTE_MEMBERS: 'MUTE_MEMBERS',
  DEAFEN_MEMBERS: 'DEAFEN_MEMBERS',
  MOVE_MEMBERS: 'MOVE_MEMBERS',
  USE_VOICE_ACTIVITY: 'USE_VOICE_ACTIVITY',
  CHANGE_NICKNAME: 'CHANGE_NICKNAME',
  MANAGE_NICKNAMES: 'MANAGE_NICKNAMES',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
