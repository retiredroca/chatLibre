use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use crate::crypto;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub id: String,
    pub channel_id: String,
    pub sender_key: String,
    pub ciphertext: String,
    pub nonce: String,
    pub timestamp: u64,
    pub is_starred: bool,
    pub reply_to: Option<String>,
    pub thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredReaction {
    pub id: String,
    pub message_id: String,
    pub user_key: String,
    pub emoji: String,
}

pub struct StorageManager {
    conn: Mutex<Connection>,
}

impl StorageManager {
    pub fn new(_app_handle: tauri::AppHandle) -> Result<Self, String> {
        std::fs::create_dir_all(".chatlibre").map_err(|e| e.to_string())?;
        
        let conn = Connection::open(".chatlibre/storage.db")
            .map_err(|e| format!("Failed to open database: {}", e))?;
        
        conn.execute_batch(
            "PRAGMA key = 'chatlibre_encryption_key';
             CREATE TABLE IF NOT EXISTS messages (
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
             CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
             CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
             
             CREATE TABLE IF NOT EXISTS reactions (
                 id TEXT PRIMARY KEY,
                 message_id TEXT NOT NULL,
                 user_key TEXT NOT NULL,
                 emoji TEXT NOT NULL,
                 FOREIGN KEY(message_id) REFERENCES messages(id)
             );
             
             CREATE TABLE IF NOT EXISTS contacts (
                 public_key TEXT PRIMARY KEY,
                 display_name TEXT,
                 identity_key TEXT,
                 first_seen INTEGER
             );
             
             CREATE TABLE IF NOT EXISTS servers (
                 id TEXT PRIMARY KEY,
                 url TEXT NOT NULL,
                 name TEXT,
                 public_key TEXT NOT NULL,
                 is_trusted INTEGER DEFAULT 0,
                 added_at INTEGER
             );
             
             CREATE TABLE IF NOT EXISTS settings (
                 key TEXT PRIMARY KEY,
                 value TEXT
             );"
        ).map_err(|e| format!("Failed to initialize database: {}", e))?;
        
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

#[tauri::command]
pub fn store_message(
    state: State<StorageManager>,
    message: StoredMessage,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR REPLACE INTO messages 
         (id, channel_id, sender_key, ciphertext, nonce, timestamp, is_starred, reply_to, thread_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            message.id,
            message.channel_id,
            message.sender_key,
            message.ciphertext,
            message.nonce,
            message.timestamp,
            message.is_starred as i32,
            message.reply_to,
            message.thread_id,
        ],
    ).map_err(|e| format!("Failed to store message: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_messages(
    state: State<StorageManager>,
    channel_id: String,
    limit: Option<u32>,
    before: Option<u64>,
) -> Result<Vec<StoredMessage>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);
    
    let query = if let Some(before_ts) = before {
        format!(
            "SELECT * FROM messages WHERE channel_id = ?1 AND timestamp < {} ORDER BY timestamp DESC LIMIT {}",
            before_ts, limit
        )
    } else {
        format!(
            "SELECT * FROM messages WHERE channel_id = ?1 ORDER BY timestamp DESC LIMIT {}",
            limit
        )
    };
    
    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let messages = stmt.query_map(params![channel_id], |row| {
        Ok(StoredMessage {
            id: row.get(0)?,
            channel_id: row.get(1)?,
            sender_key: row.get(2)?,
            ciphertext: row.get(3)?,
            nonce: row.get(4)?,
            timestamp: row.get(5)?,
            is_starred: row.get::<_, i32>(6)? != 0,
            reply_to: row.get(7)?,
            thread_id: row.get(8)?,
        })
    }).map_err(|e| format!("Failed to query messages: {}", e))?;
    
    messages.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect messages: {}", e))
}

#[tauri::command]
pub fn delete_message(
    state: State<StorageManager>,
    message_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM messages WHERE id = ?1", params![message_id])
        .map_err(|e| format!("Failed to delete message: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_messages_by_channel(
    state: State<StorageManager>,
    channel_id: String,
) -> Result<Vec<StoredMessage>, String> {
    get_messages(state, channel_id, Some(1000), None)
}

#[tauri::command]
pub fn star_message(
    state: State<StorageManager>,
    message_id: String,
    starred: bool,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE messages SET is_starred = ?1 WHERE id = ?2",
        params![starred as i32, message_id],
    ).map_err(|e| format!("Failed to star message: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_storage_stats(
    state: State<StorageManager>,
) -> Result<StorageStats, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let total_messages: i64 = conn
        .query_row("SELECT COUNT(*) FROM messages", [], |row| row.get(0))
        .unwrap_or(0);
    
    let starred_messages: i64 = conn
        .query_row("SELECT COUNT(*) FROM messages WHERE is_starred = 1", [], |row| row.get(0))
        .unwrap_or(0);
    
    let database_size = std::fs::metadata(".chatlibre/storage.db")
        .map(|m| m.len())
        .unwrap_or(0);
    
    Ok(StorageStats {
        total_messages,
        starred_messages,
        database_size_bytes: database_size,
    })
}

#[derive(Debug, Serialize)]
pub struct StorageStats {
    pub total_messages: i64,
    pub starred_messages: i64,
    pub database_size_bytes: u64,
}
