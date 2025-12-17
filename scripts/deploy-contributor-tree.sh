#!/bin/bash
# Deploy contributor Merkle tree with 100 contributors
# This script runs on the server to generate and deploy the tree

echo "🎭 Deploying Contributor Merkle Tree (100 contributors)"
echo "=================================================="

# Step 1: Generate the tree
echo ""
echo "Step 1: Generating Merkle tree with 100 contributors..."
cd ~/blockchain-dev
node scripts/generate-anonymity-set.js

if [ ! -f "contributor-merkle-tree.json" ]; then
    echo "❌ Error: contributor-merkle-tree.json not generated!"
    exit 1
fi

# Step 2: Verify the file
echo ""
echo "Step 2: Verifying file structure..."
CONTRIBUTOR_COUNT=$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('contributor-merkle-tree.json','utf8')); console.log(data.contributors ? data.contributors.length : 0);")
echo "   Contributors in file: $CONTRIBUTOR_COUNT"

if [ "$CONTRIBUTOR_COUNT" != "100" ]; then
    echo "⚠️  Warning: Expected 100 contributors, got $CONTRIBUTOR_COUNT"
fi

# Step 3: Copy to frontend public directory
echo ""
echo "Step 3: Copying to frontend public directory..."
cp contributor-merkle-tree.json ~/blockchain-dev/cti-frontend/public/
echo "   ✅ Copied to cti-frontend/public/"

# Step 4: Restart frontend (if running with PM2)
echo ""
echo "Step 4: Restarting frontend..."
cd ~/blockchain-dev/cti-frontend

if command -v pm2 &> /dev/null; then
    pm2 restart all 2>/dev/null || echo "   ℹ️  PM2 not running or no apps found"
else
    echo "   ℹ️  PM2 not installed, skipping restart"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Summary:"
echo "   - Contributors: $CONTRIBUTOR_COUNT"
echo "   - File location: ~/blockchain-dev/contributor-merkle-tree.json"
echo "   - Frontend copy: ~/blockchain-dev/cti-frontend/public/contributor-merkle-tree.json"
echo ""
echo "🌐 Frontend will now show '100 contributors in tree'"
