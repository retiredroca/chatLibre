#![allow(dead_code)]
use super::messages::{ClientMessage, ReactionAction};
use crate::protocol::messages::ChannelType as MsgChannelType;

pub fn validate_message(msg: &ClientMessage) -> Result<(), ValidationError> {
    match msg {
        ClientMessage::ChatMessage {
            channel_id,
            ciphertext,
            nonce,
            ..
        } => {
            validate_channel_id(channel_id)?;
            validate_ciphertext(ciphertext)?;
            validate_nonce(nonce)?;
        }

        ClientMessage::ChatEdit {
            channel_id,
            message_id,
            ciphertext,
            nonce,
        } => {
            validate_channel_id(channel_id)?;
            validate_message_id(message_id)?;
            validate_ciphertext(ciphertext)?;
            validate_nonce(nonce)?;
        }

        ClientMessage::ChatDelete {
            channel_id,
            message_id,
        } => {
            validate_channel_id(channel_id)?;
            validate_message_id(message_id)?;
        }

        ClientMessage::ChatReaction {
            channel_id,
            message_id,
            emoji,
            action,
        } => {
            validate_channel_id(channel_id)?;
            validate_message_id(message_id)?;
            validate_emoji(emoji)?;
            validate_reaction_action(action)?;
        }

        ClientMessage::ChannelCreate {
            name, channel_type, ..
        } => {
            validate_channel_name(name)?;
            validate_channel_type(channel_type)?;
        }

        ClientMessage::ChannelUpdate {
            channel_id, name, ..
        } => {
            validate_channel_id(channel_id)?;
            if let Some(n) = name {
                validate_channel_name(n)?;
            }
        }

        ClientMessage::ChannelDelete { channel_id } => {
            validate_channel_id(channel_id)?;
        }

        ClientMessage::FederationRelay {
            target_server,
            encrypted_payload,
            ..
        } => {
            if target_server.is_empty() || target_server.len() > 256 {
                return Err(ValidationError::InvalidField("target_server".to_string()));
            }
            if encrypted_payload.is_empty() || encrypted_payload.len() > 1024 * 1024 {
                return Err(ValidationError::InvalidField(
                    "encrypted_payload".to_string(),
                ));
            }
        }

        ClientMessage::SyncRequest { since, channel_id } => {
            if let Some(s) = since {
                if *s > u64::MAX / 1000 {
                    return Err(ValidationError::InvalidField("since".to_string()));
                }
            }
            if let Some(cid) = channel_id {
                validate_channel_id(cid)?;
            }
        }

        ClientMessage::PresenceUpdate { status } => {
            validate_presence_status(status)?;
        }
    }

    Ok(())
}

fn validate_channel_id(id: &str) -> Result<(), ValidationError> {
    if id.is_empty() || id.len() > 128 {
        return Err(ValidationError::InvalidField("channel_id".to_string()));
    }
    Ok(())
}

fn validate_message_id(id: &str) -> Result<(), ValidationError> {
    if id.is_empty() || id.len() > 128 {
        return Err(ValidationError::InvalidField("message_id".to_string()));
    }
    Ok(())
}

fn validate_ciphertext(ct: &str) -> Result<(), ValidationError> {
    if ct.is_empty() || ct.len() > 65536 {
        return Err(ValidationError::InvalidField("ciphertext".to_string()));
    }
    Ok(())
}

fn validate_nonce(nonce: &str) -> Result<(), ValidationError> {
    if nonce.is_empty() || nonce.len() > 64 {
        return Err(ValidationError::InvalidField("nonce".to_string()));
    }
    Ok(())
}

fn validate_channel_name(name: &str) -> Result<(), ValidationError> {
    if name.is_empty() || name.len() > 100 {
        return Err(ValidationError::InvalidField("name".to_string()));
    }
    if !is_valid_channel_name(name) {
        return Err(ValidationError::InvalidChannelName);
    }
    Ok(())
}

fn validate_emoji(emoji: &str) -> Result<(), ValidationError> {
    if emoji.is_empty() || emoji.len() > 32 {
        return Err(ValidationError::InvalidField("emoji".to_string()));
    }
    Ok(())
}

fn validate_reaction_action(action: &ReactionAction) -> Result<(), ValidationError> {
    match action {
        ReactionAction::Add | ReactionAction::Remove => Ok(()),
    }
}

fn validate_presence_status(
    status: &crate::protocol::messages::PresenceStatus,
) -> Result<(), ValidationError> {
    match status {
        crate::protocol::messages::PresenceStatus::Online
        | crate::protocol::messages::PresenceStatus::Idle
        | crate::protocol::messages::PresenceStatus::Dnd
        | crate::protocol::messages::PresenceStatus::Offline => Ok(()),
    }
}

fn is_valid_channel_name(name: &str) -> bool {
    name.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
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
                write!(
                    f,
                    "Invalid channel name (lowercase, numbers, hyphens, underscores only)"
                )
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
