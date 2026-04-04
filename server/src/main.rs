#![allow(dead_code)]
use axum::{
    extract::{Query, State},
    extract::ws::{WebSocketUpgrade, Message as WsMessage},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use sled::Db;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use tokio::time::{interval, Duration};
use tower_http::cors::CorsLayer;
use tracing::{info, warn};

mod crypto;
mod protocol;
mod storage;

use crypto::identity::ServerIdentity;
use crypto::federation::{PeerDiscovery, AddrMessage};
use storage::{channels::ChannelStore, federation::FederationStore, server_meta::ServerMetaStore, rate_limit::RateLimiters};

#[derive(Clone)]
struct AppState {
    identity: Arc<ServerIdentity>,
    db: Arc<Db>,
    channels: Arc<Mutex<ChannelStore>>,
    federation: Arc<Mutex<FederationStore>>,
    meta: Arc<Mutex<ServerMetaStore>>,
    peer_discovery: Arc<Mutex<PeerDiscovery>>,
    tx: broadcast::Sender<RelayMessage>,
    rate_limiters: Arc<Mutex<RateLimiters>>,
}

#[derive(Debug, Clone)]
struct RelayMessage {
    target_channel: String,
    sender_key: String,
    encrypted_payload: Vec<u8>,
}

#[derive(Deserialize)]
struct ConnectQuery {
    server_id: Option<String>,
    token: Option<String>,
}

#[derive(Serialize)]
struct CapabilitiesResponse {
    version: String,
    features: Vec<String>,
    server_pubkey: String,
    #[serde(rename = "server_id")]
    server_id: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    #[serde(rename = "server_id")]
    server_id: String,
    uptime_seconds: u64,
}

#[derive(Serialize)]
struct ServerInfoResponse {
    name: String,
    description: Option<String>,
    icon_url: Option<String>,
    banner_url: Option<String>,
    #[serde(rename = "server_id")]
    server_id: String,
    channels: Vec<protocol::types::ChannelMeta>,
    roles: Vec<protocol::types::RoleMeta>,
}

async fn websocket_handler(
    State(state): State<AppState>,
    Query(params): Query<ConnectQuery>,
    ws: WebSocketUpgrade,
) {
    if params.token.is_none() {
        warn!("WebSocket connection rejected: missing authentication token");
        return;
    }

    let token = params.token.unwrap();
    if !validate_auth_token(&token, &state) {
        warn!("WebSocket connection rejected: invalid authentication token");
        return;
    }

    let client_id = uuid::Uuid::new_v4().to_string();
    info!(client_id = %client_id, "New WebSocket connection");
    
    let _ = state;
    
    let _ = ws.on_upgrade(|ws| async move {
        let (mut sender, mut receiver) = ws.split();
        
        loop {
            tokio::select! {
                msg = receiver.next() => {
                    match msg {
                        Some(Ok(WsMessage::Binary(data))) => {
                            info!(bytes = data.len(), "Received binary message");
                        }
                        Some(Ok(WsMessage::Text(text))) => {
                            info!(text = %text, "Received text message");
                        }
                        Some(Ok(WsMessage::Close(_))) => {
                            info!("WebSocket closed");
                            break;
                        }
                        Some(Err(e)) => {
                            warn!(error = %e, "WebSocket error");
                            break;
                        }
                        None => {
                            info!("WebSocket stream ended");
                            break;
                        }
                        _ => {}
                    }
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(30)) => {
                    let _ = sender.send(WsMessage::Ping(vec![].into())).await;
                }
            }
        }
    });
}

fn validate_auth_token(token: &str, state: &AppState) -> bool {
    let parts: Vec<&str> = token.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    
    let public_key_b64 = parts[0];
    let signature = parts[1];
    
    let message = format!("websocket_auth:{}", state.identity.server_id());
    state.identity.verify_signature(message.as_bytes(), signature, public_key_b64)
}

async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        server_id: state.identity.server_id().to_string(),
        uptime_seconds: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    })
}

