import { useState, useEffect, useRef } from 'react';
import { useServerStore, Channel, VoiceState } from '../../stores/serverStore';
import { MessageList, MessageInput } from '../Chat/MessageList';
import { useIdentityStore } from '../../stores/identityStore';

export function MainLayout() {
  const {
    servers,
    currentServerId,
    selectServer,
    selectChannel,
    selectVoiceChannel,
    voiceStates,
    showCreateServer,
    setShowCreateServer,
    contextMenu,
    setContextMenu,
  } = useServerStore();

  const currentServer = servers.find((s) => s.id === currentServerId);

  useEffect(() => {
    const handleClick = () => setContextMenu({ show: false, x: 0, y: 0, type: null, targetId: null });
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [setContextMenu]);

  return (
    <div className="flex h-screen bg-[#010101]">
      {/* Server List (Discord-style) */}
      <div className="w-[72px] bg-[#010101] flex flex-col items-center py-3 gap-2 overflow-y-auto scrollbar-hidden">
        {/* Home Button */}
        <ServerIcon
          icon="🏠"
          isActive={currentServerId === 'home'}
          onClick={() => selectServer('home')}
          isHome
        />

        <div className="w-8 h-[2px] bg-discord-border rounded-full my-1" />

        {/* Server List */}
        {servers.map((server) => (
          <ServerIcon
            key={server.id}
            name={server.name}
            iconUrl={server.iconUrl}
            iconColor={server.iconColor}
            isActive={server.id === currentServerId}
            onClick={() => selectServer(server.id)}
            hasUnread={false}
            badge="9"
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ show: true, x: e.clientX, y: e.clientY, type: 'server', targetId: server.id });
            }}
          />
        ))}

        {/* Add Server Button */}
        <button
          onClick={() => setShowCreateServer(true)}
          className="w-[48px] h-[48px] rounded-2xl bg-[#313338] hover:bg-[#5865F2] hover:rounded-[16px] flex items-center justify-center text-[#313338] hover:text-white transition-all duration-200 group"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Channel Sidebar */}
      <div className="w-[240px] bg-[#1e1f22] flex flex-col">
        {currentServer ? (
          <>
            <ServerHeader server={currentServer} />
            <ChannelSidebar
              server={currentServer}
              onSelectChannel={(id) => selectChannel(currentServer.id, id)}
              onSelectVoice={(id) => selectVoiceChannel(currentServer.id, id)}
            />
            <VoicePanel
              serverId={currentServer.id}
              voiceChannelId={currentServer.selectedVoiceChannelId}
              voiceStates={voiceStates.filter((v) => v.channelId === currentServer.selectedVoiceChannelId)}
            />
          </>
        ) : (
          <HomePanel />
        )}
        <UserPanel />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#313338]">
        {currentServer?.selectedChannelId ? (
          <>
            <ChannelHeader channel={currentServer.channels.find((c) => c.id === currentServer.selectedChannelId)} />
            <MessageList />
            <MessageInput />
          </>
        ) : (
          <EmptyState server={currentServer} />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          targetId={contextMenu.targetId}
        />
      )}

      {/* Create Server Modal */}
      {showCreateServer && <CreateServerModal onClose={() => setShowCreateServer(false)} />}
    </div>
  );
}

