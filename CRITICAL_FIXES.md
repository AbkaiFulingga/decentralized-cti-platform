# Critical Fixes Applied - December 24, 2025

## Issue #1: WRONG CONTRACT ADDRESSES ❌ → ✅ FIXED

**Problem**: Frontend was using incorrect Sepolia contract addresses from an old deployment.

**Root Cause**:
- `constants.js` had: `0xB490aBfFf0639453a8A5e5e52BF4E8055269cfE4`
- `test-addresses.json` has: `0xea816C1B93F5d76e03055BFcFE2ba5645341e09E`
- Contract at 0xB490... has 0 batches → everything blank
- Contract at 0xea81... has the actual data

**Fix Applied**:
```javascript
// cti-frontend/utils/constants.js
contracts: {
  registry: "0xea816C1B93F5d76e03055BFcFE2ba5645341e09E",  // ✅ CORRECT
  governance: "0xfE4aDfFA3C1d855b21161B1f38167eC5c3C0d919",  // ✅ CORRECT
  storage: "0x6032c74688Be90A9E91d770bCe2d5D07d219ebDd"    // ✅ CORRECT
}
```

---

## Issue #2: INFURA BLOCK RANGE TOO LARGE ❌ → ⏳ NEEDS FIX

**Problem**: Querying 1000 blocks when Infura free tier allows max 10 blocks.

**Error**:
```
Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range. 
Based on your parameters, this block range should work: [0x971af1, 0x971afa]
```

**Current Code** (WRONG):
```javascript
const fromBlock = Math.max(0, latestBlock - 1000);  // ❌ TOO LARGE
events = await registry.queryFilter(filter, fromBlock, 'latest');
```

**Solution Needed**: Query in 10-block chunks iteratively

**Components Affected**:
1. ContributorDashboard.jsx (line 251)
2. EnhancedIOCSearch.jsx (line 139)
3. AnalyticsDashboard.jsx (line 272)
4. BatchBrowser.jsx (line 153)
5. TransactionHistory.jsx (line 140)
6. AdminGovernancePanel.jsx (line 208)

---

## Issue #3: ADMIN APPROVAL TRANSACTION REVERTS

**Problem**: Admin approval transactions fail with "transaction execution reverted".

**Error**:
```
Failed to approve batch: transaction execution reverted 
(status=0, gasUsed=30506, no logs)
```

**Possible Causes**:
1. Wrong governance contract address (now fixed with #1)
2. Batch index doesn't exist
3. Already approved
4. Not an admin
5. Governance not linked to registry

**Next Steps**: Test with correct contract addresses first, then debug if still fails.

---

## Deployment Status

### ✅ Fixed:
- Contract addresses updated in constants.js

### ⏳ Pending:
- Deploy updated constants.js to server
- Fix Infura block range queries  
- Restart Next.js service
- Test admin approval with correct contracts

### 🔧 Commands to Run:

```bash
# 1. Commit address fix
git add cti-frontend/utils/constants.js
git commit -m "fix: Update Sepolia contract addresses to match test-addresses.json"
git push origin main

# 2. Deploy to server
scp cti-frontend/utils/constants.js sc@192.168.1.11:~/blockchain-dev/cti-frontend/utils/

# 3. Restart Next.js
ssh sc@192.168.1.11 'pm2 restart nextjs-dev'

# 4. Test admin approval
# After restart, try approving a batch again in the UI
```

---

## Additional Notes

**Merkle Tree**: User still not in tree because they haven't registered yet. Run:
```bash
npx hardhat run scripts/registerContributor.js --network sepolia
```

**Transaction History**: Should work after contract address fix and service restart.

**Search Results**: Should populate after contract address fix.

**Browse**: Should show batches after contract address fix.
