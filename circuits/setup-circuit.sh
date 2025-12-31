#!/bin/bash

# zkSNARK Circuit Compilation & Setup Script
# This script compiles the contributor-proof circuit and generates proving/verification keys

set -e  # Exit on error

# Optional: copy generated artifacts into the Next.js app's public folder so the
# browser prover can fetch them from:
#   /circuits/contributor-proof.wasm
#   /circuits/contributor-proof_final.zkey
#   /circuits/verification_key.json
#
# Usage:
#   ./setup-circuit.sh --deploy-to-frontend
#   ./setup-circuit.sh --deploy-to-frontend /absolute/path/to/cti-frontend/public/circuits

DEPLOY_TO_FRONTEND=0
DEPLOY_DIR_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --deploy-to-frontend)
            DEPLOY_TO_FRONTEND=1
            shift
            ;;
        --deploy-dir)
            DEPLOY_TO_FRONTEND=1
            DEPLOY_DIR_OVERRIDE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--deploy-to-frontend] [--deploy-dir /abs/path/to/public/circuits]"
            exit 0
            ;;
        *)
            echo -e "${YELLOW}⚠️  Unknown argument: $1${NC}"
            echo "Usage: $0 [--deploy-to-frontend] [--deploy-dir /abs/path/to/public/circuits]"
            exit 1
            ;;
    esac
done

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

SCRIPT_DIR="$(pwd)"

detect_frontend_public_dir() {
    # Allow explicit override.
    if [ -n "$DEPLOY_DIR_OVERRIDE" ]; then
        echo "$DEPLOY_DIR_OVERRIDE"
        return 0
    fi

    # Typical repo layout: <repo>/circuits (this script) and <repo>/cti-frontend/public/circuits.
    local repo_root
    repo_root="$(cd .. && pwd)"

    if [ -d "${repo_root}/cti-frontend/public" ]; then
        echo "${repo_root}/cti-frontend/public/circuits"
        return 0
    fi

    # If someone runs the script from a copied circuits folder outside the repo,
    # try a best-effort hint based on current working directory.
    # Fall back to empty string and warn later.
    echo ""
    return 0
}

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

# Using ptau_15 (supports up to 32,768 constraints - we have 10,918)
# Verified working download from Google Cloud Storage
PTAU_FILE="powersOfTau28_hez_final_15.ptau"

# Multiple mirror sources for the Powers of Tau file
PTAU_URLS=(
    "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau"
    "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau"
)

PTAU_SIZE=37831832  # Expected file size in bytes (~36 MB) - actual working file

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
    echo "   Using ptau_15: supports up to 32,768 constraints"
    echo "   Our circuit: 10,918 constraints ✅"
    echo "   Size: ~36 MB (this may take 1-3 minutes)..."
    echo ""
    
    DOWNLOAD_SUCCESS=0
    
    for PTAU_URL in "${PTAU_URLS[@]}"; do
        echo "   Attempting: $PTAU_URL"
        
        # Try curl first (with resume support)
        if command -v curl &> /dev/null; then
            curl -L -C - --progress-bar -o "$PTAU_FILE" "$PTAU_URL" 2>&1
            DOWNLOAD_RESULT=$?
        # Fallback to wget
        elif command -v wget &> /dev/null; then
            wget -c --show-progress "$PTAU_URL" -O "$PTAU_FILE" 2>&1
            DOWNLOAD_RESULT=$?
        else
            echo -e "${RED}❌ Neither curl nor wget found${NC}"
            echo "   Please install curl or wget"
            exit 1
        fi
        
        # Check if download succeeded
        if [ $DOWNLOAD_RESULT -eq 0 ] && [ -f "$PTAU_FILE" ]; then
            # Verify file size
            if [[ "$OSTYPE" == "darwin"* ]]; then
                FILE_SIZE=$(stat -f%z "$PTAU_FILE")
            else
                FILE_SIZE=$(stat -c%s "$PTAU_FILE")
            fi
            
            if [ "$FILE_SIZE" -eq "$PTAU_SIZE" ]; then
                echo -e "${GREEN}✅ Download complete and verified (${FILE_SIZE} bytes)${NC}"
                DOWNLOAD_SUCCESS=1
                break
            else
                echo -e "${YELLOW}⚠️  File size mismatch (${FILE_SIZE} vs ${PTAU_SIZE}), trying next mirror...${NC}"
                rm "$PTAU_FILE"
            fi
        else
            echo -e "${YELLOW}⚠️  Download failed, trying next mirror...${NC}"
            [ -f "$PTAU_FILE" ] && rm "$PTAU_FILE"
        fi
    done
    
    if [ $DOWNLOAD_SUCCESS -eq 0 ]; then
        echo -e "${RED}❌ All download mirrors failed${NC}"
        echo ""
        echo "   Please download manually from one of these sources:"
        for url in "${PTAU_URLS[@]}"; do
            echo "   - $url"
        done
        echo ""
        echo "   Or use alternative ptau file (see below)"
        echo ""
        echo "   Alternative: Use larger ptau_15 if needed (275 MB):"
        echo "   wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau"
        echo "   Then update PTAU_FILE variable in this script"
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

# Optional: Deploy artifacts into Next.js public folder
if [ "$DEPLOY_TO_FRONTEND" -eq 1 ]; then
    echo "─────────────────────────────────────────────────────────"
    echo "📦 Optional: Deploying circuit artifacts to frontend"
    echo "─────────────────────────────────────────────────────────"

    FRONTEND_PUBLIC_CIRCUITS="$(detect_frontend_public_dir)"
    if [ -z "$FRONTEND_PUBLIC_CIRCUITS" ]; then
        echo -e "${RED}❌ Could not auto-detect frontend public directory.${NC}"
        echo "   Re-run with: --deploy-dir /absolute/path/to/cti-frontend/public/circuits"
        echo ""
        exit 1
    fi

    mkdir -p "$FRONTEND_PUBLIC_CIRCUITS"

    # Copy and normalize filenames to what the browser prover expects.
    cp -f "${SCRIPT_DIR}/contributor-proof_js/contributor-proof.wasm" \
        "${FRONTEND_PUBLIC_CIRCUITS}/contributor-proof.wasm"
    cp -f "${SCRIPT_DIR}/contributor-proof_final.zkey" \
        "${FRONTEND_PUBLIC_CIRCUITS}/contributor-proof_final.zkey"
    cp -f "${SCRIPT_DIR}/verification_key.json" \
        "${FRONTEND_PUBLIC_CIRCUITS}/verification_key.json"

    echo -e "${GREEN}✅ Deployed artifacts into:${NC} ${FRONTEND_PUBLIC_CIRCUITS}"
    echo ""
    echo "📎 Expected served URLs (Next public assets):"
    echo "   /circuits/contributor-proof.wasm"
    echo "   /circuits/contributor-proof_final.zkey"
    echo "   /circuits/verification_key.json"
    echo ""
    echo "📏 Deployed file sizes:"
    ls -lh "${FRONTEND_PUBLIC_CIRCUITS}" | sed 's/^/   /'
    echo ""
fi
