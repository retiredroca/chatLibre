import { useState, useRef, useEffect } from 'react';
import { useMessageStore, Message } from '../../stores/messageStore';
import { useServerStore, Server } from '../../stores/serverStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useIdentityStore } from '../../stores/identityStore';

export function MessageInput() {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { currentServerId, servers } = useServerStore();
  const { editingMessageId, setEditingMessage, updateMessage } = useMessageStore();
  const { sendMessage: sendEncryptedMessage, isConnected } = useWebSocket('');
  
  const currentServer = servers.find(s => s.id === currentServerId);
  const selectedChannelId = currentServer?.selectedChannelId;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedChannelId || !isConnected) return;

    setIsSending(true);
    try {
      if (editingMessageId) {
        updateMessage(selectedChannelId, editingMessageId, content);
        setEditingMessage(null);
      } else {
        await sendEncryptedMessage(selectedChannelId, content);
      }
      setContent('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape' && editingMessageId) {
      setEditingMessage(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="bg-[#383B42] rounded-md flex items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={editingMessageId ? 'Edit message...' : `Message ${currentServer?.name || ''}`}
          className="flex-1 bg-transparent text-[#E6EDF3] p-3 resize-none outline-none placeholder-[#6E7681] min-h-[44px] max-h-[200px]"
          disabled={!isConnected}
        />
        <button
          type="submit"
          disabled={!content.trim() || !isConnected || isSending}
          className="p-3 text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
      {editingMessageId && (
        <div className="flex items-center gap-2 mt-2 text-sm text-[#8B949E]">
          <span>Editing message</span>
          <button
            type="button"
            onClick={() => setEditingMessage(null)}
            className="text-[#58A6FF] hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}

export function MessageList() {
  const { currentServerId, servers } = useServerStore();
  const { messages } = useMessageStore();
  
  const currentServer = servers.find((s: Server) => s.id === currentServerId);
  const channelId = currentServer?.selectedChannelId;
  const channelMessages = channelId ? messages[channelId] || [] : [];

  const groupedMessages = channelMessages.reduce<Record<string, Message[]>>((groups, message) => {
    const date = new Date(message.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {Object.entries(groupedMessages).map(([date, msgs]: [string, Message[]]) => (
        <div key={date}>
          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-[#383B42]" />
            <span className="px-3 text-xs text-[#8B949E]">{date}</span>
            <div className="flex-1 h-px bg-[#383B42]" />
          </div>
          {msgs.map((message: Message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </div>
      ))}
      {channelMessages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-[#8B949E]">
          <span className="text-4xl mb-4">🔒</span>
          <p>Messages in this channel are end-to-end encrypted.</p>
          <p className="text-sm">Only participants can read them.</p>
        </div>
      )}
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  const { setEditingMessage, starMessage, addReaction } = useMessageStore();
  const { userId } = useIdentityStore();
  const [showActions, setShowActions] = useState(false);

  const handleEdit = () => {
    setEditingMessage(message.id);
  };

  const handleStar = () => {
    starMessage(message.channelId, message.id, !message.isStarred);
  };

  const handleReaction = () => {
    addReaction(message.channelId, message.id, '😀', userId);
  };

  return (
    <div
      className="group flex gap-4 p-2 rounded hover:bg-[#1C1F24] relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="w-10 h-10 rounded-full bg-[#58A6FF] flex items-center justify-center text-white font-medium">
        {message.senderKey.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[#E6EDF3]">
            {message.senderName || `User ${message.senderKey.slice(0, 8)}`}
          </span>
          <span className="text-xs text-[#8B949E]">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.isEdited && (
            <span className="text-xs text-[#8B949E]">(edited)</span>
          )}
        </div>
        <p className="text-[#E6EDF3] whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1">
            {message.reactions.map((reaction: { emoji: string; count: number }, i: number) => (
              <button
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#2D333B] rounded-full text-sm hover:bg-[#363C44]"
              >
                <span>{reaction.emoji}</span>
                <span className="text-[#8B949E]">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {showActions && (
        <div className="absolute right-2 top-2 flex gap-1 bg-[#2D333B] rounded-md overflow-hidden">
          <button
            onClick={handleStar}
            className={`p-1.5 hover:bg-[#363C44] ${message.isStarred ? 'text-[#D29922]' : 'text-[#8B949E]'}`}
            title="Star message"
          >
            ★
          </button>
          <button
            onClick={handleReaction}
            className="p-1.5 hover:bg-[#363C44] text-[#8B949E]"
            title="Add reaction"
          >
            😀
          </button>
          {message.senderKey === userId && (
            <button
              onClick={handleEdit}
              className="p-1.5 hover:bg-[#363C44] text-[#8B949E]"
              title="Edit message"
            >
              ✏️
            </button>
          )}
        </div>
      )}
    </div>
  );
}
