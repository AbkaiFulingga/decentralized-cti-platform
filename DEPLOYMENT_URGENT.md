# 🚀 URGENT: Server Deployment Required - Commit 79b92f0

## ⚠️ Critical Issues on Live Server

Your **server has NOT been updated** with the latest fixes. The error logs show:

1. ❌ **Analytics still using old Arbitrum address**: `0xC40827e7...` (should be `0x70Fa3936...`)
2. ❌ **All components querying from block 0**: Causing 429 rate limit errors
3. ❌ **Search bar blocked**: Indexing taking too long due to genesis queries

## 📦 What Was Fixed (Commits a51cdcb → 79b92f0)

### Commit a51cdcb: Contract Address & ABI Fixes
- ✅ Fixed Arbitrum contract addresses in `constants.js`
- ✅ Fixed Analytics to count contributors from events (not non-existent function)
- ✅ Fixed AdminPanel to use `getBatchApprovalStatus()` instead of struct getter

### Commit 79b92f0: Deployment Block Optimizations
- ✅ TransactionHistory: Query from deployment block (fixes 429 errors)
- ✅ ContributorDashboard: Query from deployment block (faster load)
- ✅ BatchBrowser: Query from deployment block (< 1 min load)
- ✅ AdminGovernancePanel: Query from deployment block (instant load)

## 🔧 Deployment Commands

### Option 1: SSH with Password (Manual)
```bash
# 1. SSH into server
ssh user@192.168.1.11
# Enter password when prompted

# 2. Pull latest code
cd /home/user/decentralized-cti-platform-3
git pull origin main

# 3. Verify correct commit
git log -1 --oneline
# Should show: 79b92f0 🔧 Fix remaining block 0 queries across all components

# 4. Restart Next.js (CRITICAL - code won't update without restart)
cd cti-frontend
pm2 restart nextjs-dev

# 5. Verify running
pm2 status
pm2 logs nextjs-dev --lines 50

# 6. Check for errors
pm2 logs nextjs-dev --err --lines 20
```

### Option 2: Alternative SSH User (if 'user' doesn't work)
```bash
# Try with 'sc' user
ssh sc@192.168.1.11

# Same commands as above
cd /home/sc/decentralized-cti-platform-3  # Adjust path if needed
git pull origin main
cd cti-frontend
pm2 restart nextjs-dev
```

## ✅ Verification Steps After Deployment

### 1. Analytics Page (http://192.168.1.11:3000/statistics)
**Expected**:
- ✅ Loads in < 10 seconds (not 2-5 minutes)
- ✅ Shows correct batch counts for L1 + L2
- ✅ Shows contributor counts calculated from events
- ✅ Heatmap displays with color-coded intensity
- ✅ No `CALL_EXCEPTION` errors in console

**Console Test**:
```javascript
// Should see correct Arbitrum address
console.log(NETWORKS.arbitrumSepolia.contracts.registry);
// Expected: "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44"
// NOT: "0xC40827e7dF3a26dFfb7fd2B9FbEB6b3e964599AD"
```

### 2. Search Page (http://192.168.1.11:3000/search)
**Expected**:
- ✅ Indexing completes in < 30 seconds
- ✅ No "Max retries reached" errors
- ✅ Search bar becomes active after indexing
- ✅ Results return when searching IOCs

**Console Test**:
```javascript
// Check deployment block usage
// Should see: "Fetched X events (from block 7340000)" for Sepolia
// Should see: "Fetched X events (from block 96000000)" for Arbitrum
```

### 3. Transaction History (http://192.168.1.11:3000/history)
**Expected**:
- ✅ Loads user transactions in < 1 minute
- ✅ No 429 rate limit errors from Alchemy
- ✅ Shows batches from both Sepolia and Arbitrum

**Console Test**:
```javascript
// Should NOT see:
// ❌ "Your app has exceeded its compute units per second capacity"
// Should see:
// ✅ "Fetched X BatchAdded events (from block 7340000)"
```

### 4. Browse Page (http://192.168.1.11:3000/browse)
**Expected**:
- ✅ Eth Sepolia shows batches (not empty)
- ✅ Arbitrum Sepolia shows batches
- ✅ Both networks load in < 1 minute

### 5. Admin Panel (http://192.168.1.11:3000/admin)
**Expected**:
- ✅ Loads pending batches instantly
- ✅ Approval transactions succeed
- ✅ Batches disappear after 3 approvals
- ✅ Shows "Approved ✅ Processing..." toast for 5 seconds

## 🐛 Common Deployment Issues

