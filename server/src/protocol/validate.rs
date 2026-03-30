use super::messages::{ChannelType, ClientMessage};
use crate::protocol::messages::ChannelType as MsgChannelType;

pub fn validate_message(msg: &ClientMessage) -> Result<(), ValidationError> {
    match msg {
        ClientMessage::ChatMessage { 
            channel_id, 
            ciphertext, 
            nonce, 
            .. 
        } => {
            if channel_id.is_empty() || channel_id.len() > 128 {
                return Err(ValidationError::InvalidField("channel_id".to_string()));
            }
            if ciphertext.is_empty() || ciphertext.len() > 65536 {
                return Err(ValidationError::InvalidField("ciphertext".to_string()));
            }
            if nonce.is_empty() || nonce.len() > 64 {
                return Err(ValidationError::InvalidField("nonce".to_string()));
            }
        }
        
        ClientMessage::ChannelCreate { 
            name, 
            channel_type, 
            .. 
        } => {
            if name.is_empty() || name.len() > 100 {
                return Err(ValidationError::InvalidField("name".to_string()));
            }
            if !is_valid_channel_name(name) {
                return Err(ValidationError::InvalidChannelName);
            }
            validate_channel_type(channel_type)?;
        }
        
        ClientMessage::FederationRelay { 
            target_server, 
            encrypted_payload, 
            .. 
        } => {
            if target_server.is_empty() {
                return Err(ValidationError::InvalidField("target_server".to_string()));
            }
            if encrypted_payload.is_empty() || encrypted_payload.len() > 1024 * 1024 {
                return Err(ValidationError::InvalidField("encrypted_payload".to_string()));
            }
        }
        
        _ => {}
    }
    
    Ok(())
}

fn is_valid_channel_name(name: &str) -> bool {
    name.chars().all(|c| {
        c.is_ascii_lowercase() || 
        c.is_ascii_digit() || 
        c == '-' || 
        c == '_'
    })
}

fn validate_channel_type(t: &MsgChannelType) -> Result<(), ValidationError> {
    match t {
        MsgChannelType::Text | MsgChannelType::Voice | MsgChannelType::Category => Ok(()),
    }
}

#[derive(Debug, Clone)]
pub enum ValidationError {
    InvalidField(String),
    InvalidChannelName,
    InvalidChannelType,
    MessageTooLarge,
    InvalidSignature,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::InvalidField(field) => {
                write!(f, "Invalid field: {}", field)
            }
            ValidationError::InvalidChannelName => {
                write!(f, "Invalid channel name (lowercase, numbers, hyphens, underscores only)")
            }
            ValidationError::InvalidChannelType => {
                write!(f, "Invalid channel type")
            }
            ValidationError::MessageTooLarge => {
                write!(f, "Message exceeds maximum size")
            }
            ValidationError::InvalidSignature => {
                write!(f, "Invalid message signature")
            }
        }
    }
}

impl std::error::Error for ValidationError {}
