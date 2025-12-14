#!/bin/bash

# Deploy Circuit Files to Frontend (Server-Side)
# Run this ON THE SERVER after circuit compilation
# Copies compiled artifacts to Next.js public directory

set -e

echo "════════════════════════════════════════════════════════"
echo "🚀 Deploying zkSNARK Circuit Files to Frontend"
echo "════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Paths (relative to project root)
CIRCUITS_DIR="circuits"
FRONTEND_CIRCUITS_DIR="cti-frontend/public/circuits"

# Check if we're in the right directory
if [ ! -d "$CIRCUITS_DIR" ] || [ ! -d "cti-frontend" ]; then
    echo -e "${RED}❌ Error: Must run from project root (~/blockchain-dev/)${NC}"
    echo ""
    echo "Current directory: $(pwd)"
    echo "Expected structure:"
    echo "  - circuits/"
    echo "  - cti-frontend/"
    echo ""
    exit 1
fi

# Check if circuit files exist
echo "📋 Checking for compiled circuit files..."
echo ""

WASM_FILE="$CIRCUITS_DIR/contributor-proof_js/contributor-proof.wasm"
ZKEY_FILE="$CIRCUITS_DIR/contributor-proof_final.zkey"
VKEY_FILE="$CIRCUITS_DIR/verification_key.json"

if [ ! -f "$WASM_FILE" ]; then
    echo -e "${RED}❌ WASM file not found: $WASM_FILE${NC}"
    echo ""
    echo "Please compile circuit first:"
    echo "  cd circuits && bash setup-circuit.sh"
    exit 1
fi

if [ ! -f "$ZKEY_FILE" ]; then
    echo -e "${RED}❌ Proving key not found: $ZKEY_FILE${NC}"
    echo ""
    echo "Please compile circuit first:"
    echo "  cd circuits && bash setup-circuit.sh"
    exit 1
fi

echo -e "${GREEN}✅ Circuit files found${NC}"
echo ""

# Create frontend circuits directory
echo "📁 Creating frontend circuits directory..."
mkdir -p "$FRONTEND_CIRCUITS_DIR"
echo -e "${GREEN}✅ Directory ready: $FRONTEND_CIRCUITS_DIR${NC}"
echo ""

# Copy WASM file
echo "────────────────────────────────────────────────────────"
echo "📋 Copying contributor-proof.wasm..."
echo "────────────────────────────────────────────────────────"

cp "$WASM_FILE" "$FRONTEND_CIRCUITS_DIR/"
WASM_SIZE=$(du -h "$FRONTEND_CIRCUITS_DIR/contributor-proof.wasm" | cut -f1)
echo -e "${GREEN}✅ WASM copied: $WASM_SIZE${NC}"
echo ""

# Copy proving key
echo "────────────────────────────────────────────────────────"
echo "🔑 Copying contributor-proof_final.zkey..."
echo "────────────────────────────────────────────────────────"

cp "$ZKEY_FILE" "$FRONTEND_CIRCUITS_DIR/"
ZKEY_SIZE=$(du -h "$FRONTEND_CIRCUITS_DIR/contributor-proof_final.zkey" | cut -f1)
echo -e "${GREEN}✅ Proving key copied: $ZKEY_SIZE${NC}"
echo ""

# Copy verification key (optional)
echo "────────────────────────────────────────────────────────"
echo "🔓 Copying verification_key.json..."
echo "────────────────────────────────────────────────────────"

if [ -f "$VKEY_FILE" ]; then
    cp "$VKEY_FILE" "$FRONTEND_CIRCUITS_DIR/"
    VKEY_SIZE=$(du -h "$FRONTEND_CIRCUITS_DIR/verification_key.json" | cut -f1)
    echo -e "${GREEN}✅ Verification key copied: $VKEY_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️  Verification key not found (optional - skipping)${NC}"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════"
echo "✅ Circuit Files Deployed Successfully!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📁 Files in $FRONTEND_CIRCUITS_DIR:"
ls -lh "$FRONTEND_CIRCUITS_DIR" | tail -n +2
echo ""
echo "🌐 These files will be served at:"
echo "   - http://192.168.1.11:3000/circuits/contributor-proof.wasm"
echo "   - http://192.168.1.11:3000/circuits/contributor-proof_final.zkey"
echo "   - http://192.168.1.11:3000/circuits/verification_key.json"
echo ""
echo "🎯 Next Steps:"
echo "   1. cd cti-frontend"
echo "   2. npm install          (install snarkjs and dependencies)"
echo "   3. npm run dev          (start Next.js dev server)"
echo "   4. Open http://192.168.1.11:3000 in browser"
echo "   5. Test anonymous submission with real zkSNARK proofs!"
echo ""