function ServerIcon({
  name,
  icon,
  iconUrl,
  iconColor,
  isActive,
  onClick,
  isHome,
  hasUnread,
  badge,
  onContextMenu,
}: {
  name?: string;
  icon?: string;
  iconUrl?: string;
  iconColor?: string;
  isActive: boolean;
  onClick: () => void;
  isHome?: boolean;
  hasUnread?: boolean;
  badge?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-[48px] h-[48px] rounded-2xl flex items-center justify-center transition-all duration-200 relative ${
          isActive
            ? 'rounded-[16px] bg-[#5865F2]'
            : 'bg-discord-bg-secondary hover:rounded-[16px] hover:bg-discord-hover'
        }`}
      >
        {isHome ? (
          <span className="text-xl">{icon || '🏠'}</span>
        ) : iconUrl ? (
          <img src={iconUrl} alt={name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span
            className="text-lg font-semibold text-white"
            style={{ color: iconColor || '#ffffff' }}
          >
            {(name || '?').charAt(0).toUpperCase()}
          </span>
        )}

        {hasUnread && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-discord-notification rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{badge}</span>
          </div>
        )}
      </button>

      {showTooltip && (
        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 z-50">
          <div className="bg-[#18191c] text-white px-3 py-2 rounded-md text-sm shadow-xl whitespace-nowrap">
            {name || 'Home'}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[#18191c]" />
          </div>
        </div>
      )}
    </div>
  );
}

function ServerHeader({ server }: { server: ReturnType<typeof useServerStore.getState>['servers'][0] }) {
  const { setShowSettings } = useServerStore();

  return (
    <div className="h-12 px-4 flex items-center justify-between border-b border-[#18191c] shadow-sm">
      <div className="flex items-center gap-2">
        {server.iconUrl ? (
          <img src={server.iconUrl} alt={server.name} className="w-6 h-6 rounded-full" />
        ) : (
          <span className="text-lg font-bold" style={{ color: server.iconColor }}>
            {server.name.charAt(0)}
          </span>
        )}
        <h2 className="font-semibold text-white">{server.name}</h2>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#949ba4" className="ml-1">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </div>
      <button
        onClick={() => setShowSettings(true)}
        className="w-8 h-8 rounded flex items-center justify-center hover:bg-[#2b2d31] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#949ba4">
          <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4zM5.94 18.28a.75.75 0 01-.37.1.71.71 0 01-.35-.1.75.75 0 01-.26-.25 8 8 0 010-1.1l1.36-1.36a.75.75 0 011.06 0l.75.75a.75.75 0 010 1.06l-.75.75a.75.75 0 01-1.06 0 .75.75 0 010-1.06l.5-.5-1.36-1.36-.5.5a.75.75 0 010 1.06.75.75 0 01-.53.22zM18.06 5.72a.75.75 0 01.37-.1.71.71 0 01.35.1.75.75 0 01.26.25 8 8 0 010 1.1l-1.36 1.36a.75.75 0 01-1.06 0l-.75-.75a.75.75 0 010-1.06l.75-.75a.75.75 0 011.06 0 .75.75 0 010 1.06l-.5.5 1.36 1.36.5-.5a.75.75 0 010-1.06.75.75 0 01.53-.22z" />
        </svg>
      </button>
    </div>
  );
}

function ChannelSidebar({
  server,
  onSelectChannel,
  onSelectVoice,
}: {
  server: ReturnType<typeof useServerStore.getState>['servers'][0];
  onSelectChannel: (id: string) => void;
  onSelectVoice: (id: string) => void;
}) {
  const categories = server.categories;
  const uncategorizedChannels = server.channels.filter((c) => !c.categoryId);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const renderChannel = (channel: Channel) => {
    const isText = channel.type === 'text' || channel.type === 'announcement' || channel.type === 'forum';
    const isSelected = server.selectedChannelId === channel.id;
    const isVoiceActive = server.selectedVoiceChannelId === channel.id;

    const handleClick = () => {
      if (isText) {
        onSelectChannel(channel.id);
      } else {
        onSelectVoice(isVoiceActive ? '' : channel.id);
      }
    };

    return (
      <button
        key={channel.id}
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors ${
          isSelected
            ? 'bg-[#404249] text-white'
            : isVoiceActive
            ? 'bg-discord-voice-active text-white'
            : 'text-[#b5bac1] hover:bg-[#f2f3f5] hover:text-[#313338]'
        }`}
      >
        {isText ? (
          <span className="text-lg opacity-60">#</span>
        ) : (
          <span className="text-lg opacity-60">🔊</span>
        )}
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {channel.topic && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
            <path d="M12 3c-.46 0-.93.04-1.4.14-2.76.53-4.96 2.76-5.48 5.52-.48 2.61.48 5.01 2.22 6.56L7 16l1.69 1.11c1.9 1.24 4.32 1.89 6.81 1.89.46 0 .93-.04 1.4-.14 2.76-.53 4.96-2.76 5.48-5.52.48-2.61-.48-5.01-2.22-6.56L20 9l-1.69-1.11c-1.9-1.24-4.32-1.89-6.81-1.89zM12 18c-2.21 0-4.26-.52-6.02-1.52l-.69-.46-.69.46C2.73 17.96 1 15.37 1 12c0-5.52 4.48-10 10-10 5.52 0 10 4.48 10 10 0 3.37-1.73 5.96-4.59 7.98l-.69.46-.69-.46c-1.76-1-3.8-1.52-6.02-1.52z" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
      {categories.map((category) => (
        <div key={category.id} className="mb-2">
          <button
            onClick={() => toggleCategory(category.id)}
            className="flex items-center gap-1 px-1 mb-1 text-xs font-semibold text-[#949ba4] uppercase tracking-wide hover:text-[#f2f3f5] transition-colors w-full"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`transition-transform ${collapsedCategories.has(category.id) ? '-rotate-90' : ''}`}
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
            <span>{category.name}</span>
          </button>
          {!collapsedCategories.has(category.id) && (
            <div className="space-y-0.5">
              {server.channels
                .filter((c) => c.categoryId === category.id)
                .map(renderChannel)}
            </div>
          )}
        </div>
      ))}

      {uncategorizedChannels.length > 0 && (
        <div className="space-y-0.5">
          {uncategorizedChannels.map(renderChannel)}
        </div>
      )}
    </div>
  );
}

