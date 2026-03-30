import { useState, useCallback, useEffect } from 'react';
import { useServerStore } from '../stores/serverStore';
import { useMessageStore } from '../stores/messageStore';
import { useIdentityStore } from '../stores/identityStore';
import { cryptoService } from '../services/crypto';

export function useWebSocket(serverUrl: string) {
  const { 
    ws, 
    isConnected, 
    isConnecting, 
    connectionError,
    connect,
    disconnect 
  } = useServerStore();
  
  const { addMessage, updateMessage, deleteMessage } = useMessageStore();
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'chat.message':
          addMessage(data.channel_id, {
            id: data.id,
            channelId: data.channel_id,
            senderKey: data.sender,
            content: data.content || '',
            timestamp: data.timestamp,
            isStarred: false,
            replyTo: data.reply_to,
            threadId: data.thread_id,
            reactions: [],
          });
          break;
          
        case 'chat.edit':
          updateMessage(data.channel_id, data.message_id, data.content);
          break;
          
        case 'chat.delete':
          deleteMessage(data.channel_id, data.message_id);
          break;
          
        case 'channel.list':
          useServerStore.getState().setChannels(
            useServerStore.getState().currentServerId || '',
            data.channels
          );
          break;
          
        case 'presence.ping':
          setLastHeartbeat(Date.now());
          break;
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, [addMessage, updateMessage, deleteMessage]);

  const connectToServer = useCallback(async () => {
    try {
      await connect(serverUrl);
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  }, [connect, serverUrl]);

  const sendEncryptedMessage = useCallback(async (
    channelId: string,
    plaintext: string,
    recipientKey?: string
  ) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to server');
    }

    const messageId = cryptoService.generateMessageId();
    const recipient = recipientKey || 'channel';

    const encrypted = await cryptoService.encryptMessage(plaintext, recipient);

    const message = {
      id: messageId,
      type: 'chat.message',
      channel_id: channelId,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      sender: useIdentityStore.getState().publicKey,
      timestamp: Date.now(),
    };

    ws.send(JSON.stringify(message));

    addMessage(channelId, {
      id: messageId,
      channelId,
      senderKey: useIdentityStore.getState().publicKey,
      senderName: 'You',
      content: plaintext,
      timestamp: Date.now(),
      isStarred: false,
      reactions: [],
    });

    return messageId;
  }, [ws, addMessage]);

  useEffect(() => {
    if (!ws) return;

    ws.addEventListener('message', handleMessage);

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'presence.ping' }));
      }
    }, 30000);

    return () => {
      ws.removeEventListener('message', handleMessage);
      clearInterval(heartbeatInterval);
    };
  }, [ws, handleMessage]);

  return {
    isConnected,
    isConnecting,
    connectionError,
    connect: connectToServer,
    disconnect,
    sendMessage: sendEncryptedMessage,
    lastHeartbeat,
  };
}
