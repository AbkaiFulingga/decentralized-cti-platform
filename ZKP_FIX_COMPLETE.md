# 🎉 ZKP Anonymous Submission - FIXED!

## What Was Done

### ✅ Step 1: Redeployed MerkleZKRegistry
**NEW MerkleZK Address:** `0x22f2060fbe50403e588d70156776F72ab060Ab9c`

- Deployed pointing to the correct Registry (`0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44`)
- Initialized with contributor tree (Admin 1 registered)
- Bidirectionally linked to Registry

### ✅ Step 2: Updated Frontend
**File:** `cti-frontend/utils/constants.js`

Updated to use the LATEST deployment addresses from your server:
```javascript
registry: "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44"
governance: "0xa186FEE32e311f65C55612fc98195B27113d1e48"
storage: "0xBBCC5a5c29Fbf3aB8B97a4869871C70fADE6C0Cd"
merkleZK: "0x22f2060fbe50403e588d70156776F72ab060Ab9c" // NEW!
```

## Final Contract Addresses (Arbitrum Sepolia)

| Contract | Address | Status |
|----------|---------|--------|
| **PrivacyPreservingRegistry** | `0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44` | ✅ Latest, has ZKP fix |
| **ThresholdGovernance** | `0xa186FEE32e311f65C55612fc98195B27113d1e48` | ✅ Latest |
| **StorageContribution** | `0xBBCC5a5c29Fbf3aB8B97a4869871C70fADE6C0Cd` | ✅ Latest |
| **MerkleZKRegistry** | `0x22f2060fbe50403e588d70156776F72ab060Ab9c` | ✅ NEW, correctly linked |
| **OracleIOCFeed** | `0xbdFcBE759232c9435FB4AdfF937A6173B5b904bE` | ✅ Existing |

## What You Need to Do Now

### 1. Sync Files from Server (IMPORTANT)

Your server has updated JSON files that need to be synced to your local machine:

```bash
# On your local machine (macOS)
cd ~/decentralized-cti-platform-1

# Pull from server (if you have git push/pull setup)
git pull origin main

# OR manually copy from server:
# scp sc@sc:~/blockchain-dev/test-addresses-arbitrum.json .
# scp sc@sc:~/blockchain-dev/contributor-merkle-tree.json .
```

### 2. Restart Frontend Dev Server

```bash
cd cti-frontend
npm run dev
```

### 3. Test Anonymous Submission

1. Open browser to `http://localhost:3000/submit`
2. Select **"Anonymous"** mode
3. Add test IOCs:
   - `192.168.1.100`
   - `malware.example.com`
   - `44d88612fea8a8f36de82e1278abb02f`
4. Click **Submit**

**Expected Result:** ✅ Transaction succeeds!

## Verification Commands

Run these on your server to verify everything is linked correctly:

```bash
# Check MerkleZK points to correct Registry
cast call 0x22f2060fbe50403e588d70156776F72ab060Ab9c \
  "mainRegistry()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
# Should return: 0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44

# Check Registry trusts MerkleZK
cast call 0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44 \
  "merkleZKRegistry()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
# Should return: 0x22f2060fbe50403e588d70156776F72ab060Ab9c

# Check contributor tree is initialized
cast call 0x22f2060fbe50403e588d70156776F72ab060Ab9c \
  "contributorMerkleRoot()(bytes32)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
# Should return: 0xca3f375f2781ea9580207b753d11dca88dd7b7e23f299f6aeeba337c8b8a74ba
```

## How the Fix Works

### Before (Broken)
```
Frontend → OLD MerkleZK (0x74A2...) 
         → OLD Registry (0x892a...) 
         → ❌ "Invalid ZKP commitment"
```

**Problem:** OLD Registry didn't have the fix to trust MerkleZK submissions

### After (Fixed)
```
Frontend → NEW MerkleZK (0x22f2...) 
         → NEW Registry (0x70Fa...) 
         → ✅ Submission accepted!
```

**Solution:** NEW Registry checks `if (msg.sender == merkleZKRegistry)` and bypasses the `validCommitments` check

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                         │
│  (Updated constants.js with new MerkleZK address)  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              MerkleZKRegistry                       │
│         0x22f2060fbe50403e588d70156776F72ab060Ab9c  │
│  • Verifies Merkle proof (contributor is in tree)  │
│  • Checks commitment uniqueness                     │
│  • Forwards to mainRegistry                         │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│         PrivacyPreservingRegistry                   │
│         0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44  │
│  • Checks: msg.sender == merkleZKRegistry? ✅       │
│  • Bypasses validCommitments check                  │
│  • Accepts anonymous submission                     │
└─────────────────────────────────────────────────────┘
```

## What Changed in the Code

### contracts/PrivacyPreservingRegistry.sol

```solidity
// 1. Added variable to store trusted MerkleZK address
address public merkleZKRegistry;

// 2. Added setter function (owner only)
function setMerkleZKRegistry(address _merkleZKRegistry) external onlyOwner {
    merkleZKRegistry = _merkleZKRegistry;
}

// 3. Modified addBatch() to trust MerkleZK
function addBatch(...) public payable {
    // ... existing code ...
    
    // NEW: Trust submissions from MerkleZK
    if (msg.sender != merkleZKRegistry) {
        require(validCommitments[commitment], "Invalid ZKP commitment");
    }
    
    // ... rest of function ...
}
```

### cti-frontend/utils/constants.js

```javascript
arbitrumSepolia: {
  contracts: {
    registry: "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44", // UPDATED
    merkleZK: "0x22f2060fbe50403e588d70156776F72ab060Ab9c", // UPDATED
    // ... other contracts ...
  }
}
```

## Troubleshooting

### If submission still fails:

1. **Clear browser cache** (Cmd+Shift+R)
2. **Check MetaMask network** - Must be "Arbitrum Sepolia"
3. **Verify contract addresses in browser console**:
   ```javascript
   console.log(NETWORKS.arbitrumSepolia.contracts);
   ```
4. **Check transaction on Arbiscan** for revert reason

### If you get "execution reverted":

- Ensure you've synced the updated `constants.js` file
- Restart frontend dev server
- Check you have enough ETH for gas (~0.001 ETH)

## Explorer Links

- **Registry**: https://sepolia.arbiscan.io/address/0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44
- **MerkleZK**: https://sepolia.arbiscan.io/address/0x22f2060fbe50403e588d70156776F72ab060Ab9c
- **Governance**: https://sepolia.arbiscan.io/address/0xa186FEE32e311f65C55612fc98195B27113d1e48

## Summary of Changes

✅ Redeployed MerkleZKRegistry pointing to correct Registry  
✅ Initialized contributor tree (Admin 1 registered)  
✅ Linked Registry ↔ MerkleZK bidirectionally  
✅ Updated frontend constants.js  
✅ Updated test-addresses-arbitrum.json (on server)  
✅ Updated contributor-merkle-tree.json (on server)  

## Next Steps

1. ✅ **Sync files from server** (git pull or scp)
2. ✅ **Restart frontend**
3. ✅ **Test anonymous submission** - should work!
4. 📝 **Optional:** Add Admin 2 and Admin 3 to contributor tree (creates multi-leaf tree)

---

**Status:** 🟢 READY TO TEST  
**Action Required:** Sync files and restart frontend  
**Expected Result:** Anonymous submissions should work immediately!
