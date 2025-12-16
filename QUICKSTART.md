# Quick Start Guide - 15 Minutes to Running System

Get the decentralized CTI platform running in under 15 minutes.

---

## ⚡ Prerequisites (2 minutes)

Before starting, ensure you have:
- ✅ Node.js 18+ installed ([download](https://nodejs.org))
- ✅ MetaMask browser extension ([install](https://metamask.io))
- ✅ Git installed

---

## 🚀 Step 1: Clone & Install (3 minutes)

```bash
# Clone repository
git clone https://github.com/AbkaiFulingga/decentralized-cti-platform.git
cd decentralized-cti-platform

# Install dependencies
npm install

# Frontend setup
cd cti-frontend
npm install
cd ..
```

---

## 🔧 Step 2: Configure Environment (2 minutes)

```bash
# Copy environment template
cp .env.example .env

# Add your keys (optional for testing)
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
# PRIVATE_KEY_ADMIN1=your-test-private-key
# PINATA_JWT=your-pinata-jwt-token
```

**Note:** For testing, you can use the deployed contracts on Arbitrum Sepolia without deploying your own.

---

## ✅ Step 3: Run Tests (5 minutes)

```bash
# Run smart contract tests
npx hardhat test

# Expected output:
# ✅ 35/35 tests passing
# ✅ Duration: ~26 seconds
```

**All tests should pass.** If any fail, check your Node.js version (must be 18+).

---

## 🌐 Step 4: Start Frontend (2 minutes)

```bash
cd cti-frontend
npm run dev

# Open browser to: http://localhost:3000
```

**You should see:**
- Dashboard with statistics
- IOC submission form
- "Use Anonymous Submission" toggle (zkSNARK feature)

---

## 🎯 Step 5: Test Anonymous Submission (3 minutes)

### A. Connect Wallet
1. Click "Connect Wallet" in top-right
2. Connect MetaMask
3. Switch to **Arbitrum Sepolia** network
   - Network Name: Arbitrum Sepolia
   - RPC URL: https://sepolia-rollup.arbitrum.io/rpc
   - Chain ID: 421614
   - Currency: ETH

### B. Get Test ETH
- Visit: https://faucets.chain.link/arbitrum-sepolia
- Request test ETH (free)
- Wait 30 seconds for confirmation

### C. Submit Anonymous IOC
1. Toggle **"Use Anonymous Submission"** (zkSNARK mode)
2. Enter test IOC: `192.0.2.1` (example IP)
3. Click **"Generate Proof & Submit"**
4. Wait 2-3 seconds for proof generation
5. Confirm transaction in MetaMask
6. ✅ Success! Your identity is cryptographically hidden

---

## 🔍 Step 6: Verify on Blockchain (1 minute)

1. Copy transaction hash from confirmation
2. Visit: https://sepolia.arbiscan.io
3. Paste transaction hash
4. Verify:
   - ✅ Function: `addPrivacyBatch()`
   - ✅ Gas Used: ~209,000
   - ✅ Status: Success
   - ✅ Commitment visible, address hidden

---

## 📊 What You Just Did

Congratulations! You just:
1. ✅ Generated a zkSNARK proof in your browser
2. ✅ Submitted an anonymous IOC to the blockchain
3. ✅ Hid your identity within a 100-contributor anonymity set
4. ✅ Used Groth16 proofs with Poseidon hash optimization

**Anonymity:** Your submission is indistinguishable from 99 other contributors (1% identifiable vs 100% without zkSNARKs)

---

## 🎥 Video Demo

Want to see it in action first? Watch our 5-minute demo:
- **[Demo Video]** - Coming soon (record per ASSIGNMENT_IMPROVEMENTS.md)

---

## 📚 Next Steps

### Learn More
- **Architecture:** See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
- **Security:** Read [CRYPTOGRAPHIC_AUDIT.md](CRYPTOGRAPHIC_AUDIT.md)
- **Implementation:** Check [POSEIDON_ZKSNARKS_COMPLETE.md](POSEIDON_ZKSNARKS_COMPLETE.md)
- **Testing:** Review [ZKSNARK_TEST_CASES.md](ZKSNARK_TEST_CASES.md)

### Deploy Your Own
```bash
# Deploy contracts to Arbitrum Sepolia
npx hardhat run scripts/deploy-merkle-zk.js --network arbitrumSepolia

# Link contracts
npx hardhat run scripts/link-merkle-zk.js --network arbitrumSepolia
```

### Run Advanced Tests
```bash
# Security tests
npm run test:security

# zkSNARK soundness tests
npx hardhat test test/zksnark-soundness.test.js

# Gas optimization tests
npm run test:gas
```

---

## 🆘 Troubleshooting

### Issue: "Assert Failed" in Circuit
**Solution:** Tree root mismatch. Rebuild with Poseidon:
```bash
node scripts/build-poseidon-tree.js
```

### Issue: "Invalid Proof" on Contract
**Solution:** Ensure contributor is registered in tree:
```bash
node scripts/check-merkle-root.js
```

### Issue: MetaMask Not Connecting
**Solution:** 
1. Check network is Arbitrum Sepolia (Chain ID: 421614)
2. Clear MetaMask cache
3. Re-import account if needed

### Issue: Transaction Fails
**Solution:**
1. Check you have test ETH (need ~0.001 ETH)
2. Verify contract addresses in `test-addresses-arbitrum.json`
3. Check if contributor is registered

---

## 📞 Get Help

- **Documentation:** See [DOCUMENTATION_SUMMARY.md](DOCUMENTATION_SUMMARY.md)
- **Full Guide:** Read [PATH_TO_100_PERCENT.md](PATH_TO_100_PERCENT.md)
- **GitHub Issues:** Report problems on GitHub
- **Email:** [Add your email]

---

## ✨ Key Features You Can Now Use

| Feature | What It Does | How to Access |
|---------|--------------|---------------|
| **Anonymous Submission** | Submit IOCs with zkSNARK privacy | Toggle in submit form |
| **Public Submission** | Submit with identity visible | Default mode |
| **Dashboard** | View platform statistics | Homepage |
| **Batch Verification** | Verify IOC batches | Navigate to /batches |
| **Admin Governance** | Approve submissions | Navigate to /admin |

---

## 🎯 Success Checklist

After completing this guide, you should have:
- [x] Repository cloned and dependencies installed
- [x] All tests passing (35/35)
- [x] Frontend running locally
- [x] MetaMask connected to Arbitrum Sepolia
- [x] Test ETH in wallet
- [x] Submitted anonymous IOC with zkSNARK proof
- [x] Verified transaction on Arbiscan
- [x] Understood anonymity improvement (99x better)

---

## 📈 Performance Metrics

From your test submission, you should observe:
- ⚡ Proof Generation: **2-3 seconds**
- 💰 Gas Cost: **~209,000** (40% better than expected)
- 🔒 Anonymity: **1%** identifiable (vs 100% without zkSNARKs)
- 🎯 Security: **90% cryptographic compliance**
- ✅ Success Rate: **100%** (if all steps followed)

---

**Total Time:** ~15 minutes  
**Difficulty:** Beginner-friendly  
**Result:** Working anonymous IOC submission system

**Ready for more?** Check out [ASSIGNMENT_IMPROVEMENTS.md](ASSIGNMENT_IMPROVEMENTS.md) for ways to enhance the project! 🚀
