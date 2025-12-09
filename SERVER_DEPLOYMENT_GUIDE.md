# 🚀 Server Deployment Guide - Attack Simulations

## Quick Deploy to Server

### Step 1: Pull Latest Code

```bash
# SSH into your server
ssh user@your-server

# Navigate to project directory
cd ~/decentralized-cti-platform-2  # or your path

# Pull latest code
git pull origin main
```

### Step 2: Verify Files

```bash
# Check that attack simulation files exist
ls -la scripts/attack-simulations/

# You should see:
# - linkability-attack.js
# - sybil-attack.js
# - replay-attack.js
# - deanonymization-attack.js
# - run-all-attacks.js
# - README.md
# - QUICKSTART.md
# - IMPLEMENTATION_COMPLETE.md
```

### Step 3: Install Dependencies (if needed)

```bash
# If you haven't installed dependencies yet
npm install

# Verify hardhat is available
npx hardhat --version
```

### Step 4: Run Attack Simulations

```bash
# Option 1: Run all attacks (recommended)
npm run security:audit

# Option 2: Run individual attacks
npm run security:linkability
npm run security:sybil
npm run security:replay
npm run security:deanon

# Option 3: Manual execution
npx hardhat run scripts/attack-simulations/run-all-attacks.js --network arbitrumSepolia
```

### Step 5: View Results

```bash
# View the security report
cat scripts/attack-simulations/SECURITY_REPORT.md

# Or view JSON results
cat scripts/attack-simulations/SECURITY_REPORT.json

# View individual attack results
ls -la scripts/attack-simulations/*-results.json
```

---

## 🔧 Troubleshooting on Server

### Issue: "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Network not configured"

Check your `.env` file has the correct RPC URLs:
```bash
# Edit .env (don't commit this!)
nano .env

# Should have:
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Issue: "Contract not found"

Make sure deployment addresses are up to date:
```bash
# Check if deployment files exist
ls -la test-addresses*.json

# Should see:
# - test-addresses.json (Sepolia L1)
# - test-addresses-arbitrum.json (Arbitrum L2)
```

### Issue: "Insufficient funds"

The attack simulations read on-chain data and don't require gas for most operations. However, replay attack creates one test submission:

```bash
# Check balance
npx hardhat run scripts/checkBalance.js --network arbitrumSepolia

# If needed, fund from faucet:
# Arbitrum Sepolia: https://faucet.triangleplatform.com/arbitrum/sepolia
```

---

## 📊 Expected Output

When you run `npm run security:audit`, you should see:

```
═══════════════════════════════════════════════════════
🛡️  COMPREHENSIVE SECURITY ATTACK SIMULATION SUITE
═══════════════════════════════════════════════════════

🌐 Using network: arbitrumSepolia (Arbitrum L2)

⏱️  Estimated time: 2-3 minutes

─────────────────────────────────────────────────────────

🚀 Running: Linkability Attack
[... attack output ...]
✅ ATTACK FAILED (SYSTEM SECURE)

🚀 Running: Sybil Attack
[... attack output ...]
✅ ATTACK FAILED (SYSTEM SECURE)

🚀 Running: Replay Attack
[... attack output ...]
✅ ATTACK FAILED (SYSTEM SECURE)

🚀 Running: Deanonymization Attack
[... attack output ...]
✅ ATTACK FAILED (SYSTEM SECURE)

📊 COMPREHENSIVE SECURITY AUDIT REPORT
─────────────────────────────────────────────────────────
Total attacks tested: 4
Attacks blocked: 4
Attacks succeeded: 0
Security score: 100%

🏆 EXCELLENT: All attacks blocked!
```

---

## 🎯 For Live Demo on Server

If you want to run the frontend security demo:

```bash
# Navigate to frontend
cd cti-frontend

# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# Start the server
npm start
# Or with PM2 for persistent running:
pm2 start npm --name "cti-frontend" -- start

# Access the security demo at:
# http://your-server-ip:3000/security-demo
```

---

## 🔒 Security Notes

### Don't Commit These Files:
- `.env` (contains private keys)
- `node_modules/` (large, reinstallable)
- `*-results.json` (generated files)
- `SECURITY_REPORT.*` (generated files)

### Safe to Commit:
- ✅ Attack simulation scripts
- ✅ Documentation
- ✅ Package.json changes
- ✅ Frontend code

---

## 🎓 Running Before Your Presentation

**1 Day Before:**
```bash
# Run full audit on server
npm run security:audit

# Save results for backup
cp scripts/attack-simulations/SECURITY_REPORT.md ~/backup-security-report.md
```

**During Presentation:**

Option A: Show pre-generated results
```bash
cat scripts/attack-simulations/SECURITY_REPORT.md
```

Option B: Run live (more impressive!)
```bash
npm run security:linkability  # Run one attack live
```

---

## 📱 Quick Commands Cheat Sheet

```bash
# Pull latest code
git pull origin main

# Run all attacks
npm run security:audit

# Run single attack
npm run security:sybil

# View results
cat scripts/attack-simulations/SECURITY_REPORT.md

# Check what changed
git log --oneline -5

# Verify files
ls -la scripts/attack-simulations/
```

---

## ✅ Post-Deployment Checklist

- [ ] Code pulled from GitHub
- [ ] Dependencies installed (`npm install`)
- [ ] Attack scripts are executable
- [ ] Can run `npm run security:audit` successfully
- [ ] Security report generated
- [ ] All 4 attacks show "FAILED" (system secure)
- [ ] Frontend demo accessible (optional)

---

**You're ready to demo! 🚀**

**Estimated time from pull to results: 5 minutes**

**Token Usage: ~87,000 / 1,000,000 (91.3% remaining)**
