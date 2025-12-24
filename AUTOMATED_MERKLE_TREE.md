# Automated Merkle Tree Rebuilder

## Overview

The **Auto Merkle Tree Rebuilder** is a background service that automatically monitors on-chain contributor registrations and rebuilds the `contributor-merkle-tree.json` file whenever new users register. This eliminates the need for manual intervention.

## Why This Is Needed

Your wallet address `0x26337d3c3c26979abd78a0209ef1b9372f6eae82` needs to be in the Merkle tree for anonymous submissions to work. Previously, you had to manually run `build-contributor-tree.js` every time someone new registered. Now this happens automatically.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                  On-Chain Events                        │
│  PrivacyPreservingRegistry.ContributorRegistered        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Auto Rebuild Script         │
        │  (Runs every 60 seconds)     │
        │                              │
        │  1. Query events             │
        │  2. Count contributors       │
        │  3. Detect changes           │
        │  4. Rebuild tree if needed   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │  contributor-merkle-tree.json     │
        │  {                                │
        │    root: "0x...",                 │
        │    contributors: [...],           │
        │    proofs: {                      │
        │      "0x2633...ae82": [...],      │ <- Your address
        │      ...                          │
        │    }                              │
        │  }                                │
        └──────────────────────────────────┘
```

## Features

### 🔄 Automatic Monitoring
- Checks blockchain every 60 seconds for new registrations
- Queries `ContributorRegistered` events from the registry contract
- Compares current count with last known count

### 🌳 Smart Rebuilding
- Only rebuilds when new contributors detected
- Uses same keccak256 hashing as OpenZeppelin MerkleProof
- Generates proofs for all contributors including yours

### 📊 Comprehensive Logging
- Emoji-based status indicators for easy monitoring
- Displays contributor count changes
- Shows sample proofs for verification
- Logs all operations with timestamps

### ⚡ Infura-Safe Event Querying
- Handles free tier 10-block limit automatically
- Falls back to recent blocks (last 10,000) if needed
- Never fails due to RPC provider limitations

## Installation & Setup

### 1. Start the Service Locally

```bash
# Start as a foreground process (for testing)
cd /Users/user/decentralized-cti-platform-3
npm run merkle:auto
```

### 2. Start as PM2 Daemon (Recommended for Server)

```bash
# Start the service
npm run merkle:pm2

# Check status
pm2 status merkle-rebuilder

# View live logs
npm run merkle:logs

# Stop the service
npm run merkle:stop

# Restart the service
pm2 restart merkle-rebuilder
```

### 3. Deploy to Server (192.168.1.11)

```bash
# Copy files to server
scp scripts/auto-rebuild-merkle-tree.js sc@192.168.1.11:~/blockchain-dev/scripts/
scp package.json sc@192.168.1.11:~/blockchain-dev/

# SSH into server
ssh sc@192.168.1.11

# Navigate to project
cd ~/blockchain-dev

# Start the service
npm run merkle:pm2

# Verify it's running
pm2 list
```

## Configuration

Edit `auto-rebuild-merkle-tree.js` to change:

```javascript
const CHECK_INTERVAL = 60000; // Check frequency (milliseconds)
const OUTPUT_FILE = 'contributor-merkle-tree.json'; // Output file
const DEPLOYMENT_FILE = 'test-addresses.json'; // Contract addresses
```

## Logs & Monitoring

### Example Output

```
🚀 Starting Auto Merkle Tree Rebuilder
📁 Output file: /path/to/contributor-merkle-tree.json
⏱️  Check interval: 60 seconds

🔨 Performing initial tree build...

============================================================
🔍 Check at 12:30:45 PM
📊 Current contributor count: 100
📝 Last known count: 0
============================================================

📊 Fetching all contributors from on-chain...
✅ Fetched 127 ContributorRegistered events
✅ Found 100 unique contributors
🌳 Building Merkle tree...
✅ Merkle tree built with root: 0x308620c80bae1714e34e188bb00eb2b06ecc9e0e...
📊 Tree statistics:
   - 100 contributors
   - 100 leaves
   - 7 depth
💾 Saving tree to contributor-merkle-tree.json...
✅ Merkle tree saved successfully (42.15 KB)
✅ Merkle tree updated successfully!

📋 Sample contributors (first 3):
   0: 0x26337d3c3c26979abd78a0209ef1b9372f6eae82
      Proof: [7 elements]
   1: 0x1234567890abcdef1234567890abcdef12345678
      Proof: [7 elements]
   2: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
      Proof: [7 elements]
