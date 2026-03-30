import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

function generateSecureId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface Server {
  id: string;
  url: string;
  name: string;
  description?: string;
  iconUrl?: string;
  publicKey: string;
  isTrusted: boolean;
  channels: Channel[];
  categories: Category[];
  roles: Role[];
  selectedChannelId: string | null;
  selectedVoiceChannelId: string | null;
  memberCount: number;
  iconColor: string;
}

export interface Channel {
  id: string;
  name: string;
  topic?: string;
  type: 'text' | 'voice' | 'announcement' | 'stage' | 'forum';
  position: number;
  categoryId?: string;
  userLimit?: number;
  bitrate?: number;
}

type DiscordChannelType = 'text' | 'voice' | 'announcement' | 'stage' | 'forum' | 'category';

export interface Category {
  id: string;
  name: string;
  position: number;
  isCollapsed: boolean;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  isHoist: boolean;
}

export interface VoiceState {
  channelId: string;
  userId: string;
  userName: string;
  isMuted: boolean;
  isDeafened: boolean;
  isStreaming: boolean;
  isVideoOn: boolean;
}

export interface DiscordTemplate {
  name: string;
  description?: string;
  channels: {
    name: string;
    type: number;
    topic?: string;
  }[];
  categories?: {
    name: string;
    channels: string[];
  }[];
}

interface ServerState {
  servers: Server[];
  currentServerId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  ws: WebSocket | null;
  voiceStates: VoiceState[];
  showCreateServer: boolean;
  showSettings: boolean;
  contextMenu: {
    show: boolean;
    x: number;
    y: number;
    type: 'server' | 'channel' | 'user' | null;
    targetId: string | null;
  };
}

interface ServerActions {
  addServer: (server: Omit<Server, 'channels' | 'categories' | 'roles' | 'selectedChannelId' | 'selectedVoiceChannelId' | 'voiceStates' | 'showCreateServer' | 'showSettings' | 'contextMenu'>) => void;
  updateServer: (serverId: string, updates: Partial<Server>) => void;
  removeServer: (serverId: string) => void;
  selectServer: (serverId: string) => void;
  setChannels: (serverId: string, channels: Channel[]) => void;
  addChannel: (serverId: string, channel: Channel) => void;
  removeChannel: (serverId: string, channelId: string) => void;
  selectChannel: (serverId: string, channelId: string) => void;
  selectVoiceChannel: (serverId: string, channelId: string | null) => void;
  addCategory: (serverId: string, category: Category) => void;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (channelId: string, ciphertext: string, nonce: string) => void;
  setShowCreateServer: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setContextMenu: (menu: ServerState['contextMenu']) => void;
  importFromDiscordTemplate: (template: DiscordTemplate, name: string, iconUrl?: string) => void;
}

const generateServerIcon = (name: string): string => {
  const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#3BA55C'];
  return colors[name.charCodeAt(0) % colors.length];
};

