pub mod identity;
pub mod storage;
pub mod crypto;

use std::sync::{Arc, Mutex};

pub struct StorageManager {
    pub conn: Mutex<rusqlite::Connection>,
}

impl StorageManager {
    pub fn new(app_handle: tauri::AppHandle) -> Result<Self, String> {
        std::fs::create_dir_all(".chatlibre").map_err(|e| e.to_string())?;
        
        let conn = rusqlite::Connection::open(".chatlibre/storage.db")
            .map_err(|e| format!("Failed to open database: {}", e))?;
        
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                sender_key TEXT NOT NULL,
                ciphertext TEXT NOT NULL,
                nonce TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_starred INTEGER DEFAULT 0,
                reply_to TEXT,
                thread_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);"
        ).map_err(|e| format!("Failed to initialize database: {}", e))?;
        
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}