```

### Real-Time Monitoring

```bash
# Follow logs in real-time
pm2 logs merkle-rebuilder --lines 100

# Check PM2 status
pm2 status

# Restart if needed
pm2 restart merkle-rebuilder
```

## Verification

### Check Your Address Is Included

```bash
# View the tree file
cat contributor-merkle-tree.json | jq '.contributors' | grep -i "0x26337d3c3c26979abd78a0209ef1b9372f6eae82"

# Check your proof
cat contributor-merkle-tree.json | jq '.proofs["0x26337d3c3c26979abd78a0209ef1b9372f6eae82"]'
```

### Test Anonymous Submission

1. Wait for your address to appear in tree
2. Go to frontend IOC submission form
3. Select "Anonymous" mode
4. Submit a batch
5. Should now show **"1 in 100"** instead of **"Not Yet in Anonymous Tree"**

## Troubleshooting

### Service Not Starting

```bash
# Check for errors
pm2 logs merkle-rebuilder --err

# Verify hardhat.config.js has correct RPC URLs
cat hardhat.config.js | grep "sepolia"

# Check .env file has SEPOLIA_RPC_URL
cat .env | grep "SEPOLIA_RPC_URL"
```

### Tree Not Updating

1. **Check contributor count**:
   ```bash
   npx hardhat console --network sepolia
   > const registry = await ethers.getContractAt('PrivacyPreservingRegistry', '0xb490abfff0639453a8a5e5e52bf4e8055269cfe4')
   > await registry.getContributorCount()
   ```

2. **Manually trigger rebuild**:
   ```bash
   node scripts/auto-rebuild-merkle-tree.js
   ```

3. **Check PM2 logs**:
   ```bash
   pm2 logs merkle-rebuilder --lines 200
   ```

### Infura Rate Limit Errors

The script automatically handles Infura's free tier limits by:
- Catching "block range" errors
- Falling back to recent blocks only (last 10,000)
- Never querying full history on free tier

If you see rate limit errors anyway:
1. Upgrade Infura plan OR
2. Use a different RPC provider in `hardhat.config.js`

## Manual Override

If you ever need to manually rebuild:

```bash
# One-time rebuild
npx hardhat run scripts/build-contributor-tree.js --network sepolia

# Or use the automated script once
node scripts/auto-rebuild-merkle-tree.js
```

## Production Deployment Checklist

- [ ] Deploy script to server (`scp` or git pull)
- [ ] Start PM2 service: `npm run merkle:pm2`
- [ ] Verify service is running: `pm2 list`
- [ ] Check initial tree build: `pm2 logs merkle-rebuilder --lines 50`
- [ ] Verify your address in tree: `cat contributor-merkle-tree.json | jq '.contributors' | grep -i <your_address>`
- [ ] Test anonymous submission on frontend
- [ ] Add to PM2 startup (so it auto-starts on reboot):
  ```bash
  pm2 startup
  pm2 save
  ```

## Integration with Frontend

The frontend automatically reads from `contributor-merkle-tree.json`:

```javascript
// cti-frontend/utils/zksnark-prover.js
const treeData = require('../../contributor-merkle-tree.json');

export function isAddressInTree(address) {
  const normalized = address.toLowerCase();
  return treeData.contributors.includes(normalized);
}

export function getProofForAddress(address) {
  const normalized = address.toLowerCase();
  return treeData.proofs[normalized] || null;
}
```

Once your address is in the tree, the frontend will automatically:
1. Detect your inclusion
2. Display **"✅ 1 in 100"** (or current count)
3. Enable anonymous submission mode
4. Generate zkSNARK proofs for your submissions

## Benefits

✅ **No More Manual Work**: Tree updates automatically when users register  
✅ **Always Up-to-Date**: Checks every 60 seconds for changes  
✅ **Production-Ready**: Runs as PM2 daemon with auto-restart  
✅ **Infura-Safe**: Handles free tier limits gracefully  
✅ **Your Address Included**: Automatically adds you when you register  
✅ **Comprehensive Logging**: Easy to monitor and debug  

## Next Steps

1. **Deploy to server**: Follow "Deploy to Server" section above
2. **Start service**: `npm run merkle:pm2`
3. **Monitor logs**: `npm run merkle:logs`
4. **Test frontend**: Submit anonymous batch after tree updates
5. **Verify**: Should see "1 in [count]" instead of error message
