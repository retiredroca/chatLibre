use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ClientMessage {
    #[serde(rename = "chat.message")]
    ChatMessage {
        channel_id: String,
        ciphertext: String,
        nonce: String,
        reply_to: Option<String>,
        thread_id: Option<String>,
    },
    
    #[serde(rename = "chat.edit")]
    ChatEdit {
        channel_id: String,
        message_id: String,
        ciphertext: String,
        nonce: String,
    },
    
    #[serde(rename = "chat.delete")]
    ChatDelete {
        channel_id: String,
        message_id: String,
    },
    
    #[serde(rename = "chat.reaction")]
    ChatReaction {
        channel_id: String,
        message_id: String,
        emoji: String,
        action: ReactionAction,
    },
    
    #[serde(rename = "channel.create")]
    ChannelCreate {
        name: String,
        topic: Option<String>,
        channel_type: ChannelType,
        parent_id: Option<String>,
    },
    
    #[serde(rename = "channel.update")]
    ChannelUpdate {
        channel_id: String,
        name: Option<String>,
        topic: Option<String>,
    },
    
    #[serde(rename = "channel.delete")]
    ChannelDelete {
        channel_id: String,
    },
    
    #[serde(rename = "federation.relay")]
    FederationRelay {
        target_server: String,
        encrypted_payload: Vec<u8>,
    },
    
    #[serde(rename = "sync.request")]
    SyncRequest {
        since: Option<u64>,
        channel_id: Option<String>,
    },
    
    #[serde(rename = "presence.update")]
    PresenceUpdate {
        status: PresenceStatus,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    #[serde(rename = "chat.message")]
    ChatMessage {
        id: String,
        channel_id: String,
        sender: String,
        ciphertext: String,
        nonce: String,
        timestamp: u64,
        reply_to: Option<String>,
        thread_id: Option<String>,
    },
    
    #[serde(rename = "chat.edit")]
    ChatEdit {
        id: String,
        channel_id: String,
        message_id: String,
        ciphertext: String,
        nonce: String,
        timestamp: u64,
    },
    
    #[serde(rename = "chat.delete")]
    ChatDelete {
        channel_id: String,
        message_id: String,
        timestamp: u64,
    },
    
    #[serde(rename = "channel.list")]
    ChannelList {
        channels: Vec<super::types::ChannelMeta>,
    },
    
    #[serde(rename = "sync.response")]
    SyncResponse {
        channels: Vec<super::types::ChannelMeta>,
        pinned_messages: Vec<PinnedMessage>,
        timestamp: u64,
    },
    
    #[serde(rename = "error")]
    Error {
        code: String,
        message: String,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    Text,
    Voice,
    Category,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReactionAction {
    Add,
    Remove,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PresenceStatus {
    Online,
    Idle,
    Dnd,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedMessage {
    pub id: String,
    pub channel_id: String,
    pub encrypted_blob: String,
    pub pinned_by: String,
    pub pinned_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederatedMessage {
    pub action: String,
    pub server_pubkey: Option<String>,
    pub signature: String,
    pub payload: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederationMessage {
    pub action: String,
    pub server_pubkey: Option<String>,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FederationResponse {
    pub status: String,
    pub message: Option<String>,
    pub server_pubkey: Option<String>,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayRequest {
    pub source_server: String,
    pub target_server: String,
    pub encrypted_payload: Vec<u8>,
    pub signature: String,
    pub forward: bool,
}
