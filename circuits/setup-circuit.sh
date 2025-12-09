#!/bin/bash

# zkSNARK Circuit Compilation & Setup Script
# This script compiles the contributor-proof circuit and generates proving/verification keys

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════"
echo "🔐 zkSNARK Circuit Setup - Contributor Proof"
echo "═══════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo -e "${RED}❌ Error: circom is not installed${NC}"
    echo ""
    echo "Please install circom first:"
    echo "  git clone https://github.com/iden3/circom.git"
    echo "  cd circom"
    echo "  cargo build --release"
    echo "  cargo install --path circom"
    exit 1
fi

echo -e "${GREEN}✅ circom found: $(circom --version)${NC}"
echo ""

# Check if snarkjs is installed
if ! command -v npx snarkjs &> /dev/null && ! command -v snarkjs &> /dev/null; then
    echo -e "${RED}❌ Error: snarkjs is not installed${NC}"
    echo ""
    echo "Please install snarkjs first:"
    echo "  npm install --save-dev snarkjs"
    exit 1
fi

echo -e "${GREEN}✅ snarkjs found${NC}"
echo ""

# Navigate to circuits directory
cd "$(dirname "$0")"

# Step 1: Compile circuit
echo "─────────────────────────────────────────────────────────"
echo "📝 Step 1: Compiling contributor-proof.circom..."
echo "─────────────────────────────────────────────────────────"

if [ -f "contributor-proof.r1cs" ]; then
    echo -e "${YELLOW}⚠️  contributor-proof.r1cs already exists. Removing...${NC}"
    rm -f contributor-proof.r1cs contributor-proof.sym
    rm -rf contributor-proof_js/
fi

circom contributor-proof.circom --r1cs --wasm --sym -o .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Circuit compiled successfully${NC}"
else
    echo -e "${RED}❌ Circuit compilation failed${NC}"
    exit 1
fi

# Display circuit info
echo ""
echo "📊 Circuit Statistics:"
npx snarkjs r1cs info contributor-proof.r1cs
echo ""

# Step 2: Download Powers of Tau (if not exists)
echo "─────────────────────────────────────────────────────────"
echo "🌟 Step 2: Checking Powers of Tau ceremony file..."
echo "─────────────────────────────────────────────────────────"

PTAU_FILE="powersOfTau28_hez_final_15.ptau"
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau"
PTAU_SIZE=288734806  # Expected file size in bytes (~275 MB)

# Check if file exists and validate size
if [ -f "$PTAU_FILE" ]; then
    # Get file size (works on both macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        FILE_SIZE=$(stat -f%z "$PTAU_FILE")
    else
        FILE_SIZE=$(stat -c%s "$PTAU_FILE")
    fi
    
    if [ "$FILE_SIZE" -eq "$PTAU_SIZE" ]; then
        echo -e "${GREEN}✅ Valid Powers of Tau file found (${FILE_SIZE} bytes)${NC}"
    else
        echo -e "${YELLOW}⚠️  Existing file is incomplete or corrupted${NC}"
        echo "   Current size: ${FILE_SIZE} bytes"
        echo "   Expected size: ${PTAU_SIZE} bytes (~275 MB)"
        echo "   Removing and re-downloading..."
        rm "$PTAU_FILE"
    fi
fi

