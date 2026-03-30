use serde::{Deserialize, Serialize};
use sodiumoxide::crypto::sign::{self, Seed, SignKeyPair};
use bip39::{Mnemonic, Language, MnemonicType};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub public_key: String,
    #[serde(skip_serializing)]
    private_key: Option<String>,
    pub user_id: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryInfo {
    pub mnemonic: String,
    pub public_key: String,
    pub user_id: String,
}

#[tauri::command]
pub fn generate_identity() -> Result<RecoveryInfo, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let (public_key, private_key) = sign::gen_keypair();
    
    let entropy = private_key.0;
    let mnemonic = Mnemonic::from_entropy(&entropy, Language::English)
        .map_err(|e| format!("Failed to generate mnemonic: {}", e))?;
    
    let hash = sodiumoxide::crypto::hash::sha256::hash(&public_key.0);
    let user_id = format!("kf_{}", bs58::encode(hash.0).into_string());
    
    let recovery = RecoveryInfo {
        mnemonic: mnemonic.phrase().to_string(),
        public_key: BASE64.encode(public_key.0),
        user_id,
    };
    
    std::fs::create_dir_all(".chatlibre/identity").map_err(|e| e.to_string())?;
    let identity = Identity {
        public_key: BASE64.encode(public_key.0),
        private_key: Some(BASE64.encode(private_key.0)),
        user_id: recovery.user_id.clone(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    let path = ".chatlibre/identity/identity.json";
    let file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &identity)
        .map_err(|e| e.to_string())?;
    
    Ok(recovery)
}

#[tauri::command]
pub fn get_public_key() -> Result<Identity, String> {
    let path = ".chatlibre/identity/identity.json";
    let content = std::fs::read_to_string(path)
        .map_err(|_| "No identity found. Please create an identity first.".to_string())?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse identity: {}", e))
}

#[tauri::command]
pub fn export_recovery_phrase() -> Result<String, String> {
    let path = ".chatlibre/identity/identity.json";
    let content = std::fs::read_to_string(path)
        .map_err(|_| "No identity found".to_string())?;
    
    let identity: Identity = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    let private_key_bytes = identity.private_key
        .ok_or("Private key not available")?;
    let private_key_vec = BASE64.decode(private_key_bytes)
        .map_err(|e| e.to_string())?;
    
    let entropy = private_key_vec.as_slice().try_into()
        .map_err(|_| "Invalid private key length")?;
    
    let mnemonic = Mnemonic::from_entropy(entropy, Language::English)
        .map_err(|e| format!("Failed to decode mnemonic: {}", e))?;
    
    Ok(mnemonic.phrase().to_string())
}

#[tauri::command]
pub fn import_from_recovery_phrase(mnemonic_phrase: String) -> Result<RecoveryInfo, String> {
    sodiumoxide::init().map_err(|e| format!("Failed to init sodium: {}", e))?;
    
    let mnemonic = Mnemonic::parse(&mnemonic_phrase)
        .map_err(|e| format!("Invalid recovery phrase: {}", e))?;
    
    let entropy = mnemonic.entropy();
    
    if entropy.len() != 32 {
        return Err("Invalid entropy length".to_string());
    }
    
    let mut entropy_array = [0u8; 32];
    entropy_array.copy_from_slice(entropy);
    
    let keypair = sign::keypair_from_seed(&Seed(entropy_array));
    let hash = sodiumoxide::crypto::hash::sha256::hash(&keypair.0);
    let user_id = format!("kf_{}", bs58::encode(hash.0).into_string());
    
    let identity = Identity {
        public_key: BASE64.encode(keypair.0),
        private_key: Some(BASE64.encode(keypair.1)),
        user_id: user_id.clone(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    std::fs::create_dir_all(".chatlibre/identity").map_err(|e| e.to_string())?;
    let path = ".chatlibre/identity/identity.json";
    let file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &identity)
        .map_err(|e| e.to_string())?;
    
    Ok(RecoveryInfo {
        mnemonic: mnemonic_phrase,
        public_key: BASE64.encode(keypair.0),
        user_id,
    })
}
