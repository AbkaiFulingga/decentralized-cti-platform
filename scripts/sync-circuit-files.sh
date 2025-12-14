#!/bin/bash

# Sync Circuit Files from Server to Frontend
# Downloads compiled circuit artifacts and places them in Next.js public directory

set -e

echo "════════════════════════════════════════════════════════"
echo "🔄 Syncing zkSNARK Circuit Files from Server"
echo "════════════════════════════════════════════════════════"
echo ""

# Configuration
SERVER="sc@192.168.1.11"
SERVER_CIRCUITS_DIR="~/blockchain-dev/circuits"
LOCAL_PUBLIC_DIR="./cti-frontend/public/circuits"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Create local directory if it doesn't exist
echo "📁 Creating local circuits directory..."
mkdir -p "$LOCAL_PUBLIC_DIR"
echo -e "${GREEN}✅ Directory ready: $LOCAL_PUBLIC_DIR${NC}"
echo ""

# Download WASM file
echo "────────────────────────────────────────────────────────"
echo "📥 Downloading contributor-proof.wasm (~2 MB)..."
echo "────────────────────────────────────────────────────────"

scp "${SERVER}:${SERVER_CIRCUITS_DIR}/contributor-proof_js/contributor-proof.wasm" \
    "$LOCAL_PUBLIC_DIR/"

if [ $? -eq 0 ]; then
    WASM_SIZE=$(du -h "$LOCAL_PUBLIC_DIR/contributor-proof.wasm" | cut -f1)
    echo -e "${GREEN}✅ WASM file downloaded: $WASM_SIZE${NC}"
else
    echo -e "${RED}❌ Failed to download WASM file${NC}"
    exit 1
fi
echo ""

# Download proving key
echo "────────────────────────────────────────────────────────"
echo "📥 Downloading contributor-proof_final.zkey (~20 MB)..."
echo "────────────────────────────────────────────────────────"

scp "${SERVER}:${SERVER_CIRCUITS_DIR}/contributor-proof_final.zkey" \
    "$LOCAL_PUBLIC_DIR/"

if [ $? -eq 0 ]; then
    ZKEY_SIZE=$(du -h "$LOCAL_PUBLIC_DIR/contributor-proof_final.zkey" | cut -f1)
    echo -e "${GREEN}✅ Proving key downloaded: $ZKEY_SIZE${NC}"
else
    echo -e "${RED}❌ Failed to download proving key${NC}"
    exit 1
fi
echo ""

# Download verification key (optional)
echo "────────────────────────────────────────────────────────"
echo "📥 Downloading verification_key.json (optional)..."
echo "────────────────────────────────────────────────────────"

scp "${SERVER}:${SERVER_CIRCUITS_DIR}/verification_key.json" \
    "$LOCAL_PUBLIC_DIR/" 2>/dev/null

if [ $? -eq 0 ]; then
    VKEY_SIZE=$(du -h "$LOCAL_PUBLIC_DIR/verification_key.json" | cut -f1)
    echo -e "${GREEN}✅ Verification key downloaded: $VKEY_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️  Verification key not found (optional - skipping)${NC}"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════"
echo "✅ Circuit Files Sync Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📁 Files in $LOCAL_PUBLIC_DIR:"
ls -lh "$LOCAL_PUBLIC_DIR" | grep -v total
echo ""
echo "🌐 These files will be served at:"
echo "   - http://localhost:3000/circuits/contributor-proof.wasm"
echo "   - http://localhost:3000/circuits/contributor-proof_final.zkey"
echo "   - http://localhost:3000/circuits/verification_key.json"
echo ""
echo "🎯 Next Steps:"
echo "   1. cd cti-frontend"
echo "   2. npm install          (install snarkjs)"
echo "   3. npm run dev          (start Next.js server)"
echo "   4. Test anonymous submission with real zkSNARK proofs!"
echo ""
