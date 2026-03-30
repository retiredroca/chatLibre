use std::collections::HashMap;
use std::time::{Duration, Instant};

pub struct RateLimiter {
    requests: HashMap<String, Vec<Instant>>,
    window: Duration,
    max_requests: usize,
}

impl RateLimiter {
    pub fn new(window_secs: u64, max_requests: usize) -> Self {
        Self {
            requests: HashMap::new(),
            window: Duration::from_secs(window_secs),
            max_requests,
        }
    }

    pub fn check(&mut self, key: &str) -> bool {
        let now = Instant::now();
        let timestamps = self.requests.entry(key.to_string()).or_default();
        
        timestamps.retain(|&t| now.duration_since(t) < self.window);
        
        if timestamps.len() >= self.max_requests {
            return false;
        }
        
        timestamps.push(now);
        true
    }

    pub fn cleanup(&mut self) {
        let now = Instant::now();
        self.requests.retain(|_, timestamps| {
            timestamps.iter().any(|t| now.duration_since(*t) < self.window)
        });
    }
}

pub struct RateLimiters {
    pub federation: RateLimiter,
    pub relay: RateLimiter,
    pub websocket: RateLimiter,
}

impl RateLimiters {
    pub fn new() -> Self {
        Self {
            federation: RateLimiter::new(60, 10),
            relay: RateLimiter::new(60, 100),
            websocket: RateLimiter::new(60, 60),
        }
    }
}

impl Default for RateLimiters {
    fn default() -> Self {
        Self::new()
    }
}