export const useServerStore = create<ServerState & ServerActions>()(
  persist(
    (set, get) => ({
      servers: [],
      currentServerId: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      ws: null,
      voiceStates: [],
      showCreateServer: false,
      showSettings: false,
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        type: null,
        targetId: null,
      },

      addServer: (server) =>
        set((state) => ({
          servers: [
            ...state.servers,
            {
              ...server,
              channels: [],
              categories: [],
              roles: [],
              selectedChannelId: null,
              selectedVoiceChannelId: null,
            },
          ],
        })),

      updateServer: (serverId, updates) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, ...updates } : s
          ),
        })),

      removeServer: (serverId) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== serverId),
          currentServerId: state.currentServerId === serverId ? null : state.currentServerId,
        })),

      selectServer: (serverId) =>
        set({
          currentServerId: serverId,
        }),

      setChannels: (serverId, channels) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, channels } : s
          ),
        })),

      addChannel: (serverId, channel) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, channels: [...s.channels, channel].sort((a, b) => a.position - b.position) }
              : s
          ),
        })),

      removeChannel: (serverId, channelId) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, channels: s.channels.filter((c) => c.id !== channelId) }
              : s
          ),
        })),

      selectChannel: (serverId, channelId) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, selectedChannelId: channelId, selectedVoiceChannelId: null } : s
          ),
        })),

      selectVoiceChannel: (serverId, channelId) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, selectedVoiceChannelId: channelId } : s
          ),
        })),

      addCategory: (serverId, category) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId
              ? { ...s, categories: [...s.categories, category].sort((a, b) => a.position - b.position) }
              : s
          ),
        })),

      connect: async (url) => {
        const state = get();
        if (state.ws) {
          state.ws.close();
        }

        set({ isConnecting: true, connectionError: null });

        return new Promise((resolve, reject) => {
          try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
              set({ ws, isConnected: true, isConnecting: false });
              resolve();
            };

            ws.onclose = () => {
              set({ ws: null, isConnected: false, isConnecting: false });
            };

            ws.onerror = (error) => {
              set({ connectionError: 'Connection failed', isConnecting: false });
              reject(error);
            };
          } catch (err) {
            set({ connectionError: String(err), isConnecting: false });
            reject(err);
          }
        });
      },

      disconnect: () => {
        const { ws } = get();
        if (ws) {
          ws.close();
          set({ ws: null, isConnected: false });
        }
      },

      sendMessage: (channelId, ciphertext, nonce) => {
        const { ws, currentServerId } = get();
        if (!ws || ws.readyState !== WebSocket.OPEN || !currentServerId) return;

        const message = {
          type: 'chat.message',
          channel_id: channelId,
          ciphertext,
          nonce,
          timestamp: Date.now(),
        };

        ws.send(JSON.stringify(message));
      },

      setShowCreateServer: (show) => set({ showCreateServer: show }),
      setShowSettings: (show) => set({ showSettings: show }),

      setContextMenu: (menu) => set({ contextMenu: menu }),

      importFromDiscordTemplate: (template, name, iconUrl) => {
        const id = `srv_${Date.now()}_${generateSecureId()}`;
        const categories: Category[] = [];
        const channels: Channel[] = [];

        const categoryMap = new Map<string, string>();

        if (template.categories) {
          template.categories.forEach((cat, index) => {
            const catId = `cat_${Date.now()}_${index}`;
            categoryMap.set(cat.name, catId);
            categories.push({
              id: catId,
              name: cat.name,
              position: index,
              isCollapsed: false,
            });
          });
        }

        template.channels.forEach((ch, index) => {
          const channelType: DiscordChannelType =
            ch.type === 0 ? 'text' :
            ch.type === 2 ? 'voice' :
            ch.type === 4 ? 'category' :
            ch.type === 5 ? 'announcement' :
            ch.type === 13 ? 'stage' :
            ch.type === 15 ? 'forum' : 'text';

          if (channelType === 'category') {
            const catId = `cat_${Date.now()}_${index}`;
            categoryMap.set(ch.name, catId);
            categories.push({
              id: catId,
              name: ch.name,
              position: categories.length,
              isCollapsed: false,
            });
          } else {
            channels.push({
              id: `ch_${Date.now()}_${index}`,
              name: ch.name.toLowerCase().replace(/\s+/g, '-'),
              topic: ch.topic,
              type: channelType,
              position: channels.length,
              categoryId: undefined,
            });
          }
        });

        if (template.categories) {
          template.categories.forEach((cat) => {
            channels.forEach((channel) => {
              if (cat.channels.includes(channel.name)) {
                const catId = categoryMap.get(cat.name);
                if (catId) {
                  channel.categoryId = catId;
                }
              }
            });
          });
        }

        const newServer: Server = {
          id,
          url: '',
          name: template.name || name,
          description: template.description,
          iconUrl,
          publicKey: '',
          isTrusted: false,
          channels,
          categories,
          roles: [
            {
              id: 'role_admin',
              name: 'Admin',
              color: '#ED4245',
              permissions: ['MANAGE_SERVER', 'MANAGE_CHANNELS', 'KICK_MEMBERS'],
              position: 1,
              isHoist: true,
            },
            {
              id: 'role_member',
              name: 'Member',
              color: '#5865F2',
              permissions: ['READ_MESSAGES', 'SEND_MESSAGES', 'CONNECT'],
              position: 0,
              isHoist: false,
            },
          ],
          selectedChannelId: null,
          selectedVoiceChannelId: null,
          memberCount: 1,
          iconColor: generateServerIcon(name),
        };

        set((state) => ({
          servers: [...state.servers, newServer],
          currentServerId: id,
        }));
      },
    }),
    {
      name: 'chatlibre-servers',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        servers: state.servers,
        currentServerId: state.currentServerId,
      }),
    }
  )
);
