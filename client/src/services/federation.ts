import { useServerStore } from '../stores/serverStore';
import { useIdentityStore } from '../stores/identityStore';

export interface FederationMessage {
  type: 'federation.handshake' | 'federation.channel_sync' | 'federation.presence' | 'federation.error';
  sourceServer: string;
  targetServer?: string;
  payload: unknown;
  timestamp: number;
  signature?: string;
}

export interface ServerInfo {
  url: string;
  publicKey: string;
  name: string;
  capabilities: string[];
  version: string;
}

export interface ChannelSync {
  serverId: string;
  channels: Array<{
    id: string;
    name: string;
    type: string;
    federated: boolean;
    remoteMembers: string[];
  }>;
}

export class FederationService {
  private knownServers: Map<string, ServerInfo> = new Map();
  private ws: WebSocket | null = null;
  private messageQueue: FederationMessage[] = [];

  async discoverServer(url: string): Promise<ServerInfo | null> {
    try {
      const response = await fetch(`${url}/api/v1/server/info`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Server discovery failed: ${response.status}`);
      }
      
      const info = await response.json() as ServerInfo;
      this.knownServers.set(url, info);
      return info;
    } catch (error) {
      console.error('Server discovery failed:', error);
      return null;
    }
  }

  async verifyServerKey(url: string, expectedKey: string): Promise<boolean> {
    const info = await this.discoverServer(url);
    if (!info) return false;
    
    if (info.publicKey !== expectedKey) {
      console.error('Server key mismatch!');
      return false;
    }
    
    return true;
  }

  async initiateHandshake(localServerUrl: string, remoteServerUrl: string): Promise<boolean> {
    const identity = useIdentityStore.getState();
    
    const handshakeRequest: FederationMessage = {
      type: 'federation.handshake',
      sourceServer: localServerUrl,
      targetServer: remoteServerUrl,
      payload: {
        identityKey: identity.publicKey,
        supportedVersions: ['1.0'],
        capabilities: ['channels', 'voice', 'files'],
      },
      timestamp: Date.now(),
    };

    try {
      const response = await fetch(`${remoteServerUrl}/api/v1/federation/handshake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(handshakeRequest),
      });
      
      if (!response.ok) {
        throw new Error(`Handshake failed: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      if (responseData.accepted) {
        const remoteInfo = await this.discoverServer(remoteServerUrl);
        if (remoteInfo) {
          this.knownServers.set(remoteServerUrl, remoteInfo);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Handshake failed:', error);
      return false;
    }
  }

  async syncChannels(localServerId: string, remoteServerUrl: string): Promise<ChannelSync | null> {
    const servers = useServerStore.getState().servers;
    const localServer = servers.find(s => s.id === localServerId);
    
    if (!localServer) return null;

    const syncRequest: FederationMessage = {
      type: 'federation.channel_sync',
      sourceServer: localServer.url,
      targetServer: remoteServerUrl,
      payload: {
        serverId: localServerId,
        channels: localServer.channels.map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          federated: true,
        })),
      },
      timestamp: Date.now(),
    };

    try {
      const response = await fetch(`${remoteServerUrl}/api/v1/federation/channel-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncRequest),
      });
      
      if (!response.ok) {
        throw new Error(`Channel sync failed: ${response.status}`);
      }
      
      return await response.json() as ChannelSync;
    } catch (error) {
      console.error('Channel sync failed:', error);
      return null;
    }
  }

  connectToFederation(serverUrl: string): void {
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(`${serverUrl}/ws/federation`);

      this.ws.onopen = () => {
        console.log('Connected to federation network');
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        this.handleFederationMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('Federation WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from federation network');
        this.ws = null;
      };
    } catch (error) {
      console.error('Failed to connect to federation:', error);
    }
  }

  disconnectFromFederation(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendFederationMessage(message: FederationMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  private handleFederationMessage(message: FederationMessage): void {
    switch (message.type) {
      case 'federation.presence':
        this.handlePresenceUpdate(message);
        break;
      case 'federation.channel_sync':
        this.handleChannelSync(message);
        break;
      case 'federation.error':
        this.handleError(message);
        break;
    }
  }

  private handlePresenceUpdate(message: FederationMessage): void {
    const payload = message.payload as { userId: string; status: string; serverUrl: string };
    console.log(`User ${payload.userId} is ${payload.status} on ${payload.serverUrl}`);
  }

  private handleChannelSync(message: FederationMessage): void {
    const sync = message.payload as ChannelSync;
    console.log(`Channel sync from ${message.sourceServer}:`, sync);
  }

  private handleError(message: FederationMessage): void {
    const error = message.payload as { code: string; message: string };
    console.error(`Federation error (${error.code}): ${error.message}`);
  }

  getKnownServers(): ServerInfo[] {
    return Array.from(this.knownServers.values());
  }
}

export const federationService = new FederationService();
