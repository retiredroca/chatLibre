#![allow(dead_code)]
use ring::signature::{Ed25519KeyPair, KeyPair, ED25519};
use serde::{Deserialize, Serialize};
use sled::Db;

const SERVER_IDENTITY_TREE: &str = "server_identity";
const PRIVATE_KEY_PREFIX: &[u8] = b"private_key";
const PUBLIC_KEY_PREFIX: &[u8] = b"public_key";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerIdentityData {
    pub server_id: String,
    pub public_key: Vec<u8>,
    pub created_at: u64,
}

pub struct ServerIdentity {
    key_pair: Ed25519KeyPair,
    server_id: String,
    created_at: u64,
}

impl ServerIdentity {
    pub fn load_or_generate(db: &Db) -> anyhow::Result<Self> {
        let tree = db.open_tree(SERVER_IDENTITY_TREE)?;

        if let Some(private_key_bytes) = tree.get(PRIVATE_KEY_PREFIX)? {
            let key_pair = Ed25519KeyPair::from_pkcs8(private_key_bytes.as_ref())
                .map_err(|_| anyhow::anyhow!("Invalid private key"))?;

            let public_key = key_pair.public_key().as_ref().to_vec();
            let server_id = Self::derive_server_id(&public_key);
            let created_at = tree
                .get("created_at")?
                .and_then(|v| String::from_utf8(v.to_vec()).ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or_else(|| {
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                });

            Ok(Self {
                key_pair,
                server_id,
                created_at,
            })
        } else {
            let rng = ring::rand::SystemRandom::new();
            let pkcs8_bytes = Ed25519KeyPair::generate_pkcs8(&rng)
                .map_err(|_| anyhow::anyhow!("Failed to generate keypair"))?;

            let key_pair = Ed25519KeyPair::from_pkcs8(pkcs8_bytes.as_ref())
                .map_err(|_| anyhow::anyhow!("Failed to parse generated keypair"))?;

            let public_key = key_pair.public_key().as_ref().to_vec();
            let server_id = Self::derive_server_id(&public_key);
            let created_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs();

            tree.insert(PRIVATE_KEY_PREFIX, pkcs8_bytes.as_ref())?;
            tree.insert(PUBLIC_KEY_PREFIX, public_key.as_slice())?;
            tree.insert(b"created_at", created_at.to_string().as_bytes())?;
            tree.flush()?;

            Ok(Self {
                key_pair,
                server_id,
                created_at,
            })
        }
    }

    fn derive_server_id(public_key: &[u8]) -> String {
        let hash = ring::digest::digest(&ring::digest::SHA256, public_key);
        let hash_bytes = hash.as_ref();
        format!("kf_{}", bs58::encode(hash_bytes).into_string())
    }

    pub fn server_id(&self) -> &str {
        &self.server_id
    }

    pub fn public_key(&self) -> &[u8] {
        self.key_pair.public_key().as_ref()
    }

    pub fn public_key_pem(&self) -> String {
        use base64::Engine as _;
        let encoded = base64::engine::general_purpose::STANDARD.encode(self.public_key());
        format!(
            "-----BEGIN ED25519-----\n{}\n-----END ED25519-----",
            encoded
        )
    }

    pub fn sign(&self, message: &[u8]) -> String {
        use base64::Engine as _;
        let signature = self.key_pair.sign(message);
        base64::engine::general_purpose::STANDARD.encode(signature.as_ref())
    }

    pub fn verify_signature(
        &self,
        message: &[u8],
        signature_base64: &str,
        public_key_base64: &str,
    ) -> bool {
        use base64::Engine as _;

        let Ok(signature_bytes) =
            base64::engine::general_purpose::STANDARD.decode(signature_base64)
        else {
            return false;
        };

        let Ok(public_key_bytes) =
            base64::engine::general_purpose::STANDARD.decode(public_key_base64)
        else {
            return false;
        };

        let public_key = ring::signature::UnparsedPublicKey::new(&ED25519, public_key_bytes);
        public_key.verify(message, &signature_bytes).is_ok()
    }
}
