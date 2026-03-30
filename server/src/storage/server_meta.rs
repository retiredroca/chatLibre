use serde::{Deserialize, Serialize};
use sled::Db;

const META_TREE: &str = "server_meta";
const INFO_KEY: &[u8] = b"server_info";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub banner_url: Option<String>,
    pub owner_key: String,
    pub created_at: u64,
}

pub struct ServerMetaStore {
    db: Db,
}

impl ServerMetaStore {
    pub fn new(db: Db) -> anyhow::Result<Self> {
        Ok(Self { db })
    }

    pub fn get_info(&self) -> anyhow::Result<ServerInfo> {
        let tree = self.db.open_tree(META_TREE)?;
        
        if let Some(value) = tree.get(INFO_KEY)? {
            let info: ServerInfo = serde_json::from_slice(&value)?;
            Ok(info)
        } else {
            let default_info = ServerInfo {
                name: "chatLibre Server".to_string(),
                description: Some("A chatLibre relay server".to_string()),
                icon_url: None,
                banner_url: None,
                owner_key: String::new(),
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)?
                    .as_secs(),
            };
            
            self.set_info(&default_info)?;
            Ok(default_info)
        }
    }

    pub fn set_info(&self, info: &ServerInfo) -> anyhow::Result<()> {
        let tree = self.db.open_tree(META_TREE)?;
        let value = serde_json::to_vec(info)?;
        tree.insert(INFO_KEY, value)?;
        tree.flush()?;
        Ok(())
    }

    pub fn update_name(&self, name: &str) -> anyhow::Result<()> {
        let mut info = self.get_info()?;
        info.name = name.to_string();
        self.set_info(&info)
    }

    pub fn update_description(&self, description: Option<String>) -> anyhow::Result<()> {
        let mut info = self.get_info()?;
        info.description = description;
        self.set_info(&info)
    }
}
