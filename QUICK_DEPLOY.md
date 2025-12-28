# 🚀 Quick Deployment Commands

## Run These Commands in Order:

### 1. SSH to your server
```bash
ssh user@192.168.1.11
```

### 2. Run the automated deployment script
```bash
bash /home/user/decentralized-cti-platform-3/scripts/deploy-analytics-indexer.sh
```

That's it! The script will handle everything automatically.

---

## What the Script Does:

✅ Pulls latest code from GitHub (commit 7e57b81)
✅ Creates cache directory
✅ Starts analytics-indexer PM2 daemon
✅ Waits 30 seconds for first cache build
✅ Verifies cache file was created
✅ Restarts Next.js application
✅ Saves PM2 config for auto-restart

---

## Verification (After Script Completes):

### Check indexer is running:
```bash
pm2 status
```
Should show: `analytics-indexer | online`

### Watch live logs:
```bash
pm2 logs analytics-indexer
```

### Test Analytics page:
Open browser to: **http://192.168.1.11:3000/statistics**

Should load instantly (< 1 second) instead of 2-5 minutes!

---

## If Something Goes Wrong:

### View detailed logs:
```bash
pm2 logs analytics-indexer --lines 50
```

### Restart indexer:
```bash
pm2 restart analytics-indexer
```

### Check cache file:
```bash
ls -lh /home/user/decentralized-cti-platform-3/cti-frontend/public/cache/
cat /home/user/decentralized-cti-platform-3/cti-frontend/public/cache/analytics-cache.json | head -20
```

---

## Expected Timeline:

- **Script runtime**: 40-60 seconds
- **First cache build**: 30-60 seconds (included in script)
- **Analytics page load**: < 1 second (after cache built)
- **Cache updates**: Every 5 minutes automatically

---

## Success Indicators:

✅ Script shows "✅ Deployment Complete!"
✅ `pm2 status` shows `analytics-indexer | online`
✅ Logs show "✅ Cache updated in X seconds"
✅ Cache file exists and has data
✅ Analytics page loads instantly
✅ Page shows "✅ Fresh" green badge

---

For detailed documentation, see: `ANALYTICS_INDEXER_DEPLOYMENT.md`
