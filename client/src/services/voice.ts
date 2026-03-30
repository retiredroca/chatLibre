export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  audioStream: MediaStream | null;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'mute' | 'deafen';
  from: string;
  to?: string;
  payload: unknown;
  timestamp: number;
}

export interface VoiceChannelState {
  channelId: string;
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  peers: Map<string, PeerConnection>;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

class VoiceService {
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map();
  private voiceChannelState: VoiceChannelState | null = null;
  private audioContext: AudioContext | null = null;
  private onStateChange: ((state: VoiceChannelState) => void) | null = null;

  async joinVoiceChannel(
    serverUrl: string,
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.connectToSignaling(serverUrl, channelId, userId);

      this.voiceChannelState = {
        channelId,
        connected: true,
        muted: false,
        deafened: false,
        speaking: false,
        peers: new Map(),
      };

      this.notifyStateChange();
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      throw error;
    }
  }

  leaveVoiceChannel(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((peer) => {
      peer.connection.close();
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
    });
    this.peerConnections.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.voiceChannelState) {
      this.voiceChannelState.connected = false;
      this.notifyStateChange();
    }
  }

  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }

    if (this.voiceChannelState) {
      this.voiceChannelState.muted = muted;
      this.notifyStateChange();
    }

    this.sendSignalingMessage({
      type: muted ? 'mute' : 'mute',
      from: '',
      payload: { muted },
      timestamp: Date.now(),
    });
  }

  setDeafened(deafened: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !deafened;
      });
    }

    if (this.voiceChannelState) {
      this.voiceChannelState.deafened = deafened;
      this.voiceChannelState.muted = deafened;
      this.notifyStateChange();
    }

    this.sendSignalingMessage({
      type: 'deafen',
      from: '',
      payload: { deafened },
      timestamp: Date.now(),
    });
  }

  setOnStateChange(callback: (state: VoiceChannelState) => void): void {
    this.onStateChange = callback;
  }

  private connectToSignaling(serverUrl: string, channelId: string, userId: string): void {
    this.ws = new WebSocket(`${serverUrl}/ws/voice`);

    this.ws.onopen = () => {
      this.sendSignalingMessage({
        type: 'join',
        from: userId,
        payload: { channelId },
        timestamp: Date.now(),
      });
    };

    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data) as SignalingMessage;
      await this.handleSignalingMessage(message, userId);
    };

    this.ws.onerror = (error) => {
      console.error('Voice signaling error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from voice signaling');
    };
  }

  private async handleSignalingMessage(message: SignalingMessage, selfId: string): Promise<void> {
    switch (message.type) {
      case 'offer':
        await this.handleOffer(message, selfId);
        break;
      case 'answer':
        await this.handleAnswer(message);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message);
        break;
      case 'join':
        await this.initiateCall(message.from);
        break;
      case 'leave':
        this.removePeer(message.from);
        break;
    }
  }

  private async initiateCall(peerId: string): Promise<void> {
    const pc = await this.createPeerConnection(peerId);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    const dataChannel = pc.createDataChannel('voice-data');
    this.setupDataChannel(dataChannel, peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignalingMessage({
      type: 'offer',
      from: '',
      to: peerId,
      payload: offer,
      timestamp: Date.now(),
    });
  }

  private async handleOffer(message: SignalingMessage, selfId: string): Promise<void> {
    const peerId = message.from;
    const pc = await this.createPeerConnection(peerId);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    await pc.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      from: selfId,
      to: peerId,
      payload: answer,
      timestamp: Date.now(),
    });
  }

  private async handleAnswer(message: SignalingMessage): Promise<void> {
    const pc = this.peerConnections.get(message.from);
    if (pc) {
      await pc.connection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
    }
  }

  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    const pc = this.peerConnections.get(message.from);
    if (pc && message.payload) {
      await pc.connection.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
    }
  }

  private async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          from: '',
          to: peerId,
          payload: event.candidate.toJSON(),
          timestamp: Date.now(),
        });
      }
    };

    pc.ontrack = (event) => {
      const peer = this.peerConnections.get(peerId);
      if (peer) {
        peer.audioStream = event.streams[0];
        this.playAudioStream(peerId, event.streams[0]);
      }
    };

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeer(peerId);
      }
    };

    this.peerConnections.set(peerId, {
      peerId,
      connection: pc,
      dataChannel: null,
      audioStream: null,
    });

    return pc;
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.dataChannel = dataChannel;

      dataChannel.onmessage = (event) => {
        console.log(`Voice data from ${peerId}:`, event.data);
      };
    }
  }

  private playAudioStream(_peerId: string, stream: MediaStream): void {
    if (this.voiceChannelState?.deafened) return;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.audioContext.destination);
  }

  private removePeer(peerId: string): void {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.connection.close();
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
      this.peerConnections.delete(peerId);
      this.notifyStateChange();
    }
  }

  private sendSignalingMessage(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private notifyStateChange(): void {
    if (this.voiceChannelState && this.onStateChange) {
      this.onStateChange({
        ...this.voiceChannelState,
        peers: new Map(this.peerConnections),
      });
    }
  }

  getState(): VoiceChannelState | null {
    return this.voiceChannelState;
  }

  isConnected(): boolean {
    return this.voiceChannelState?.connected ?? false;
  }
}

export const voiceService = new VoiceService();
