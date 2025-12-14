# zkSNARK Deployment - Command Reference Card

## 📋 Quick Commands (Copy & Paste)

### **On Server (192.168.1.11)**

#### **Option A: Run Complete Setup Script (Recommended)**
```bash
ssh sc@192.168.1.11
cd ~/blockchain-dev
git pull origin main
bash scripts/server-deploy-complete.sh
```

#### **Option B: Run Commands Manually**
```bash
# 1. SSH to server
ssh sc@192.168.1.11

# 2. Pull latest code
cd ~/blockchain-dev
git pull origin main

# 3. Deploy circuit files
bash scripts/deploy-circuits-server.sh

# 4. Install dependencies
cd cti-frontend
npm install

# 5. Start website
npm run dev
```

---

## 🌐 **Access Website**

From your Mac browser:
```
http://192.168.1.11:3000
```

---

## 🧪 **Test Anonymous Submission**

1. Open http://192.168.1.11:3000
2. Connect MetaMask (Arbitrum Sepolia)
3. Enter test IOCs:
   ```
   malicious-domain.com
   192.168.1.100
   5d41402abc4b2a76b9719d911017c592
   ```
4. Click "Anonymous (zkSNARK)" mode
5. Submit!
6. Wait 10-30 seconds for proof generation
7. Approve transaction in MetaMask
8. Check console (F12) for proof generation logs

---

## 🔧 **Troubleshooting Commands**

### Check if circuit files exist:
```bash
ssh sc@192.168.1.11
ls -lh ~/blockchain-dev/cti-frontend/public/circuits/
```

### Restart website:
```bash
ssh sc@192.168.1.11
cd ~/blockchain-dev/cti-frontend
pkill -f "next dev"
npm run dev
```

### Check website is running:
```bash
ssh sc@192.168.1.11
ps aux | grep "next dev"
```

### View website logs:
```bash
ssh sc@192.168.1.11
cd ~/blockchain-dev/cti-frontend
# Logs appear in terminal where npm run dev is running
```

---

## 📊 **Verification Checklist**

After deployment, verify:

- [ ] Code pulled: `git log -1` shows latest commit
- [ ] Circuits deployed: `ls public/circuits/*.wasm` exists
- [ ] Dependencies installed: `npm list snarkjs` shows version
- [ ] Website running: `curl http://localhost:3000` returns HTML
- [ ] Browser access: http://192.168.1.11:3000 loads
- [ ] Circuit download: Browser console shows circuit files loading
- [ ] Proof generation: Takes 10-30s and succeeds
- [ ] Transaction: Submits to blockchain successfully

---

## 🎓 **For Your Demo**

Show these in order:

1. **Website UI**: Privacy mode selection
2. **Proof Generation**: Progress indicator (10-30s)
3. **Browser Console**: Proof generation logs
4. **MetaMask**: Transaction approval
5. **Arbiscan**: Anonymous transaction (no address visible)
6. **Success Message**: Gas used, time taken

---

## 🚀 **Ready to Deploy!**

Copy and run the commands above! 🎭
