#!/bin/bash
# Deployment script for Analytics Indexer on production server
# Run this on: sc@192.168.1.11

set -e  # Exit on error

echo "🚀 Deploying Analytics Indexer to Production..."
echo ""

# Step 1: Pull latest code
echo "📥 Step 1/6: Pulling latest code from GitHub..."
cd /home/sc/blockchain-dev
git pull origin main
echo "✅ Code updated to latest commit"
echo ""

# Step 2: Create cache directory
echo "📁 Step 2/6: Creating cache directory..."
mkdir -p /home/sc/blockchain-dev/cti-frontend/public/cache
echo "✅ Cache directory ready"
echo ""

# Step 3: Check if indexer is already running
echo "🔍 Step 3/6: Checking for existing indexer..."
if pm2 describe analytics-indexer > /dev/null 2>&1; then
  echo "⚠️  Indexer already running, restarting..."
  pm2 restart analytics-indexer
else
  echo "🆕 Starting new indexer..."
  cd /home/sc/blockchain-dev
  pm2 start scripts/analytics-indexer.js --name analytics-indexer
fi
echo "✅ Indexer process configured"
echo ""

# Step 4: Wait for first cache build (30 seconds)
echo "⏳ Step 4/6: Waiting 30 seconds for first cache build..."
sleep 30
echo ""

# Step 5: Verify cache file was created
echo "🔍 Step 5/6: Verifying cache file..."
CACHE_FILE="/home/sc/blockchain-dev/cti-frontend/public/cache/analytics-cache.json"
if [ -f "$CACHE_FILE" ]; then
  echo "✅ Cache file created successfully"
  echo "   Size: $(du -h $CACHE_FILE | cut -f1)"
  echo "   Modified: $(stat -f "%Sm" $CACHE_FILE)"
else
  echo "⚠️  Cache file not found yet, check logs:"
  echo "   pm2 logs analytics-indexer --lines 20"
fi
echo ""

# Step 6: Restart Next.js
echo "🔄 Step 6/6: Restarting Next.js application..."
cd /home/sc/blockchain-dev/cti-frontend
pm2 restart nextjs-dev
echo "✅ Next.js restarted"
echo ""

# Save PM2 configuration
echo "💾 Saving PM2 configuration for auto-restart..."
pm2 save
echo "✅ PM2 config saved"
echo ""

# Show status
echo "📊 Current PM2 Status:"
pm2 status
echo ""

# Show recent logs
echo "📜 Recent indexer logs:"
pm2 logs analytics-indexer --lines 10 --nostream
echo ""

echo "✅ Deployment Complete!"
echo ""
echo "🎯 Next Steps:"
echo "   1. Monitor logs: pm2 logs analytics-indexer"
echo "   2. Check cache: cat $CACHE_FILE"
echo "   3. Open Analytics: http://192.168.1.11:3000/statistics"
echo ""
echo "⚙️  Indexer will update cache every 5 minutes automatically"
