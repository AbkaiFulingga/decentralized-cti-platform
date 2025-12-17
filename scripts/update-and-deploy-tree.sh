#!/bin/bash

# Complete workflow: Generate and deploy contributor Merkle tree
# Run this on the server: ~/blockchain-dev/scripts/update-and-deploy-tree.sh

echo "🌲 Complete Contributor Tree Update Workflow"
echo "=============================================="
echo ""

cd ~/blockchain-dev || exit 1

# Step 1: Generate new tree with 100 contributors
echo "Step 1: Generating contributor tree with 100 addresses..."
echo "-----------------------------------------------------------"
node scripts/generate-anonymity-set.js

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate tree"
    exit 1
fi

echo ""
echo "Step 2: Verifying generated tree..."
echo "-----------------------------------------------------------"

# Verify the file
if [ ! -f "contributor-merkle-tree.json" ]; then
    echo "❌ contributor-merkle-tree.json not found!"
    exit 1
fi

CONTRIBUTOR_COUNT=$(node -pe "JSON.parse(require('fs').readFileSync('contributor-merkle-tree.json', 'utf8')).contributors?.length || 0")
ROOT=$(node -pe "JSON.parse(require('fs').readFileSync('contributor-merkle-tree.json', 'utf8')).root || 'N/A'")

echo "✅ Tree generated successfully:"
echo "   - Contributors: $CONTRIBUTOR_COUNT"
echo "   - Merkle Root: $ROOT"

if [ "$CONTRIBUTOR_COUNT" -lt 100 ]; then
    echo "⚠️  Warning: Expected 100 contributors but found $CONTRIBUTOR_COUNT"
fi

echo ""
echo "Step 3: Deploying to frontend..."
echo "-----------------------------------------------------------"

# Copy to frontend public directory
cp contributor-merkle-tree.json cti-frontend/public/contributor-merkle-tree.json

if [ $? -eq 0 ]; then
    echo "✅ Copied to cti-frontend/public/"
else
    echo "❌ Failed to copy to frontend"
    exit 1
fi

echo ""
echo "Step 4: Restarting frontend..."
echo "-----------------------------------------------------------"

cd cti-frontend

# Check if PM2 is managing the app
if pm2 list | grep -q "cti-frontend\|next"; then
    pm2 restart all
    echo "✅ Frontend restarted via PM2"
else
    echo "⚠️  PM2 process not found. If running dev server, it will auto-reload."
    echo "   If production, run: pm2 restart all"
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "🎯 Verification:"
echo "   1. Open browser and check console logs"
echo "   2. Should see: '$CONTRIBUTOR_COUNT contributors in tree'"
echo "   3. Check that your address is in the tree"
echo "   4. Anonymous submission should now be enabled"
echo ""
echo "📊 Next Steps (Optional):"
echo "   - Update on-chain root: npx hardhat run scripts/update-merkle-root-onchain.js --network arbitrumSepolia"
echo "   - Test anonymous submission in the frontend"
echo ""

