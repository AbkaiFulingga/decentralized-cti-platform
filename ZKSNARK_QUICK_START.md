# zkSNARK Testing - Quick Start Guide

## 🚀 Deploy to Server (Run These Commands)

### **Step 1: Push Code from Mac**
```bash
# On your Mac
cd /Users/user/decentralized-cti-platform-2
git add .
git commit -m "Add browser-based zkSNARK proof generation"
git push origin main
```

### **Step 2: Update Server & Deploy Circuits**
```bash
# SSH to server
ssh sc@192.168.1.11

# Pull latest code
cd ~/blockchain-dev
git pull origin main

# Deploy circuit files to frontend
bash scripts/deploy-circuits-server.sh
```

### **Step 3: Install Dependencies & Start Website**
```bash
# Still on server
cd ~/blockchain-dev/cti-frontend

# Install snarkjs and other dependencies
npm install

# Start Next.js development server
npm run dev
```

**Website is now live at**: `http://192.168.1.11:3000`

---

## 🧪 Test Anonymous Submission

### **From Your Mac Browser**:

1. **Open website**: http://192.168.1.11:3000

2. **Connect MetaMask**:
   - Network: Arbitrum Sepolia
   - Ensure you have test ETH (~0.2 ETH recommended)

3. **Register** (if not already):
   - Select tier (Standard: 0.05 ETH recommended)
   - Submit registration transaction
   - Wait for confirmation

4. **Submit Anonymously**:
   - Enter test IOCs:
     ```
     malicious-domain.com
     192.168.1.100
     5d41402abc4b2a76b9719d911017c592
     ```
   - Select "Anonymous (zkSNARK)" mode
   - Click "🔒 Submit Anonymously (zkSNARK)"

5. **Watch the magic happen**:
   - Browser downloads circuit files (~22 MB, cached after first time)
   - Progress shows: "Loading circuit files..."
   - Progress shows: "Computing witness..."
   - Wait 10-30 seconds for proof generation ⏱️
   - Approve MetaMask transaction
   - Transaction confirms! ✅

6. **Verify anonymity**:
   - Check transaction on Arbiscan
   - Your address should NOT be visible in the batch
   - Only a commitment hash is stored

---

## 📊 What to Check

### **Browser Console** (F12):
```
✅ zkSNARK prover ready
🔐 Starting Groth16 zkSNARK Proof Generation
✅ Proof generated in 15234ms (15.2s)
📡 Submitting Anonymous Batch with Groth16 Proof
Transaction hash: 0x1234...
✅ Transaction confirmed!
Gas used: 287654
```

### **On-Chain** (Arbiscan):
- Look for `AnonymousBatchSubmitted` event
- Should show commitment hash, NOT your address
- Gas used: ~250-300k (vs ~100k for public)

---

## 🔧 Troubleshooting

### **"Circuit files not found"**
```bash
# On server, verify files exist:
ls -lh ~/blockchain-dev/cti-frontend/public/circuits/

# Should show:
# contributor-proof.wasm          2.1M
# contributor-proof_final.zkey    20M
# verification_key.json           2.0K

# If missing, run:
cd ~/blockchain-dev
bash scripts/deploy-circuits-server.sh
```

### **"npm install fails"**
```bash
# On server:
cd ~/blockchain-dev/cti-frontend
rm -rf node_modules package-lock.json
npm install
```

### **"Proof generation too slow"**
- First time: Downloads 22 MB of circuit files (normal)
- Subsequent times: Uses browser cache (much faster)
- Computation: 10-30s is expected for zkSNARK proof generation

### **"Transaction reverted"**
- Check if you're registered: `isRegistered` should be true
- Check if you're in the tree: Wait for next tree update (2 AM UTC)
- Check Merkle root: Must match between frontend and contract

---

## 🎯 Expected Results

| Test | Expected Outcome |
|------|------------------|
| Circuit file download | ~22 MB downloaded (cached after) |
| Proof generation | 10-30 seconds |
| Transaction success | ✅ Confirmed |
| Gas used | ~250-300k gas |
| Address visibility | ❌ NOT visible (only commitment) |
| Anonymity set | Hidden among N contributors |

---

## 📸 Screenshots for FYP

Capture these screens:

1. **Privacy Mode Selection**:
   - Show "Anonymous (zkSNARK)" button
   - "Groth16 proof generated in browser"

2. **Proof Generation**:
   - Progress indicator showing
   - "Generating zkSNARK Proof"
   - "Computing witness (may take 10-30 seconds)..."

3. **Success Message**:
   - "✅ Anonymous batch submitted with zkSNARK proof! 🎭"
   - "Hidden among X contributors"
   - "Proof generation: 15.2s"
   - "Gas used: 287654"

4. **Transaction on Arbiscan**:
   - Show `AnonymousBatchSubmitted` event
   - Highlight: commitment hash visible, address NOT visible

5. **Console Logs**:
   - Show proof generation details
   - Gas comparison: public (~100k) vs zkSNARK (~300k)

---

## 🎓 Demo Script for Presentation

### **"Let me demonstrate anonymous IOC submission with zkSNARKs"**

1. **Setup**: "I'm using a browser-based zkSNARK proof generator"
2. **Action**: "Watch as the browser generates a Groth16 proof locally"
3. **Wait**: "This takes 10-30 seconds because it's cryptographically secure"
4. **Submit**: "Now submitting the proof to the blockchain"
5. **Verify**: "Notice my address is NOT visible - only a commitment hash"
6. **Compare**: "This costs 3x more gas than public submission, but provides privacy"

### **Key Talking Points**:
- ✅ **Privacy**: Address hidden via zero-knowledge proof
- ✅ **Browser-based**: No server needed, fully client-side
- ✅ **Groth16**: Industry-standard zkSNARK protocol (128-bit security)
- ✅ **Trade-offs**: 3x gas cost, 10-30s generation time for privacy
- ✅ **Scalable**: Verification cost constant, regardless of anonymity set size

---

## 🚀 Ready to Test!

Run the commands above and test the zkSNARK anonymous submission! 🎭
