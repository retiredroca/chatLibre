#![allow(dead_code)]
use std::net::SocketAddr;
use std::time::Instant;
use serde::{Deserialize, Serialize};
use sled::Db;
use tokio::sync::mpsc;

const PEER_CACHE_TREE: &str = "peer_cache";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub addr: SocketAddr,
    pub server_id: String,
    pub last_seen: u64,
    pub services: u64,
    pub tried_at: Option<u64>,
    pub last_attempt: Option<u64>,
    pub success_count: u32,
    pub failure_count: u32,
}

impl PeerInfo {
    pub fn is_good(&self) -> bool {
        self.success_count >= 3 && 
        self.failure_count == 0 &&
        self.last_attempt.map(|t| {
            let last_attempt_instant = Instant::now() - std::time::Duration::from_secs(t);
            last_attempt_instant.elapsed().as_secs() < 86400
        }).unwrap_or(false)
    }
    
    pub fn is_banable(&self) -> bool {
        self.failure_count >= 3 && self.last_attempt.is_some()
    }
}

pub struct PeerDiscovery {
    db: Db,
    seed_nodes: Vec<SeedNode>,
    addr_tx: Option<mpsc::Sender<AddrMessage>>,
}

#[derive(Debug, Clone)]
pub struct SeedNode {
    pub host: String,
    pub port: u16,
}

impl SeedNode {
    pub fn to_socket_addr(&self) -> SocketAddr {
        SocketAddr::from(([0, 0, 0, 0], self.port))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddrMessage {
    pub timestamp: u64,
    pub peers: Vec<PeerAddr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerAddr {
    pub addr: String,
    pub server_id: String,
    pub services: u64,
    pub timestamp: u64,
}

impl PeerDiscovery {
    pub fn new(db: Db) -> anyhow::Result<Self> {
        let seeds = Self::get_default_seeds();
        Ok(Self {
            db,
            seed_nodes: seeds,
            addr_tx: None,
        })
    }
    
    fn get_default_seeds() -> Vec<SeedNode> {
        vec![
            SeedNode { host: "seed.chatlibre.io".to_string(), port: 8080 },
            SeedNode { host: "seed2.chatlibre.io".to_string(), port: 8080 },
            SeedNode { host: "seed3.chatlibre.io".to_string(), port: 8080 },
        ]
    }
    
    pub fn set_seeds(&mut self, seeds: Vec<SeedNode>) {
        self.seed_nodes = seeds;
    }
    
    pub fn get_random_seeds(&self, count: usize) -> Vec<SeedNode> {
        use rand::Rng;
        
        let mut rng = rand::thread_rng();
        let mut indices: Vec<usize> = (0..self.seed_nodes.len()).collect();
        let mut selected = Vec::new();
        
        for _ in 0..count.min(self.seed_nodes.len()) {
            let idx = rng.gen_range(0..indices.len());
            selected.push(self.seed_nodes[indices.remove(idx)].clone());
        }
        
        selected
    }
    
    pub fn add_peer(&self, peer: PeerInfo) -> anyhow::Result<()> {
        let tree = self.db.open_tree(PEER_CACHE_TREE)?;
        let key = peer.addr.to_string();
        let value = serde_json::to_vec(&peer)?;
        tree.insert(key.as_bytes(), value.as_slice())?;
        Ok(())
    }
    
    pub fn get_peer(&self, addr: &SocketAddr) -> anyhow::Result<Option<PeerInfo>> {
        let tree = self.db.open_tree(PEER_CACHE_TREE)?;
        let key = addr.to_string();
        if let Some(value) = tree.get(key.as_bytes())? {
            let value_ref: &[u8] = &value;
            let peer: PeerInfo = serde_json::from_slice(value_ref)?;
            Ok(Some(peer))
        } else {
            Ok(None)
        }
    }
    
    pub fn get_all_peers(&self) -> anyhow::Result<Vec<PeerInfo>> {
        let tree = self.db.open_tree(PEER_CACHE_TREE)?;
        let mut peers = Vec::new();
        
        for entry in tree.iter() {
            if let Ok((_, value)) = entry {
                let value_ref: &[u8] = &value;
                if let Ok(peer) = serde_json::from_slice::<PeerInfo>(value_ref) {
                    peers.push(peer);
                }
            }
        }
        
        Ok(peers)
    }
    
    pub fn get_good_peers(&self) -> anyhow::Result<Vec<PeerInfo>> {
        Ok(self.get_all_peers()?.into_iter().filter(|p| p.is_good()).collect())
    }
    
    pub fn select_peers_to_connect(&self, count: usize) -> anyhow::Result<Vec<PeerInfo>> {
        let mut all_peers = self.get_all_peers()?;
        
        all_peers.sort_by(|a, b| {
            let a_score = a.success_count.saturating_sub(a.failure_count);
            let b_score = b.success_count.saturating_sub(b.failure_count);
            b_score.cmp(&a_score)
        });
        
        let mut selected: Vec<PeerInfo> = all_peers
            .into_iter()
            .filter(|p| !p.is_banable())
            .take(count)
            .collect();
        
        if selected.len() < count {
            let seeds = self.get_random_seeds(count - selected.len());
            for seed in seeds {
                let peer = PeerInfo {
                    addr: seed.to_socket_addr(),
                    server_id: String::new(),
                    last_seen: 0,
                    services: 0,
                    tried_at: None,
                    last_attempt: None,
                    success_count: 0,
                    failure_count: 0,
                };
                if !selected.iter().any(|p| p.addr == peer.addr) {
                    selected.push(peer);
                }
            }
        }
        
        Ok(selected)
    }
    
    pub fn mark_attempt(&self, addr: &SocketAddr) -> anyhow::Result<()> {
        let mut peer = self.get_peer(addr)?.unwrap_or_else(|| PeerInfo {
            addr: *addr,
            server_id: String::new(),
            last_seen: 0,
            services: 0,
            tried_at: None,
            last_attempt: None,
            success_count: 0,
            failure_count: 0,
        });
        
        peer.last_attempt = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs()
        );
        peer.tried_at = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs()
        );
        
        self.add_peer(peer)
    }
    
    pub fn mark_success(&self, addr: &SocketAddr, server_id: &str) -> anyhow::Result<()> {
        let mut peer = self.get_peer(addr)?.unwrap_or_else(|| PeerInfo {
            addr: *addr,
            server_id: String::new(),
            last_seen: 0,
            services: 0,
            tried_at: None,
            last_attempt: None,
            success_count: 0,
            failure_count: 0,
        });
        
        peer.last_seen = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        peer.server_id = server_id.to_string();
        peer.success_count += 1;
        peer.failure_count = 0;
        
        self.add_peer(peer)
    }
    
    pub fn mark_failure(&self, addr: &SocketAddr) -> anyhow::Result<()> {
        let mut peer = self.get_peer(addr)?.unwrap_or_else(|| PeerInfo {
            addr: *addr,
            server_id: String::new(),
            last_seen: 0,
            services: 0,
            tried_at: None,
            last_attempt: None,
            success_count: 0,
            failure_count: 0,
        });
        
        peer.last_attempt = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs()
        );
        peer.failure_count += 1;
        
        self.add_peer(peer)
    }
    
