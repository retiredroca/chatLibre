use crate::commands::storage::StorageManager;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use sodiumoxide::crypto::{aead, secretbox};
use tauri::State;

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
    pub nonce: String,
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

    let recipient_bytes = BASE64
        .decode(&recipient_public_key)
        .map_err(|e| format!("Invalid recipient key: {}", e))?;
    let sender_bytes = BASE64
        .decode(&sender_private_key)
        .map_err(|e| format!("Invalid sender key: {}", e))?;

    if sender_bytes.len() != 32 || recipient_bytes.len() != 32 {
        return Err("Invalid key length".to_string());
    }

    let plaintext_bytes = plaintext.as_bytes();

    let shared_key = {
        use sodiumoxide::crypto::kx;

        let kx_public = kx::PublicKey::from_slice(&recipient_bytes)
            .map_err(|_| "Invalid recipient key for kx")?;
        let kx_secret =
            kx::SecretKey::from_slice(&sender_bytes).map_err(|_| "Invalid sender key for kx")?;

        let (session_key, _) =
            kx::server_session_keys(&kx_secret, &kx_public).map_err(|_| "Key exchange failed")?;
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

    let ciphertext = BASE64
        .decode(&encrypted.ciphertext)
        .map_err(|e| format!("Invalid ciphertext: {}", e))?;
    let nonce_bytes = BASE64
        .decode(&encrypted.nonce)
        .map_err(|e| format!("Invalid nonce: {}", e))?;
    let sender_bytes = BASE64
        .decode(&sender_public_key)
        .map_err(|e| format!("Invalid sender key: {}", e))?;
    let recipient_bytes = BASE64
        .decode(&recipient_private_key)
        .map_err(|e| format!("Invalid recipient key: {}", e))?;

    let nonce = secretbox::Nonce::from_slice(&nonce_bytes).ok_or("Invalid nonce")?;

    let shared_key = {
        let sender_pubkey = sodiumoxide::crypto::kx::PublicKey::from_slice(sender_bytes.as_slice())
            .map_err(|_| "Invalid sender key")?;
        let recipient_secret =
            sodiumoxide::crypto::kx::SecretKey::from_slice(recipient_bytes.as_slice())
                .map_err(|_| "Invalid recipient key")?;

        let (_, session_key) =
            sodiumoxide::crypto::kx::client_session_keys(&recipient_secret, &sender_pubkey)
                .map_err(|_| "Key exchange failed")?;
        session_key.0
    };

    let decrypted = secretbox::open(&ciphertext, &nonce, &secretbox::Key(shared_key))
        .map_err(|_| "Decryption failed - wrong key or corrupted data")?;

    String::from_utf8(decrypted).map_err(|_| "Decrypted data is not valid UTF-8".to_string())
}

#[tauri::command]
pub fn encrypt_file(
    file_data: Vec<u8>,
    original_name: String,
    mime_type: String,
    sender_private_key: String,
    recipient_public_key: String,
) -> Result<EncryptedFile, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;

    let file_key = aead::gen_nonce();

    let sender_bytes = BASE64
        .decode(&sender_private_key)
        .map_err(|e| format!("Invalid sender key: {}", e))?;
    let recipient_bytes = BASE64
        .decode(&recipient_public_key)
        .map_err(|e| format!("Invalid recipient key: {}", e))?;

    if sender_bytes.len() != 32 || recipient_bytes.len() != 32 {
        return Err("Invalid key length".to_string());
    }

    let sender_pubkey = sodiumoxide::crypto::sign::PublicKey::from_slice(&sender_bytes)
        .ok_or("Invalid sender public key")?;
    let recipient_kx_pk = sodiumoxide::crypto::kx::PublicKey::from_slice(&recipient_bytes)
        .ok_or("Invalid recipient key for kx")?;

    let shared_key = {
        let sender_kx_sk = sodiumoxide::crypto::kx::SecretKey::from_slice(&sender_bytes)
            .ok_or("Invalid sender key for kx")?;
        let (_, session_key) =
            sodiumoxide::crypto::kx::client_session_keys(&sender_kx_sk, &recipient_kx_pk)
                .map_err(|_| "Key exchange failed")?;
        session_key.0
    };

    let key_nonce = secretbox::Nonce::gen();
    let encrypted_file_key =
        secretbox::seal(file_key.as_ref(), &key_nonce, &secretbox::Key(shared_key));

    let file_nonce = aead::gen_nonce();
    let encrypted_blob = aead::seal(&file_data, None, &file_key, &file_nonce);

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
        nonce: BASE64.encode(file_nonce.as_ref()),
        key_nonce: BASE64.encode(key_nonce.as_ref()),
        key_ciphertext: BASE64.encode(&encrypted_file_key),
    })
}

#[tauri::command]
pub fn decrypt_file(
    encrypted_file: EncryptedFile,
    sender_public_key: String,
    recipient_private_key: String,
) -> Result<Vec<u8>, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;

    let sender_bytes = BASE64
        .decode(&sender_public_key)
        .map_err(|e| format!("Invalid sender key: {}", e))?;
    let recipient_bytes = BASE64
        .decode(&recipient_private_key)
        .map_err(|e| format!("Invalid recipient key: {}", e))?;

    let file_key_nonce = secretbox::Nonce::from_slice(
        &BASE64
            .decode(&encrypted_file.key_nonce)
            .map_err(|e| e.to_string())?,
    )
    .ok_or("Invalid nonce")?;

    let encrypted_key_bytes = BASE64
        .decode(&encrypted_file.key_ciphertext)
        .map_err(|e| e.to_string())?;

    let shared_key = {
        let sender_pubkey = sodiumoxide::crypto::kx::PublicKey::from_slice(&sender_bytes)
            .ok_or("Invalid sender public key")?;
        let recipient_kx_sk = sodiumoxide::crypto::kx::SecretKey::from_slice(&recipient_bytes)
            .ok_or("Invalid recipient key for kx")?;
        let (_, session_key) =
            sodiumoxide::crypto::kx::server_session_keys(&recipient_kx_sk, &sender_pubkey)
                .map_err(|_| "Key exchange failed")?;
        session_key.0
    };

    let file_key_bytes = secretbox::open(
        &encrypted_key_bytes,
        &file_key_nonce,
        &secretbox::Key(shared_key),
    )
    .map_err(|_| "Failed to decrypt file key - wrong key or corrupted data")?;

    let file_key = aead::Key::from_slice(&file_key_bytes).ok_or("Invalid file key")?;

    let file_nonce_bytes = BASE64
        .decode(&encrypted_file.nonce)
        .map_err(|e| format!("Invalid file nonce: {}", e))?;
    let file_nonce = aead::Nonce::from_slice(&file_nonce_bytes).ok_or("Invalid file nonce")?;

    let decrypted = aead::open(&encrypted_file.encrypted_blob, None, file_key, file_nonce)
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
