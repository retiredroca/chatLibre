use sled::Db;
use std::collections::HashMap;

const FEDERATION_TREE: &str = "federation";
const TRUSTED_PREFIX: &[u8] = b"trusted_";
const PENDING_PREFIX: &[u8] = b"pending_";

pub struct FederationStore {
    db: Db,
}

impl FederationStore {
    pub fn new(db: Db) -> anyhow::Result<Self> {
        Ok(Self { db })
    }

    pub fn store_pending_trust(&self, server_pubkey: String) -> anyhow::Result<()> {
        let tree = self.db.open_tree(FEDERATION_TREE)?;
        let key = format!("{}{}", PENDING_PREFIX, server_pubkey);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        tree.insert(key, timestamp.to_string().as_bytes())?;
        tree.flush()?;
        Ok(())
    }

    pub fn approve_trust(&self, server_pubkey: &str) -> bool {
        let tree = match self.db.open_tree(FEDERATION_TREE) {
            Ok(t) => t,
            Err(_) => return false,
        };
        
        let pending_key = format!("{}{}", PENDING_PREFIX, server_pubkey);
        if tree.get(&pending_key).ok().flatten().is_none() {
            return false;
        }
        
        let trusted_key = format!("{}{}", TRUSTED_PREFIX, server_pubkey);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        tree.insert(trusted_key, timestamp.to_string().as_bytes()).ok();
        tree.remove(pending_key).ok();
        tree.flush().ok();
        
        true
    }

    pub fn is_trusted(&self, server_pubkey: &str) -> bool {
        let tree = match self.db.open_tree(FEDERATION_TREE) {
            Ok(t) => t,
            Err(_) => return false,
        };
        
        let key = format!("{}{}", TRUSTED_PREFIX, server_pubkey);
        tree.get(key).ok().flatten().is_some()
    }

    pub fn list_trusted(&self) -> anyhow::Result<Vec<String>> {
        let tree = self.db.open_tree(FEDERATION_TREE)?;
        let mut trusted = Vec::new();
        
        for entry in tree.iter() {
            if let Ok((key, _)) = entry {
                let key_str = String::from_utf8_lossy(&key);
                if key_str.starts_with("trusted_") {
                    trusted.push(key_str.strip_prefix("trusted_").unwrap().to_string());
                }
            }
        }
        
        Ok(trusted)
    }

    pub fn revoke_trust(&self, server_pubkey: &str) -> anyhow::Result<()> {
        let tree = self.db.open_tree(FEDERATION_TREE)?;
        let key = format!("{}{}", TRUSTED_PREFIX, server_pubkey);
        tree.remove(key)?;
        tree.flush()?;
        Ok(())
    }
}
