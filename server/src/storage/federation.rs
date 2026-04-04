#![allow(dead_code)]
use sled::Db;

const FEDERATION_TREE: &str = "federation";

pub struct FederationStore {
    db: Db,
}

impl FederationStore {
    pub fn new(db: Db) -> anyhow::Result<Self> {
        Ok(Self { db })
    }

    pub fn store_pending_trust(&self, server_pubkey: String) -> anyhow::Result<()> {
        let tree = self.db.open_tree(FEDERATION_TREE)?;
        let key = format!("pending_{}", server_pubkey);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        tree.insert(key.as_bytes(), timestamp.to_string().as_bytes())?;
        tree.flush()?;
        Ok(())
    }

    pub fn approve_trust(&self, server_pubkey: &str) -> bool {
        let tree = match self.db.open_tree(FEDERATION_TREE) {
            Ok(t) => t,
            Err(_) => return false,
        };

        let pending_key = format!("pending_{}", server_pubkey);
        if tree.get(pending_key.as_bytes()).ok().flatten().is_none() {
            return false;
        }

        let trusted_key = format!("trusted_{}", server_pubkey);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        tree.insert(trusted_key.as_bytes(), timestamp.to_string().as_bytes())
            .ok();
        tree.remove(pending_key.as_bytes()).ok();
        tree.flush().ok();

        true
    }

    pub fn is_trusted(&self, server_pubkey: &str) -> bool {
        let tree = match self.db.open_tree(FEDERATION_TREE) {
            Ok(t) => t,
            Err(_) => return false,
        };

        let key = format!("trusted_{}", server_pubkey);
        tree.get(key.as_bytes()).ok().flatten().is_some()
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
        let key = format!("trusted_{}", server_pubkey);
        tree.remove(key.as_bytes())?;
        tree.flush()?;
        Ok(())
    }
}