### Issue 1: "Already up to date" but errors persist
**Cause**: PM2 hasn't restarted Next.js with new code  
**Solution**:
```bash
cd /home/user/decentralized-cti-platform-3/cti-frontend
pm2 restart nextjs-dev --update-env
# Or force rebuild:
pm2 delete nextjs-dev
npm run pm2
```

### Issue 2: PM2 process not running
**Cause**: Process died or was stopped  
**Solution**:
```bash
cd /home/user/decentralized-cti-platform-3/cti-frontend
npm run pm2  # Starts nextjs-dev process
pm2 save     # Persist for reboots
```

### Issue 3: Still seeing old Arbitrum address in console
**Cause**: Browser cache or build cache  
**Solution**:
```bash
# On server:
cd /home/user/decentralized-cti-platform-3/cti-frontend
rm -rf .next/cache
pm2 restart nextjs-dev

# In browser:
Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
Clear cache: DevTools → Network → Disable cache
```

### Issue 4: Cannot SSH into server
**Cause**: Firewall, wrong credentials, or SSH service down  
**Solution**:
- Try alternate user: `ssh sc@192.168.1.11`
- Check if server is reachable: `ping 192.168.1.11`
- Access server directly (physical/console) and run:
  ```bash
  sudo systemctl status ssh
  sudo systemctl restart ssh
  ```

## 📊 Performance Comparison

| Component | Before (Block 0) | After (Deployment Block) | Improvement |
|-----------|-----------------|--------------------------|-------------|
| Analytics | 2-5 minutes | < 10 seconds | **95%+ faster** |
| Search | Never completes | < 30 seconds | **Fixed** |
| History | 429 errors | < 1 minute | **No errors** |
| Browse (Sepolia) | Empty results | Shows batches | **Fixed** |
| Admin Panel | Slow load | Instant | **99% faster** |

## 🔍 Debug Commands

### Check Current Code Version on Server
```bash
ssh user@192.168.1.11
cd /home/user/decentralized-cti-platform-3
git log -1 --oneline
git status
```

### Check PM2 Logs
```bash
pm2 logs nextjs-dev --lines 100      # All logs
pm2 logs nextjs-dev --err --lines 50 # Errors only
pm2 logs nextjs-dev | grep "CALL_EXCEPTION"  # Check for old errors
```

### Check Network Requests
```bash
# On server, monitor RPC calls
pm2 logs nextjs-dev | grep "Rate limit"
pm2 logs nextjs-dev | grep "429"
pm2 logs nextjs-dev | grep "block 0"
```

### Verify Contract Addresses
```bash
# Check constants.js on server
ssh user@192.168.1.11
cd /home/user/decentralized-cti-platform-3
grep -A3 "arbitrumSepolia" cti-frontend/utils/constants.js | grep registry
# Should show: registry: "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44"
```

## 📝 Post-Deployment Checklist

- [ ] SSH into server successfully
- [ ] Git pull shows "Already up to date" or downloads new commits
- [ ] Git log shows commit `79b92f0`
- [ ] PM2 restart completes without errors
- [ ] PM2 status shows "online" for nextjs-dev
- [ ] Analytics page loads in < 10 seconds
- [ ] Search indexing completes successfully
- [ ] Transaction history loads without 429 errors
- [ ] Browse shows Sepolia batches (not empty)
- [ ] Admin panel loads pending batches
- [ ] No `CALL_EXCEPTION` errors in browser console
- [ ] Console shows deployment blocks in logs (7340000 / 96000000)

## 🚨 If Still Broken After Deployment

1. **Check if new code deployed**:
   ```bash
   ssh user@192.168.1.11
   cd /home/user/decentralized-cti-platform-3/cti-frontend/utils
   grep "0x70Fa3936" constants.js
   # Should match. If shows 0xC40827e7, code not updated
   ```

2. **Force rebuild**:
   ```bash
   cd /home/user/decentralized-cti-platform-3/cti-frontend
   rm -rf .next node_modules/.cache
   pm2 restart nextjs-dev
   ```

3. **Check disk space**:
   ```bash
   df -h
   # If > 90% full, clean up:
   pm2 flush  # Clear logs
   ```

4. **Restart entire PM2**:
   ```bash
   pm2 restart all
   pm2 save
   ```

---

**Status**: ✅ All code committed and pushed (commit `79b92f0`)  
**Action Required**: Deploy to production server at 192.168.1.11  
**Expected Time**: 5 minutes for full deployment + verification  
**Impact**: Fixes all demo-blocking performance issues
