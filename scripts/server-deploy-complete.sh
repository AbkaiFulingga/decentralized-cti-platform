#!/bin/bash

# Complete Server Deployment Script for zkSNARK Integration
# Run this on server (sc@192.168.1.11) after pushing code from Mac

set -e  # Exit on error

echo "════════════════════════════════════════════════════════"
echo "🚀 zkSNARK Browser Proof Generation - Server Setup"
echo "════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================
# STEP 1: Pull Latest Code from GitHub
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📥 STEP 1: Pulling latest code from GitHub...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd ~/blockchain-dev
git pull origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Code updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to pull code${NC}"
    exit 1
fi
echo ""

# ============================================================
# STEP 2: Deploy Circuit Files to Frontend
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 STEP 2: Deploying circuit files to frontend...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if circuits are compiled
if [ ! -f "circuits/contributor-proof_final.zkey" ]; then
    echo -e "${YELLOW}⚠️  Circuit not compiled yet. Running setup...${NC}"
    cd circuits
    bash setup-circuit.sh
    cd ..
fi

# Deploy circuits to frontend
bash scripts/deploy-circuits-server.sh

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Circuit files deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy circuit files${NC}"
    exit 1
fi
echo ""

# ============================================================
# STEP 3: Install Dependencies
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 STEP 3: Installing dependencies (including snarkjs)...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd ~/blockchain-dev/cti-frontend

echo "Running: npm install"
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    echo ""
    echo "Installed packages include:"
    npm list --depth=0 | grep -E "snarkjs|ethers|merkletreejs"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo ""

# ============================================================
# STEP 4: Verify Setup
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 STEP 4: Verifying setup...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Circuit files in public/circuits/:"
ls -lh ~/blockchain-dev/cti-frontend/public/circuits/ 2>/dev/null || echo "No files found!"
echo ""

echo "Frontend source files:"
ls -lh ~/blockchain-dev/cti-frontend/utils/zksnark-prover.js 2>/dev/null && echo "  ✅ zksnark-prover.js exists" || echo "  ❌ zksnark-prover.js missing"
ls -lh ~/blockchain-dev/cti-frontend/components/IOCSubmissionForm.jsx 2>/dev/null && echo "  ✅ IOCSubmissionForm.jsx exists" || echo "  ❌ IOCSubmissionForm.jsx missing"
echo ""

# ============================================================
# COMPLETION
# ============================================================
echo "════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Server Setup Complete!${NC}"
echo "════════════════════════════════════════════════════════"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Start the website:"
echo "   cd ~/blockchain-dev/cti-frontend"
echo "   npm run dev"
echo ""
echo "2. Access from your Mac browser:"
echo "   http://192.168.1.11:3000"
echo ""
echo "3. Test anonymous submission with zkSNARK proofs!"
echo ""
echo "📖 See ZKSNARK_QUICK_START.md for testing instructions"
echo ""