function VoicePanel({
  serverId,
  voiceChannelId,
  voiceStates,
}: {
  serverId: string;
  voiceChannelId: string | null;
  voiceStates: VoiceState[];
}) {
  const { selectVoiceChannel } = useServerStore();

  if (!voiceChannelId) return null;

  return (
    <div className="bg-[#232428] border-t border-[#18191c] p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#949ba4] uppercase">Voice Connected</span>
        <button
          onClick={() => {
            selectVoiceChannel(serverId, '');
          }}
          className="text-[#949ba4] hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <div className="space-y-1">
        {voiceStates.map((state) => (
          <div key={state.userId} className="flex items-center gap-2 px-2 py-1 rounded bg-[#35373c]">
            <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm">
              {state.userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{state.userName}</div>
            </div>
            <div className="flex gap-1">
              {state.isMuted && <MicOffIcon />}
              {state.isDeafened && <HeadphonesOffIcon />}
              {state.isStreaming && <StreamingIcon />}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#3f4147]">
        <button className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded bg-[#3ba55c] hover:bg-[#3daf5e] text-white text-sm font-medium transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          Mute
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded bg-[#3ba55c] hover:bg-[#3daf5e] text-white text-sm font-medium transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3z" />
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          Deafen
        </button>
        <button className="p-1.5 rounded hover:bg-[#5865f2] text-[#949ba4] hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8.5l-6 4.5v-9h12v9l-6-4.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f04747">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
  );
}

function HeadphonesOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f04747">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function StreamingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f04747">
      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h18v8zM6 15l5-4 5 4H6z" />
    </svg>
  );
}

function UserPanel() {
  const { userId } = useIdentityStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  return (
    <div className="h-[52px] bg-[#232428] flex items-center px-2 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:opacity-90">
          {userId ? userId.charAt(0).toUpperCase() : 'K'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {userId ? `User ${userId.slice(0, 8)}` : 'chatLibre User'}
          </div>
          <div className="flex items-center gap-1 text-xs text-[#b5bac1]">
            <span className="w-2 h-2 rounded-full bg-[#3ba55c] inline-block" />
            Online
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            isMuted ? 'bg-[#f04747] text-white' : 'text-[#b5bac1] hover:bg-[#5865f2] hover:text-white'
          }`}
        >
          {isMuted ? <MicOffIcon /> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setIsDeafened(!isDeafened)}
          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
            isDeafened ? 'bg-[#f04747] text-white' : 'text-[#b5bac1] hover:bg-[#5865f2] hover:text-white'
          }`}
        >
          {isDeafened ? <HeadphonesOffIcon /> : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            </svg>
          )}
        </button>
        <button className="w-8 h-8 rounded text-[#b5bac1] hover:bg-[#5865f2] hover:text-white flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
        </button>
        <button className="w-8 h-8 rounded text-[#b5bac1] hover:bg-[#5865f2] hover:text-white flex items-center justify-center transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ChannelHeader({ channel }: { channel?: Channel }) {
  if (!channel) return null;

  return (
    <div className="h-[48px] px-4 flex items-center border-b border-[#313338]">
      <div className="flex items-center gap-3">
        <span className="text-2xl text-[#6d6f78]">
          {channel.type === 'text' || channel.type === 'forum' ? '#' : '🔊'}
        </span>
        <span className="font-semibold text-white text-lg">{channel.name}</span>
        {channel.topic && (
          <>
            <div className="w-px h-6 bg-[#42444a] mx-2" />
            <span className="text-sm text-[#b5bac1] truncate max-w-[400px]">{channel.topic}</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button className="p-2 rounded text-[#b5bac1] hover:bg-[#3f4147] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
        <button className="p-2 rounded text-[#b5bac1] hover:bg-[#3f4147] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
        <button className="p-2 rounded text-[#b5bac1] hover:bg-[#3f4147] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </button>
        <button className="p-2 rounded text-[#b5bac1] hover:bg-[#3f4147] hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HomePanel() {
  const { servers, setShowCreateServer } = useServerStore();

  return (
    <>
      <div className="h-12 px-4 flex items-center border-b border-[#18191c]">
        <h2 className="font-semibold text-white">Welcome to chatLibre</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-discord-accent mx-auto mb-4 flex items-center justify-center text-4xl">
              🔐
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Privacy-First Communication</h1>
            <p className="text-[#b5bac1]">
              End-to-end encrypted, federated, and self-hostable. Your keys, your data, your server.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowCreateServer(true)}
              className="w-full py-3 px-4 bg-discord-accent hover:bg-[#4752c4] text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
              Create Server
            </button>
            <button className="w-full py-3 px-4 bg-[#4e5058] hover:bg-[#5d6066] text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              Join Server
            </button>
          </div>

          {servers.length > 0 && (
            <div className="mt-8 pt-8 border-t border-[#3f4147]">
              <h3 className="text-sm font-semibold text-[#b5bac1] mb-4">YOUR SERVERS</h3>
              <div className="grid grid-cols-4 gap-3">
                {servers.slice(0, 4).map((server) => (
                  <button
                    key={server.id}
                    className="flex flex-col items-center gap-2 p-3 rounded-md bg-[#2b2d31] hover:bg-[#35373c] transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                      style={{ backgroundColor: server.iconColor }}
                    >
                      {server.name.charAt(0)}
                    </div>
                    <span className="text-xs text-[#b5bac1] truncate w-full text-center">{server.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyState({ server }: { server: ReturnType<typeof useServerStore.getState>['servers'][0] | undefined }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#313338]">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-[#4e5058] rounded-full flex items-center justify-center">
          <span className="text-4xl opacity-50">#</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {server ? `Welcome to #${server.channels.find((c) => c.type === 'text')?.name || 'general'}` : 'Welcome'}
        </h2>
        <p className="text-[#b5bac1]">
          {server ? 'This is the beginning of the channel.' : 'Select a server to get started.'}
        </p>
        <div className="flex items-center gap-2 mt-4 text-sm text-[#6d6f78]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span>Messages are end-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}

function ContextMenu({
  x,
  y,
  type,
  targetId,
}: {
  x: number;
  y: number;
  type: string | null;
  targetId: string | null;
}) {
  const { removeServer } = useServerStore();

  const menuItems: Record<string, Array<{ label?: string; icon?: string; action?: () => void; danger?: boolean; type?: string }>> = {
    server: [
      { label: 'Server Settings', icon: '⚙️', action: () => {} },
      { label: 'Create Channel', icon: '#', action: () => {} },
      { label: 'Create Category', icon: '📁', action: () => {} },
      { label: 'Server Boost', icon: '💎', action: () => {} },
      { type: 'divider' },
      { label: 'Invite People', icon: '➡️', action: () => {} },
      { label: 'Edit Server', icon: '✏️', action: () => {} },
      { type: 'divider' },
      { label: 'Leave Server', icon: '🚪', action: () => removeServer(targetId!), danger: true },
    ],
    channel: [
      { label: 'Edit Channel', icon: '✏️', action: () => {} },
      { label: 'Delete Channel', icon: '🗑️', action: () => {}, danger: true },
    ],
  };

  const items = type ? menuItems[type] || [] : [];

  return (
    <div
      className="fixed z-50 bg-[#18191c] rounded-md shadow-2xl border border-[#27272a] py-1 min-w-[200px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) =>
        item.type === 'divider' ? (
          <div key={index} className="h-px bg-[#3f4147] my-1" />
        ) : (
          <button
            key={index}
            onClick={item.action}
            className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-3 hover:bg-[#2b2d31] ${
              item.danger ? 'text-[#f04747]' : 'text-white'
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}

function CreateServerModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'create' | 'template'>('create');
  const [serverName, setServerName] = useState('');
  const [templateUrl, setTemplateUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { importFromDiscordTemplate, addServer } = useServerStore();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCreate = () => {
    if (!serverName.trim()) {
      setError('Server name is required');
      return;
    }

    const id = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#3BA55C'];
    const iconColor = colors[serverName.charCodeAt(0) % colors.length];

    addServer({
      id,
      url: '',
      name: serverName.trim(),
      publicKey: '',
      isTrusted: false,
      memberCount: 1,
      iconColor,
    });

    onClose();
  };

  const handleImportFromUrl = async () => {
    if (!templateUrl.trim()) {
      setError('Template URL is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(templateUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch template');
      }

      const data = await response.json();

      if (data.channels && Array.isArray(data.channels)) {
        importFromDiscordTemplate(
          {
            name: data.name || 'Imported Server',
            description: data.description,
            channels: data.channels,
            categories: data.categories,
          },
          data.name || 'Imported Server'
        );
        onClose();
      } else {
        setError('Invalid Discord template format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import template');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDiscordTemplate = () => {
    const templates = [
      {
        name: 'Gaming',
        url: 'https://discord.com/api/v9/guilds/templates/empty',
        data: {
          name: 'My Gaming Server',
          description: 'A community for gamers',
          channels: [
            { name: 'welcome', type: 0, topic: 'Read the rules first!' },
            { name: 'general', type: 0 },
            { name: 'voice-lounge', type: 2 },
            { name: 'competitive', type: 0 },
            { name: 'clips', type: 0 },
          ],
          categories: [
            { name: 'TEXT CHANNELS', channels: ['welcome', 'general', 'competitive', 'clips'] },
            { name: 'VOICE CHANNELS', channels: ['voice-lounge'] },
          ],
        },
      },
      {
        name: 'Study Group',
        url: 'https://discord.com/api/v9/guilds/templates/empty',
        data: {
          name: 'Study Group',
          description: 'Learn together',
          channels: [
            { name: 'announcements', type: 5 },
            { name: 'general', type: 0 },
            { name: 'resources', type: 0 },
            { name: 'study-rooms', type: 2 },
          ],
          categories: [
            { name: '📢 INFORMATION', channels: ['announcements'] },
            { name: '💬 GENERAL', channels: ['general', 'resources'] },
            { name: '🔊 VOICE', channels: ['study-rooms'] },
          ],
        },
      },
      {
        name: 'Creative',
        url: 'https://discord.com/api/v9/guilds/templates/empty',
        data: {
          name: 'Creative Community',
          description: 'Share your art',
          channels: [
            { name: 'rules', type: 0, topic: 'Please read before posting' },
            { name: 'showcase', type: 0 },
            { name: 'feedback', type: 0 },
            { name: 'tutorials', type: 0 },
            { name: 'collabs', type: 0 },
          ],
          categories: [
            { name: '📜 RULES', channels: ['rules'] },
            { name: '🎨 ART', channels: ['showcase', 'feedback'] },
            { name: '📚 RESOURCES', channels: ['tutorials', 'collabs'] },
          ],
        },
      },
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

    importFromDiscordTemplate(
      {
        name: randomTemplate.data.name,
        description: randomTemplate.data.description,
        channels: randomTemplate.data.channels,
        categories: randomTemplate.data.categories,
      },
      randomTemplate.data.name
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#313338] rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#3f4147] flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Server</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-[#949ba4] hover:bg-[#3f4147] hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Mode Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'create'
                  ? 'bg-discord-accent text-white'
                  : 'bg-[#4e5058] text-[#b5bac1] hover:bg-[#5d6066]'
              }`}
            >
              Create New
            </button>
            <button
              onClick={() => setMode('template')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'template'
                  ? 'bg-discord-accent text-white'
                  : 'bg-[#4e5058] text-[#b5bac1] hover:bg-[#5d6066]'
              }`}
            >
              From Template
            </button>
          </div>

          {mode === 'create' ? (
            <div>
              <label className="block text-sm font-medium text-[#b5bac1] mb-2">
                SERVER NAME
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Enter server name"
                className="w-full px-4 py-3 bg-[#383b41] border border-[#18191c] rounded-md text-white placeholder-[#6d6f78] focus:outline-none focus:border-discord-accent"
                autoFocus
              />

              {error && <p className="text-[#f04747] text-sm mt-2">{error}</p>}

              <div className="mt-6">
                <h3 className="text-sm font-medium text-[#b5bac1] mb-3">START FROM A TEMPLATE</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['Gaming', 'Study', 'Creative'].map((template) => (
                    <button
                      key={template}
                      onClick={loadDiscordTemplate}
                      className="flex flex-col items-center gap-2 p-4 bg-[#2b2d31] rounded-md hover:bg-[#35373c] transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-discord-accent flex items-center justify-center text-xl">
                        {template === 'Gaming' ? '🎮' : template === 'Study' ? '📚' : '🎨'}
                      </div>
                      <span className="text-xs text-[#b5bac1]">{template}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!serverName.trim()}
                className="w-full mt-6 py-3 bg-discord-accent hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
              >
                Create Server
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-6 p-4 bg-[#2b2d31] rounded-md">
                <h3 className="text-sm font-medium text-[#b5bac1] mb-3">DISCORD TEMPLATE URL</h3>
                <p className="text-xs text-[#6d6f78] mb-4">
                  Paste a Discord server template URL to import its structure.
                  <br />
                  Example: discord.new/abc123 or templates.discord.new/xyz789
                </p>
                <input
                  type="text"
                  value={templateUrl}
                  onChange={(e) => setTemplateUrl(e.target.value)}
                  placeholder="https://discord.new/..."
                  className="w-full px-4 py-3 bg-[#383b41] border border-[#18191c] rounded-md text-white placeholder-[#6d6f78] focus:outline-none focus:border-discord-accent"
                />
              </div>

              {error && <p className="text-[#f04747] text-sm mb-4">{error}</p>}

              <button
                onClick={handleImportFromUrl}
                disabled={!templateUrl.trim() || isLoading}
                className="w-full py-3 bg-discord-accent hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  'Import from URL'
                )}
              </button>

              <div className="mt-6 pt-6 border-t border-[#3f4147]">
                <h3 className="text-sm font-medium text-[#b5bac1] mb-3">OR USE A PRESET TEMPLATE</h3>
                <div className="space-y-2">
                  {[
                    { name: 'Gaming Community', emoji: '🎮', desc: 'Channels for gaming discussion and voice chat' },
                    { name: 'Study Group', emoji: '📚', desc: 'Perfect for online classes and study sessions' },
                    { name: 'Creative Studio', emoji: '🎨', desc: 'Share and showcase creative work' },
                    { name: 'Club', emoji: '⭐', desc: 'General purpose community server' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        importFromDiscordTemplate(
                          {
                            name: preset.name,
                            channels: preset.name === 'Gaming Community'
                              ? [
                                  { name: 'welcome', type: 0 },
                                  { name: 'rules', type: 0 },
                                  { name: 'general', type: 0 },
                                  { name: 'lfg', type: 0 },
                                  { name: 'voice-lounge', type: 2 },
                                ]
                              : preset.name === 'Study Group'
                              ? [
                                  { name: 'announcements', type: 5 },
                                  { name: 'general', type: 0 },
                                  { name: 'homework-help', type: 0 },
                                  { name: 'study-rooms', type: 2 },
                                ]
                              : preset.name === 'Creative Studio'
                              ? [
                                  { name: 'rules', type: 0 },
                                  { name: 'showcase', type: 0 },
                                  { name: 'feedback', type: 0 },
                                  { name: 'collabs', type: 0 },
                                ]
                              : [
                                  { name: 'welcome', type: 0 },
                                  { name: 'general', type: 0 },
                                  { name: 'random', type: 0 },
                                ],
                          },
                          preset.name
                        );
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-[#2b2d31] rounded-md hover:bg-[#35373c] transition-colors text-left"
                    >
                      <span className="text-2xl">{preset.emoji}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{preset.name}</div>
                        <div className="text-xs text-[#6d6f78]">{preset.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
