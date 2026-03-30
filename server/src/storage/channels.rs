use crate::protocol::types::{ChannelMeta, RoleMeta};
use sled::Db;
use std::collections::HashMap;

const CHANNEL_TREE: &str = "channels";
const CHANNEL_PREFIX: &[u8] = b"channel_";

pub struct ChannelStore {
    db: Db,
}

impl ChannelStore {
    pub fn new(db: Db) -> anyhow::Result<Self> {
        Ok(Self { db })
    }

    pub fn create_channel(&self, channel: &ChannelMeta) -> anyhow::Result<()> {
        let tree = self.db.open_tree(CHANNEL_TREE)?;
        let key = format!("{}{}", CHANNEL_PREFIX, channel.id);
        let value = serde_json::to_vec(channel)?;
        tree.insert(key, value)?;
        tree.flush()?;
        Ok(())
    }

    pub fn get_channel(&self, channel_id: &str) -> anyhow::Result<Option<ChannelMeta>> {
        let tree = self.db.open_tree(CHANNEL_TREE)?;
        let key = format!("{}{}", CHANNEL_PREFIX, channel_id);
        if let Some(value) = tree.get(key)? {
            let channel: ChannelMeta = serde_json::from_slice(&value)?;
            Ok(Some(channel))
        } else {
            Ok(None)
        }
    }

    pub fn update_channel(&self, channel_id: &str, updates: ChannelMeta) -> anyhow::Result<()> {
        let tree = self.db.open_tree(CHANNEL_TREE)?;
        let key = format!("{}{}", CHANNEL_PREFIX, channel_id);
        let value = serde_json::to_vec(&updates)?;
        tree.insert(key, value)?;
        tree.flush()?;
        Ok(())
    }

    pub fn delete_channel(&self, channel_id: &str) -> anyhow::Result<()> {
        let tree = self.db.open_tree(CHANNEL_TREE)?;
        let key = format!("{}{}", CHANNEL_PREFIX, channel_id);
        tree.remove(key)?;
        tree.flush()?;
        Ok(())
    }

    pub fn list(&self) -> anyhow::Result<Vec<ChannelMeta>> {
        let tree = self.db.open_tree(CHANNEL_TREE)?;
        let mut channels = Vec::new();
        
        for entry in tree.iter() {
            if let Ok((_, value)) = entry {
                if let Ok(channel) = serde_json::from_slice::<ChannelMeta>(&value) {
                    channels.push(channel);
                }
            }
        }
        
        channels.sort_by_key(|c| c.position);
        Ok(channels)
    }

    pub fn get_by_type(&self, channel_type: &str) -> anyhow::Result<Vec<ChannelMeta>> {
        let all = self.list()?;
        Ok(all.into_iter().filter(|c| c.channel_type == channel_type).collect())
    }
}