    pub fn create_addr_message(&self, _our_server_id: &str, _our_addr: SocketAddr) -> AddrMessage {
        let peers = self.get_all_peers()
            .unwrap_or_default()
            .into_iter()
            .take(1000)
            .map(|p| PeerAddr {
                addr: p.addr.to_string(),
                server_id: p.server_id,
                services: p.services,
                timestamp: p.last_seen,
            })
            .collect();
        
        AddrMessage {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            peers,
        }
    }
    
    pub fn process_addr_message(&self, msg: AddrMessage) -> anyhow::Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        
        for peer_addr in msg.peers {
            if let Ok(addr) = peer_addr.addr.parse::<SocketAddr>() {
                if addr.port() == 0 || addr.ip().is_unspecified() {
                    continue;
                }
                
                let last_good = peer_addr.timestamp > 0 && 
                    now.saturating_sub(peer_addr.timestamp) < 86400 * 7;
                
                if last_good || peer_addr.timestamp > now.saturating_sub(86400) {
                    let peer = PeerInfo {
                        addr,
                        server_id: peer_addr.server_id,
                        last_seen: peer_addr.timestamp,
                        services: peer_addr.services,
                        tried_at: None,
                        last_attempt: None,
                        success_count: 0,
                        failure_count: 0,
                    };
                    
                    let existing = self.get_peer(&addr)?;
                    if existing.is_none() {
                        self.add_peer(peer)?;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn dns_seeds_lookup(&self) -> Vec<SocketAddr> {
        let mut results = Vec::new();
        
        for seed in &self.seed_nodes {
            if let Ok(addrs) = tokio::net::lookup_host((&*seed.host, seed.port)).await {
                for addr in addrs {
                    if addr.is_ipv4() || addr.is_ipv6() {
                        results.push(addr);
                    }
                }
            }
        }
        
        results
    }
}

pub async fn start_peer_discovery(db: Db, connect_tx: mpsc::Sender<SocketAddr>) {
    let discovery = PeerDiscovery::new(db).expect("Failed to create peer discovery");
    
    let initial_peers = discovery.select_peers_to_connect(8).unwrap_or_default();
    for peer in initial_peers {
        let _ = connect_tx.send(peer.addr).await;
    }
    
    let dns_addrs = discovery.dns_seeds_lookup().await;
    for addr in dns_addrs {
        let _ = connect_tx.send(addr).await;
    }
}
