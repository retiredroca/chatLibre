import { create } from 'zustand';

export interface Message {
  id: string;
  channelId: string;
  senderKey: string;
  senderName?: string;
  content: string;
  timestamp: number;
  isStarred: boolean;
  replyTo?: string;
  threadId?: string;
  reactions: Reaction[];
  isEdited?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  userKeys: string[];
}

interface MessageState {
  messages: Record<string, Message[]>;
  pendingMessages: Set<string>;
  editingMessageId: string | null;
}

interface MessageActions {
  addMessage: (channelId: string, message: Message) => void;
  updateMessage: (channelId: string, messageId: string, content: string) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  starMessage: (channelId: string, messageId: string, starred: boolean) => void;
  addReaction: (channelId: string, messageId: string, emoji: string, userKey: string) => void;
  removeReaction: (channelId: string, messageId: string, emoji: string, userKey: string) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  clearMessages: (channelId: string) => void;
  setEditingMessage: (messageId: string | null) => void;
}

export const useMessageStore = create<MessageState & MessageActions>()((set) => ({
  messages: {},
  pendingMessages: new Set(),
  editingMessageId: null,

  addMessage: (channelId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] || []), message],
      },
    })),

  updateMessage: (channelId, messageId, content) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, content, isEdited: true } : m
        ),
      },
    })),

  deleteMessage: (channelId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).filter((m) => m.id !== messageId),
      },
    })),

  starMessage: (channelId, messageId, starred) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, isStarred: starred } : m
        ),
      },
    })),

  addReaction: (channelId, messageId, emoji, userKey) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) => {
          if (m.id !== messageId) return m;
          
          const existingReaction = m.reactions.find((r) => r.emoji === emoji);
          if (existingReaction) {
            if (existingReaction.userKeys.includes(userKey)) return m;
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, userKeys: [...r.userKeys, userKey] }
                  : r
              ),
            };
          }
          return {
            ...m,
            reactions: [...m.reactions, { emoji, count: 1, userKeys: [userKey] }],
          };
        }),
      },
    })),

  removeReaction: (channelId, messageId, emoji, userKey) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: m.reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, userKeys: r.userKeys.filter((k) => k !== userKey) }
                  : r
              )
              .filter((r) => r.count > 0),
          };
        }),
      },
    })),

  setMessages: (channelId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: messages,
      },
    })),

  prependMessages: (channelId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...messages, ...(state.messages[channelId] || [])],
      },
    })),

  clearMessages: (channelId) =>
    set((state) => {
      const { [channelId]: _, ...rest } = state.messages;
      return { messages: rest };
    }),

  setEditingMessage: (messageId) =>
    set({ editingMessageId: messageId }),
}));
