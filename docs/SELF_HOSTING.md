# Self-Hosting Guide

## Overview

chatLibre server is designed to be simple to self-host. This guide walks you through setting up your own chatLibre relay server.

## Requirements

### Minimum
- 1 vCPU
- 512 MB RAM
- 5 GB storage
- Domain name (recommended)
- TLS certificate (Let's Encrypt recommended)

### Recommended
- 2+ vCPUs
- 1+ GB RAM
- 20+ GB storage
- Dedicated domain
- Automated TLS renewal

## Installation

### Option 1: Binary Release (Recommended)

```bash
# Download latest release
curl -LO https://github.com/chatlibre/chatlibre/releases/latest/chatlibre-server-x86_64.tar.gz

# Extract
tar -xzf chatlibre-server-x86_64.tar.gz

# Run
./chatlibre-server
```

### Option 2: Docker

```bash
# Pull image
docker pull chatlibre/server:latest

# Run
docker run -d \
  --name chatlibre \
  -p 8080:8080 \
  -v chatlibre-data:/data \
  -e KEYFORGE_SERVER_NAME="My Server" \
  chatlibre/server:latest
```

### Option 3: Build from Source

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone repository
git clone https://github.com/chatlibre/chatlibre.git
cd chatlibre/server

# Build
cargo build --release

# Run
./target/release/chatlibre-server
```

## Configuration

chatLibre uses environment variables for configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYFORGE_SERVER_NAME` | chatLibre Server | Server display name |
| `KEYFORGE_SERVER_PORT` | 8080 | HTTP/WebSocket port |
| `KEYFORGE_DATA_DIR` | ./data | Data storage directory |
| `KEYFORGE_TLS_ENABLED` | false | Enable TLS |
| `KEYFORGE_TLS_CERT` | | Path to TLS certificate |
| `KEYFORGE_TLS_KEY` | | Path to TLS private key |
| `KEYFORGE_LOG_LEVEL` | info | Logging level |
| `KEYFORGE_MAX_CONNECTIONS` | 1000 | Max WebSocket connections |

### Example with TLS

```bash
KEYFORGE_SERVER_NAME="privacy.example.com" \
KEYFORGE_TLS_ENABLED=true \
KEYFORGE_TLS_CERT=/etc/letsencrypt/fullchain.pem \
KEYFORGE_TLS_KEY=/etc/letsencrypt/privkey.pem \
./chatlibre-server
```

### Example Docker Compose

```yaml
version: '3.8'

services:
  chatlibre:
    image: chatlibre/server:latest
    container_name: chatlibre
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
      - ./certs:/certs:ro
    environment:
      - KEYFORGE_SERVER_NAME=My chatLibre
      - KEYFORGE_TLS_ENABLED=true
      - KEYFORGE_TLS_CERT=/certs/fullchain.pem
      - KEYFORGE_TLS_KEY=/certs/privkey.pem
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:latest
    container_name: chatlibre-nginx
    restart: unless-stopped
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/letsencrypt:ro
    depends_on:
      - chatlibre
```

## Nginx Reverse Proxy

If running behind Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name chatlibre.example.com;

    ssl_certificate /etc/letsencrypt/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

## Server Management

### Initial Setup

1. Start the server
2. Access the admin interface at `https://your-server.com/admin`
3. Configure server name and metadata
4. Note your server's public key for federation

### Server Identity

Your server has an Ed25519 identity keypair. It's stored in:
```
./data/server_identity
```

**IMPORTANT**: Backup this directory! Loss means losing your server's identity.

### Admin API

```
GET  /admin/server          # Get server info
PUT  /admin/server          # Update server metadata
GET  /admin/channels        # List channels
POST /admin/channels        # Create channel
GET  /admin/federation      # List federated servers
POST /admin/federation/add  # Add federated server
DELETE /admin/federation/:id # Remove federation
```

### Backup

Regularly backup:
- `./data/` directory
- Server TLS certificates
- Nginx configuration

### Updates

```bash
# Binary
curl -LO new-release.tar.gz
tar -xzf new-release.tar.gz
systemctl restart chatlibre

# Docker
docker pull chatlibre/server:latest
docker-compose up -d
```

## Federation Setup

### Adding a Federated Server

1. Exchange public keys with the other server admin
2. Use the admin API to add the trusted server:

```bash
curl -X POST https://your-server.com/admin/federation/add \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "https://other-server.com",
    "server_pubkey": "-----BEGIN ED25519-----\n...\n-----END ED25519-----"
  }'
```

3. The other admin must do the same on their server

### Federation Verification

Test federation:
```bash
curl https://your-server.com/capabilities
```

Should return:
```json
{
  "version": "1.0",
  "features": ["e2ee", "federation", "voice", "threads"],
  "server_pubkey": "-----BEGIN ED25519-----\n...\n-----END ED25519-----",
  "server_id": "kf_abc123..."
}
```

## Security Best Practices

1. **Always use HTTPS/TLS**: Never run without encryption
2. **Regular backups**: Back up server identity and data
3. **Firewall**: Only expose necessary ports (443 for HTTPS)
4. **Updates**: Keep server software updated
5. **Monitoring**: Set up logging and monitoring
6. **No root**: Run server as non-root user if possible

## Troubleshooting

### Server won't start

Check logs:
```bash
tail -f ./data/logs/chatlibre.log
```

Common issues:
- Port already in use
- Missing TLS certificates
- Permission denied on data directory

### Can't connect

1. Check server is running: `curl http://localhost:8080/health`
2. Check firewall: `sudo ufw status`
3. Check Nginx logs: `tail -f /var/log/nginx/error.log`

### Federation not working

1. Verify both servers can reach each other
2. Check server clocks are synchronized
3. Verify public key exchange completed successfully
4. Check federation logs for errors

## Performance Tuning

### Connection Limits

Default: 1000 connections. Adjust based on resources:
```bash
KEYFORGE_MAX_CONNECTIONS=5000 ./chatlibre-server
```

### Database Tuning

Sled (embedded database) is optimized for SSD. For HDD:
```bash
KEYFORGE_FLUSH_INTERVAL=5000 ./chatlibre-server
```

### Resource Limits

Docker:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
```

## Monitoring

### Health Endpoint

```bash
curl https://your-server.com/health
```

Response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "server_id": "kf_abc123...",
  "uptime_seconds": 3600
}
```

### Metrics (Future)

Planned metrics endpoint for Prometheus/Grafana.

## Support

- GitHub Issues: Report bugs
- Discussions: Ask questions
- Matrix: #chatlibre:feneas.org
