use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use sodiumoxide::crypto::{secretbox, aead};
use tauri::State;
use crate::commands::storage::StorageManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub ciphertext: String,
    pub nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBundle {
    pub identity_key: String,
    pub signed_prekey: String,
    pub signed_prekey_signature: String,
    pub one_time_prekeys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub original_name: String,
    pub mime_type: String,
    pub size_original: u64,
    pub size_encrypted: u64,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedFile {
    pub metadata: FileMetadata,
    pub encrypted_blob: Vec<u8>,
    pub key_nonce: String,
    pub key_ciphertext: String,
}

#[tauri::command]
pub fn encrypt_message(
    plaintext: String,
    recipient_public_key: String,
    sender_private_key: String,
) -> Result<EncryptedPayload, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let recipient_bytes = BASE64.decode(&recipient_public_key)
        .map_err(|e| format!("Invalid recipient key: {}", e))?;
    let sender_bytes = BASE64.decode(&sender_private_key)
        .map_err(|e| format!("Invalid sender key: {}", e))?;
    
    if sender_bytes.len() != 32 || recipient_bytes.len() != 32 {
        return Err("Invalid key length".to_string());
    }
    
    let plaintext_bytes = plaintext.as_bytes();
    
    let shared_key = {
        use sodiumoxide::crypto::kx;
        let (pk, sk) = if cfg!(feature = "curve25519") {
            (recipient_bytes.as_slice().try_into(), sender_bytes.as_slice().try_into())
        } else {
            let sender_keypair = sodiumoxide::crypto::sign::ed25519::SecretKey::from_slice(&sender_bytes)
                .ok_or("Invalid sender key")?;
            let sender_pubkey = sodiumoxide::crypto::sign::ed25519::PublicKey::from_slice(&recipient_bytes)
                .ok_or("Invalid recipient key")?;
            
            let combined = [
                sender_keypair.0.as_ref(),
                sender_pubkey.0.as_ref(),
            ];
            
            let hash = sodiumoxide::crypto::hash::sha256::hash(&combined);
            (
                Ok(hash.0[..32].try_into().unwrap()),
                Ok([0u8; 32])
            )
        };
        let kx_public = kx::PublicKey::from_slice(recipient_bytes.as_slice())
            .map_err(|_| "Invalid recipient key for kx")?;
        let kx_secret = kx::SecretKey::from_slice(sender_bytes.as_slice())
            .map_err(|_| "Invalid sender key for kx")?;
        
        let (session_key, _) = kx::server_session_keys(&kx_secret, &kx_public)
            .map_err(|_| "Key exchange failed")?;
        session_key.0
    };
    
    let nonce = secretbox::Nonce::gen();
    
    let ciphertext = secretbox::seal(plaintext_bytes, &nonce, &secretbox::Key(shared_key));
    
    Ok(EncryptedPayload {
        ciphertext: BASE64.encode(&ciphertext),
        nonce: BASE64.encode(nonce.as_ref()),
    })
}

#[tauri::command]
pub fn decrypt_message(
    encrypted: EncryptedPayload,
    sender_public_key: String,
    recipient_private_key: String,
) -> Result<String, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let ciphertext = BASE64.decode(&encrypted.ciphertext)
        .map_err(|e| format!("Invalid ciphertext: {}", e))?;
    let nonce_bytes = BASE64.decode(&encrypted.nonce)
        .map_err(|e| format!("Invalid nonce: {}", e))?;
    let sender_bytes = BASE64.decode(&sender_public_key)
        .map_err(|e| format!("Invalid sender key: {}", e))?;
    let recipient_bytes = BASE64.decode(&recipient_private_key)
        .map_err(|e| format!("Invalid recipient key: {}", e))?;
    
    let nonce = secretbox::Nonce::from_slice(&nonce_bytes)
        .ok_or("Invalid nonce")?;
    
    let shared_key = {
        let sender_pubkey = sodiumoxide::crypto::kx::PublicKey::from_slice(sender_bytes.as_slice())
            .map_err(|_| "Invalid sender key")?;
        let recipient_secret = sodiumoxide::crypto::kx::SecretKey::from_slice(recipient_bytes.as_slice())
            .map_err(|_| "Invalid recipient key")?;
        
        let (_, session_key) = sodiumoxide::crypto::kx::client_session_keys(&recipient_secret, &sender_pubkey)
            .map_err(|_| "Key exchange failed")?;
        session_key.0
    };
    
    let decrypted = secretbox::open(&ciphertext, &nonce, &secretbox::Key(shared_key))
        .map_err(|_| "Decryption failed - wrong key or corrupted data")?;
    
    String::from_utf8(decrypted)
        .map_err(|_| "Decrypted data is not valid UTF-8".to_string())
}

#[tauri::command]
pub fn encrypt_file(
    file_data: Vec<u8>,
    original_name: String,
    mime_type: String,
) -> Result<EncryptedFile, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let file_key = aead::gen_nonce();
    
    let key_nonce = secretbox::Nonce::gen();
    let encrypted_file_key = secretbox::seal(file_key.as_ref(), &key_nonce, &secretbox::gen_key());
    
    let encrypted_blob = aead::seal(&file_data, None, &file_key, &file_key);
    
    let content_hash = sodiumoxide::crypto::hash::sha256::hash(&encrypted_blob);
    
    let file_metadata = FileMetadata {
        original_name,
        mime_type,
        size_original: file_data.len() as u64,
        size_encrypted: encrypted_blob.len() as u64,
        content_hash: BASE64.encode(content_hash.0),
    };
    
    Ok(EncryptedFile {
        metadata: file_metadata,
        encrypted_blob,
        key_nonce: BASE64.encode(key_nonce.as_ref()),
        key_ciphertext: BASE64.encode(&encrypted_file_key),
    })
}

#[tauri::command]
pub fn decrypt_file(
    encrypted_file: EncryptedFile,
) -> Result<Vec<u8>, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let file_key_nonce = secretbox::Nonce::from_slice(
        &BASE64.decode(&encrypted_file.key_nonce).map_err(|e| e.to_string())?
    ).ok_or("Invalid nonce")?;
    
    let encrypted_key_bytes = BASE64.decode(&encrypted_file.key_ciphertext)
        .map_err(|e| e.to_string())?;
    
    let dummy_key = secretbox::gen_key();
    let file_key_bytes = secretbox::open(&encrypted_key_bytes, &file_key_nonce, &dummy_key)
        .map_err(|_| "Failed to decrypt file key")?;
    
    let file_key = aead::Key::from_slice(&file_key_bytes)
        .ok_or("Invalid file key")?;
    
    let decrypted = aead::open(&encrypted_file.encrypted_blob, None, file_key)
        .map_err(|_| "Failed to decrypt file")?;
    
    Ok(decrypted)
}

pub fn generate_key_bundle() -> Result<KeyBundle, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let (identity_pk, identity_sk) = sodiumoxide::crypto::sign::gen_keypair();
    
    let (signed_prekey_pk, signed_prekey_sk) = sodiumoxide::crypto::kx::gen_server_keys();
    
    let signature = identity_sk.sign(signed_prekey_pk.as_ref());
    
    Ok(KeyBundle {
        identity_key: BASE64.encode(identity_pk.as_ref()),
        signed_prekey: BASE64.encode(signed_prekey_pk.as_ref()),
        signed_prekey_signature: BASE64.encode(&signature),
        one_time_prekeys: vec![],
    })
}
