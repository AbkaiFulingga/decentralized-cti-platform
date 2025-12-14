# zkSNARK Browser Proof Generation - Complete Setup Guide

## 🖥️ System Architecture

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Your Mac       │  push   │     GitHub       │  pull   │  Server          │
│   (Dev Only)     │────────▶│   (Git Repo)     │────────▶│  192.168.1.11    │
│                  │         │                  │         │                  │
│  • Write code    │         │  • Version       │         │  • Compile       │
│  • Git commits   │         │    control       │         │    circuits      │
│                  │         │                  │         │  • Host website  │
└──────────────────┘         └──────────────────┘         │  • Serve files   │
                                                            └──────────────────┘
                                                                     │
                                                                     │ HTTP
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Demo Users      │
                                                            │  (Browsers)      │
                                                            │                  │
                                                            │  • Download      │
                                                            │    circuits      │
                                                            │  • Generate      │
                                                            │    proofs        │
                                                            └──────────────────┘
```

---

## 📋 Complete Workflow

### **Step 1: Compile Circuit (On Server)**

```bash
# SSH to server
ssh sc@192.168.1.11

# Navigate to project
cd ~/blockchain-dev

# Pull latest code from GitHub (if needed)
git pull origin main

# Compile circuit (5-10 minutes)
cd circuits
bash setup-circuit.sh
```

**Output files:**
- `circuits/contributor-proof_js/contributor-proof.wasm` (~2 MB)
- `circuits/contributor-proof_final.zkey` (~20 MB)
- `circuits/verification_key.json` (~2 KB)

---

### **Step 2: Deploy Circuit Files to Frontend (On Server)**

```bash
# Still on server, back to project root
cd ~/blockchain-dev

# Run deployment script
bash scripts/deploy-circuits-server.sh
```

This copies circuit files from `circuits/` to `cti-frontend/public/circuits/` on the **same machine**.

**Result:**
```
cti-frontend/public/circuits/
├── contributor-proof.wasm
├── contributor-proof_final.zkey
└── verification_key.json
```

---

### **Step 3: Install Dependencies (On Server)**

```bash
# Still on server
cd ~/blockchain-dev/cti-frontend

# Install all packages (including snarkjs)
npm install
```

---

### **Step 4: Start Website (On Server)**

```bash
# Still on server, in cti-frontend/
npm run dev

# For production deployment:
# npm run build
# npm start
```

**Website accessible at:**
- `http://192.168.1.11:3000` (from any device on network)
- `http://localhost:3000` (from server itself)

---

### **Step 5: Test from Any Device**

```bash
# From your Mac browser (or any device)
open http://192.168.1.11:3000
```

**What happens:**
1. Browser loads website from server
2. User selects "Anonymous (zkSNARK)" mode
3. Browser downloads circuit files:
   - `http://192.168.1.11:3000/circuits/contributor-proof.wasm`
   - `http://192.168.1.11:3000/circuits/contributor-proof_final.zkey`
4. Browser generates Groth16 proof locally (10-30 seconds)
5. Browser submits proof to Arbitrum Sepolia blockchain
6. ✅ Anonymous submission complete!

---

## 🔄 Development Workflow

### **When you make code changes:**

```bash
# On Mac - Edit code
cd /Users/user/decentralized-cti-platform-2
# ... make changes ...
git add .
git commit -m "Your changes"
git push origin main

# On Server - Deploy changes
ssh sc@192.168.1.11
cd ~/blockchain-dev
git pull origin main

# If circuit changed, recompile:
cd circuits && bash setup-circuit.sh && cd ..
bash scripts/deploy-circuits-server.sh

# If frontend changed, restart:
cd cti-frontend
npm install  # if package.json changed
npm run dev  # or restart existing process
```

---

## 📦 File Locations

### **On Server (192.168.1.11):**

```
/home/sc/blockchain-dev/
├── circuits/
│   ├── contributor-proof.circom          (source)
│   ├── contributor-proof_js/
│   │   └── contributor-proof.wasm        (compiled)
│   └── contributor-proof_final.zkey      (compiled)
│
├── cti-frontend/
│   ├── public/
│   │   └── circuits/
│   │       ├── contributor-proof.wasm    (copied here)
│   │       └── contributor-proof_final.zkey (copied here)
│   ├── utils/
│   │   └── zksnark-prover.js             (your code)
│   └── components/
│       └── IOCSubmissionForm.jsx         (your code)
│
└── scripts/
    └── deploy-circuits-server.sh         (deployment helper)
```

### **On Mac (Local Dev):**

```
/Users/user/decentralized-cti-platform-2/
├── circuits/
│   └── contributor-proof.circom          (edit here)
├── cti-frontend/
│   ├── utils/
│   │   └── zksnark-prover.js             (edit here)
│   └── components/
│       └── IOCSubmissionForm.jsx         (edit here)
└── scripts/
    └── deploy-circuits-server.sh         (edit here)

# Git push → Server pulls → Server compiles & runs
```

---

## 🎯 Why This Architecture?

| Requirement | Solution | Reason |
|-------------|----------|--------|
| Compile circuits | On server | Mac doesn't have circom |
| Host website | On server | Demo accessible to audience |
| Serve circuit files | From server | Browsers download from `192.168.1.11:3000` |
| Generate proofs | In browser | Privacy: secret data never leaves device |
| Development | On Mac | Your preferred dev environment |

---

## ✅ Confirmation Checklist

Before demo:
- [ ] Circuit compiled on server (`setup-circuit.sh` completed)
- [ ] Circuit files deployed to frontend (`deploy-circuits-server.sh` completed)
- [ ] Dependencies installed on server (`npm install` in cti-frontend/)
- [ ] Website running on server (`npm run dev` in cti-frontend/)
- [ ] Website accessible from Mac browser (`http://192.168.1.11:3000` loads)
- [ ] Circuit files downloadable (`/circuits/*.wasm` and `*.zkey` accessible)
- [ ] Frontend code updated to use zksnarkProver (next step!)

---

## 🚀 Next Steps

Now that architecture is clear, proceed to:
1. **Integrate zkSNARK prover in IOCSubmissionForm.jsx**
2. **Test full workflow end-to-end**
3. **Prepare demo materials for FYP**