async fn capabilities_handler(State(state): State<AppState>) -> Json<CapabilitiesResponse> {
    Json(CapabilitiesResponse {
        version: "1.0.0".to_string(),
        features: vec![
            "e2ee".to_string(),
            "federation".to_string(),
            "voice".to_string(),
            "threads".to_string(),
            "peer_discovery".to_string(),
        ],
        server_pubkey: state.identity.public_key_pem(),
        server_id: state.identity.server_id().to_string(),
    })
}

async fn get_peers_handler(State(state): State<AppState>) -> Result<Json<AddrMessage>, StatusCode> {
    let discovery = state.peer_discovery.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let addr_msg = discovery.create_addr_message(
        state.identity.server_id(),
        SocketAddr::from(([0, 0, 0, 0], 8080)),
    );
    
    Ok(Json(addr_msg))
}

async fn post_peers_handler(
    State(state): State<AppState>,
    Json(payload): Json<AddrMessage>,
) -> Result<StatusCode, StatusCode> {
    const MAX_PEERS_PER_ANNOUNCE: usize = 100;
    
    if payload.peers.len() > MAX_PEERS_PER_ANNOUNCE {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    
    let message_age = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .saturating_sub(payload.timestamp);
    
    if message_age > 3600 {
        warn!("Rejecting stale peer announcement");
        return Err(StatusCode::BAD_REQUEST);
    }
    
    {
        let mut rate_limiters = state.rate_limiters.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if !rate_limiters.federation.check("peer_announce") {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }
    
    let discovery = state.peer_discovery.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    discovery.process_addr_message(payload).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::OK)
}

async fn get_addrmessage_handler(State(_state): State<AppState>) -> Result<Json<protocol::messages::GetAddrMessage>, StatusCode> {
    let nonce: u64 = rand::random();
    Ok(Json(protocol::messages::GetAddrMessage { nonce }))
}

async fn server_info_handler(State(state): State<AppState>) -> Result<Json<ServerInfoResponse>, StatusCode> {
    let meta = state.meta.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let channels = state.channels.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let info = meta.get_info().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let channel_list = channels.list().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(ServerInfoResponse {
        name: info.name,
        description: info.description,
        icon_url: info.icon_url,
        banner_url: info.banner_url,
        server_id: state.identity.server_id().to_string(),
        channels: channel_list,
        roles: vec![],
    }))
}

