use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMeta {
    pub id: String,
    pub name: String,
    pub topic: Option<String>,
    pub position: u32,
    #[serde(rename = "type")]
    pub channel_type: String,
    pub parent_id: Option<String>,
    pub created_at: u64,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleMeta {
    pub id: String,
    pub name: String,
    pub color: String,
    pub permissions: Vec<String>,
    pub position: u32,
    pub hoist: bool,
    pub managed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerMeta {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub banner_url: Option<String>,
    pub owner_id: String,
    pub region: String,
    pub max_presences: u32,
    pub max_members: u32,
    pub approximate_member_count: Option<u32>,
    pub approximate_presence_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub status: String,
    pub status_text: Option<String>,
    pub status_emoji: Option<String>,
    pub last_seen: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteInfo {
    pub code: String,
    pub server_id: String,
    pub created_by: String,
    pub max_uses: Option<u32>,
    pub uses: u32,
    pub expires_at: Option<u64>,
    pub temporary: bool,
}