# Download if not exists or was corrupted
if [ ! -f "$PTAU_FILE" ]; then
    echo "⬇️  Downloading Powers of Tau (Phase 1 - Universal Setup)..."
    echo "   Size: ~275 MB (this may take 5-10 minutes)..."
    echo "   URL: $PTAU_URL"
    echo ""
    
    # Try curl first (with resume support)
    if command -v curl &> /dev/null; then
        echo "   Using curl (resumable)..."
        curl -L -C - --progress-bar -o "$PTAU_FILE" "$PTAU_URL"
        DOWNLOAD_RESULT=$?
    # Fallback to wget
    elif command -v wget &> /dev/null; then
        echo "   Using wget..."
        wget -c --show-progress "$PTAU_URL" -O "$PTAU_FILE"
        DOWNLOAD_RESULT=$?
    else
        echo -e "${RED}❌ Neither curl nor wget found${NC}"
        echo "   Please install curl or wget, or download manually from:"
        echo "   $PTAU_URL"
        exit 1
    fi
    
    # Verify download
    if [ $DOWNLOAD_RESULT -eq 0 ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            FILE_SIZE=$(stat -f%z "$PTAU_FILE")
        else
            FILE_SIZE=$(stat -c%s "$PTAU_FILE")
        fi
        
        if [ "$FILE_SIZE" -eq "$PTAU_SIZE" ]; then
            echo -e "${GREEN}✅ Download complete and verified (${FILE_SIZE} bytes)${NC}"
        else
            echo -e "${RED}❌ Download incomplete or corrupted${NC}"
            echo "   Downloaded: ${FILE_SIZE} bytes"
            echo "   Expected: ${PTAU_SIZE} bytes"
            echo ""
            echo "   Run this script again to resume download, or download manually:"
            echo "   $PTAU_URL"
            exit 1
        fi
    else
        echo -e "${RED}❌ Failed to download Powers of Tau${NC}"
        echo "   Run this script again to retry, or download manually:"
        echo "   $PTAU_URL"
        exit 1
    fi
fi
echo ""

# Step 3: Generate proving key (Phase 2)
echo "─────────────────────────────────────────────────────────"
echo "🔑 Step 3: Generating proving key (Phase 2 - Circuit-Specific)..."
echo "─────────────────────────────────────────────────────────"

if [ -f "contributor-proof_final.zkey" ]; then
    echo -e "${YELLOW}⚠️  contributor-proof_final.zkey already exists. Skipping...${NC}"
else
    echo "   This may take 1-2 minutes..."
    
    # Initial setup
    npx snarkjs groth16 setup contributor-proof.r1cs $PTAU_FILE contributor-proof_0000.zkey
    
    # Contribute randomness (optional but recommended for production)
    echo "   Contributing randomness to ceremony..."
    echo "Random entropy from CTI Platform" | npx snarkjs zkey contribute contributor-proof_0000.zkey contributor-proof_final.zkey --name="CTI-Platform-$(date +%s)"
    
    # Clean up intermediate key
    rm -f contributor-proof_0000.zkey
    
    echo -e "${GREEN}✅ Proving key generated${NC}"
fi
echo ""

# Step 4: Export verification key
echo "─────────────────────────────────────────────────────────"
echo "🔓 Step 4: Exporting verification key..."
echo "─────────────────────────────────────────────────────────"

npx snarkjs zkey export verificationkey contributor-proof_final.zkey verification_key.json

echo -e "${GREEN}✅ Verification key exported to verification_key.json${NC}"
echo ""

# Step 5: Export Solidity verifier
echo "─────────────────────────────────────────────────────────"
echo "📜 Step 5: Generating Solidity verifier contract..."
echo "─────────────────────────────────────────────────────────"

npx snarkjs zkey export solidityverifier contributor-proof_final.zkey ../contracts/Groth16Verifier.sol

echo -e "${GREEN}✅ Solidity verifier exported to contracts/Groth16Verifier.sol${NC}"
echo ""

# Step 6: Verify the verification key
echo "─────────────────────────────────────────────────────────"
echo "🔍 Step 6: Verifying setup integrity..."
echo "─────────────────────────────────────────────────────────"

npx snarkjs zkey verify contributor-proof.r1cs $PTAU_FILE contributor-proof_final.zkey

echo ""

# Summary
echo "═══════════════════════════════════════════════════════"
echo "✅ zkSNARK Setup Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📁 Generated Files:"
echo "   circuits/contributor-proof.r1cs           - Constraint system"
echo "   circuits/contributor-proof_js/            - Witness generator (WASM)"
echo "   circuits/contributor-proof_final.zkey     - Proving key"
echo "   circuits/verification_key.json            - Verification key"
echo "   contracts/Groth16Verifier.sol             - Solidity verifier"
echo ""
echo "📊 Statistics:"
npx snarkjs r1cs info contributor-proof.r1cs | grep -E "Constraints|Private|Public"
echo ""
echo "🎯 Next Steps:"
echo "   1. Deploy Groth16Verifier.sol to blockchain"
echo "   2. Create proof generation script (generate-zk-proof.js)"
echo "   3. Test end-to-end proof workflow"
echo ""
echo "💡 To test proof generation:"
echo "   node ../scripts/generate-zk-proof.js --test"
echo ""