async fn federation_handshake_handler(
    State(state): State<AppState>,
    Json(payload): Json<protocol::messages::FederationMessage>,
) -> Result<Json<protocol::messages::FederationResponse>, StatusCode> {
    {
        let mut rate_limiters = state.rate_limiters.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let key = payload.server_pubkey.as_deref().unwrap_or("unknown");
        if !rate_limiters.federation.check(key) {
            warn!("Rate limit exceeded for federation handshake");
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }
    
    info!(action = ?payload.action, "Federation handshake received");
    
    match payload.action.as_str() {
        "trust_request" => {
            let federation = state.federation.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            if let Some(remote_key) = &payload.server_pubkey {
                let message = format!("{}:{}", payload.action, remote_key);
                if state.identity.verify_signature(message.as_bytes(), &payload.signature, remote_key) {
                    if let Err(e) = federation.store_pending_trust(remote_key.clone()) {
                        warn!(error = %e, "Failed to store pending trust");
                    }
                    info!(remote_server = %remote_key, "Trust request received, awaiting admin approval");
                }
            }
            
            Ok(Json(protocol::messages::FederationResponse {
                status: "pending_approval".to_string(),
                message: Some("Trust request received, awaiting admin approval".to_string()),
                server_pubkey: Some(state.identity.public_key_pem()),
                signature: state.identity.sign(b"pending_approval"),
            }))
        }
        "trust_confirm" => {
            let federation = state.federation.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            if let Some(remote_key) = &payload.server_pubkey {
                if federation.approve_trust(remote_key) {
                    info!(remote_server = %remote_key, "Federation established");
                    Ok(Json(protocol::messages::FederationResponse {
                        status: "established".to_string(),
                        message: Some("Federation established successfully".to_string()),
                        server_pubkey: Some(state.identity.public_key_pem()),
                        signature: state.identity.sign(b"established"),
                    }))
                } else {
                    Err(StatusCode::UNAUTHORIZED)
                }
            } else {
                Err(StatusCode::BAD_REQUEST)
            }
        }
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

async fn relay_handler(
    State(state): State<AppState>,
    Json(payload): Json<protocol::messages::RelayRequest>,
) -> Result<StatusCode, StatusCode> {
    {
        let mut rate_limiters = state.rate_limiters.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if !rate_limiters.relay.check(&payload.source_server) {
            warn!(target = %payload.target_server, "Rate limit exceeded for relay");
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }
    
    let federation = state.federation.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if !federation.is_trusted(&payload.source_server) {
        warn!(source = %payload.source_server, "Attempted relay from untrusted server");
        return Err(StatusCode::FORBIDDEN);
    }
    
    let message = format!(
        "{}:{}:{}",
        payload.source_server,
        payload.target_server,
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &payload.encrypted_payload)
    );
    if !state.identity.verify_signature(message.as_bytes(), &payload.signature, &payload.source_server) {
        warn!(source = %payload.source_server, "Invalid signature in relay request");
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    let signature = state.identity.sign(&payload.encrypted_payload);
    
    let relay_msg = protocol::messages::RelayRequest {
        source_server: state.identity.server_id().to_string(),
        target_server: payload.target_server,
        encrypted_payload: payload.encrypted_payload,
        signature,
        forward: true,
    };
    
    let _ = state.tx.send(RelayMessage {
        target_channel: "federation_outbound".to_string(),
        sender_key: state.identity.server_id().to_string(),
        encrypted_payload: serde_json::to_vec(&relay_msg).unwrap_or_default(),
    });
    
    Ok(StatusCode::ACCEPTED)
}

fn create_app(state: AppState) -> Router {
    use http::{Method, header};
    
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::predicate(|origin, _| {
            if let Some(origin_str) = origin.to_str().ok() {
                origin_str.starts_with("chatlibre://") ||
                origin_str.starts_with("http://localhost") ||
                origin_str.starts_with("https://")
            } else {
                false
            }
        }))
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::HeaderName::from_static("x-requested-with")])
        .max_age(std::time::Duration::from_secs(86400));

    let ws_route = axum::routing::MethodRouter::new()
        .get(websocket_handler);
    
    Router::new()
        .route("/ws", ws_route)
        .route("/health", get(health_handler))
        .route("/capabilities", get(capabilities_handler))
        .route("/info", get(server_info_handler))
        .route("/federation/handshake", post(federation_handshake_handler))
        .route("/federation/relay", post(relay_handler))
        .route("/peers", get(get_peers_handler))
        .route("/peers", post(post_peers_handler))
        .route("/getaddrmessage", get(get_addrmessage_handler))
        .layer(cors)
        .with_state(state)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("chatlibre=info".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .init();

    info!("Starting chatLibre server v{}", env!("CARGO_PKG_VERSION"));

    let db = sled::open("chatlibre_data")?;
    let identity = ServerIdentity::load_or_generate(&db)?;
    
    let channels = Arc::new(Mutex::new(ChannelStore::new(db.clone())?));
    let federation = Arc::new(Mutex::new(FederationStore::new(db.clone())?));
    let meta = Arc::new(Mutex::new(ServerMetaStore::new(db.clone())?));
    let peer_discovery = Arc::new(Mutex::new(PeerDiscovery::new(db.clone())?));
    
    let (tx, _rx) = broadcast::channel::<RelayMessage>(1024);
    let rate_limiters = Arc::new(Mutex::new(RateLimiters::new()));

    let state = AppState {
        identity: Arc::new(identity),
        db: Arc::new(db),
        channels,
        federation,
        meta,
        peer_discovery,
        tx,
        rate_limiters: rate_limiters.clone(),
    };

    let rate_limiters_for_cleanup = rate_limiters.clone();
    tokio::spawn(async move {
        let mut cleanup_interval = interval(Duration::from_secs(300));
        loop {
            cleanup_interval.tick().await;
            if let Ok(mut limiters) = rate_limiters_for_cleanup.lock() {
                limiters.federation.cleanup();
                limiters.relay.cleanup();
                limiters.websocket.cleanup();
                info!("Rate limiter cleanup completed");
            }
        }
    });

    let app = create_app(state);

    let port: u16 = std::env::var("KEYFORGE_SERVER_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(address = %addr, port = %port, "Server listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
