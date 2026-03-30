#!/bin/bash
set -e

echo "🔑 KeyForge Identity Generator"
echo "================================"
echo ""
echo "This script generates a new server identity keypair."
echo "IMPORTANT: Back up your identity directory securely!"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-.}"
IDENTITY_DIR="$DATA_DIR/identity"

mkdir -p "$IDENTITY_DIR"

if [ -f "$IDENTITY_DIR/private_key" ]; then
    echo "⚠️  Identity already exists!"
    read -p "Overwrite? This will make existing federation trust invalid. (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo "Generating Ed25519 keypair..."
openssl genpkey -algorithm Ed25519 -out "$IDENTITY_DIR/private_key"
openssl pkey -in "$IDENTITY_DIR/private_key" -pubout -out "$IDENTITY_DIR/public_key"

echo ""
echo "✅ Identity generated!"
echo ""
echo "Public key:"
cat "$IDENTITY_DIR/public_key"
echo ""
echo "Files created:"
echo "  - $IDENTITY_DIR/private_key (SECRET - keep this safe!)"
echo "  - $IDENTITY_DIR/public_key (safe to share)"
echo ""

chmod 600 "$IDENTITY_DIR/private_key"
chmod 644 "$IDENTITY_DIR/public_key"

echo "🔐 Permissions set (600 for private key)"
echo ""
echo "⚠️  IMPORTANT:"
echo "  1. Backup the identity/ directory"
echo "  2. Never share your private key"
echo "  3. Losing this means losing your server's identity"
