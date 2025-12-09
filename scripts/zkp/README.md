# 🔐 zkSNARK Proof Scripts

Scripts for generating and using zero-knowledge proofs for anonymous IOC submissions.

## Quick Start

### 1. Generate a Proof

```bash
# Generate proof for your contributor address
node scripts/zkp/generate-zk-proof.js <your-address> <random-nonce>

# Example:
node scripts/zkp/generate-zk-proof.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 12345
```

**Output:** Proof saved to `zkp-proofs/proof-<timestamp>.json`

**Time:** 10-30 seconds

### 2. Submit Anonymous Batch

```bash
# Submit IOCs using the generated proof
node scripts/zkp/submit-with-proof.js proof-2025-12-10T12-34-56.json

# Or use the latest proof automatically:
node scripts/zkp/submit-with-proof.js
```

**Result:** Anonymous batch submitted without revealing your identity!

---

## 📁 Files

### `generate-zk-proof.js`
Generates zkSNARK proof proving you're a registered contributor without revealing which one.

**Inputs:**
- Contributor address (private)
- Nonce (private)

**Outputs:**
- Commitment (public)
- Merkle root (public)
- zkSNARK proof (public, but reveals nothing about address)

**Process:**
1. Load registered contributors from on-chain registry
2. Build Merkle tree with Poseidon hash
3. Generate Merkle proof of inclusion
4. Generate commitment = Poseidon(address, nonce)
5. Create zkSNARK witness
6. Generate Groth16 proof
7. Verify proof locally
8. Save to JSON file

### `submit-with-proof.js`
Submits anonymous IOC batch using zkSNARK proof.

**Process:**
1. Load proof from JSON file
2. Upload IOCs to IPFS
3. Verify proof locally (before gas costs)
4. Submit transaction with proof
5. Verify submission on-chain

**Gas Cost:** ~250,000 (vs ~80,000 for Merkle-only)

---

## 🔧 Prerequisites

**One-time setup:**

```bash
# 1. Install dependencies
npm install --save-dev snarkjs circomlib

# 2. Install circom compiler
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source ~/.cargo/env
git clone https://github.com/iden3/circom.git
cd circom && cargo build --release && cargo install --path circom

# 3. Compile circuit and generate keys
cd circuits
./setup-circuit.sh  # Takes 5-10 minutes
```

**Required files:**
- `circuits/contributor-proof_js/contributor-proof.wasm`
- `circuits/contributor-proof_final.zkey`
- `circuits/verification_key.json`

**Environment variables:**
- `PINATA_JWT` - For IPFS uploads

---

## 📊 Proof Statistics

```
Circuit Constraints: 10,918
- Non-linear: 5,164
- Linear: 5,754

Circuit Wires: 10,941
Private Inputs: 42
Public Inputs: 2

Proof Generation: 10-30 seconds
Proof Size: 768 bytes
Verification Gas: ~250,000
Security Level: 128-bit
```

---

## 🔒 Security Guarantees

### Zero-Knowledge
The proof reveals **nothing** about your address. Even with unlimited computational power, an attacker cannot determine which registered contributor you are.

### Soundness
It's computationally infeasible to generate a valid proof if you're not a registered contributor. Security level: 128-bit (equivalent to AES-128).

### Replay Protection
Each proof is bound to a unique commitment. Attempting to reuse a proof will fail with "CommitmentAlreadyUsed" error.

---

## 🧪 Testing

```bash
# Test proof generation
node scripts/zkp/generate-zk-proof.js 0xYourAddress 12345

# Test submission
node scripts/zkp/submit-with-proof.js

# Test replay attack (should fail)
node scripts/zkp/submit-with-proof.js proof-2025-12-10T12-34-56.json
node scripts/zkp/submit-with-proof.js proof-2025-12-10T12-34-56.json  # Second attempt fails
```

---

## 📝 Proof File Format

```json
{
  "timestamp": "2025-12-10T12:34:56.789Z",
  "contributor": "0x742d35Cc...",
  "nonce": "12345",
  "commitment": "12345678901234567890...",
  "merkleRoot": "0xabcdef...",
  "proof": {
    "a": ["...", "..."],
    "b": [["...", "..."], ["...", "..."]],
    "c": ["...", "..."],
    "input": ["commitment", "merkleRoot"]
  },
  "generationTimeMs": 15432
}
```

---

## 🚨 Common Issues

### "Circuit WASM not found"
**Solution:** Run `cd circuits && ./setup-circuit.sh`

### "Contributor not found in tree"
**Solution:** Ensure address is registered on-chain via `registry.registerContributor()`

### "CommitmentAlreadyUsed"
**Solution:** Generate new proof with different nonce

### "InvalidMerkleRoot"
**Solution:** Tree has been updated. Regenerate proof with current contributors

### "Proof generation taking too long"
**Normal:** zkSNARK proof generation takes 10-30 seconds due to complex mathematics

---

## 🎯 For FYP Demo

**Live Demo Script:**

```bash
# 1. Show you're a registered contributor
npx hardhat run scripts/checkContributor.js --network arbitrumSepolia

# 2. Generate anonymous proof (10-30s demo)
node scripts/zkp/generate-zk-proof.js <your-address> 99999

# 3. Submit anonymously
node scripts/zkp/submit-with-proof.js

# 4. Show on-chain result - NO address visible!
npx hardhat run scripts/readBatches.js --network arbitrumSepolia

# 5. Try replay attack (should fail)
node scripts/zkp/submit-with-proof.js proof-<timestamp>.json
# ❌ Reverts with "CommitmentAlreadyUsed"
```

**Key Demo Points:**
- ✅ Proof generation is CPU-intensive (shows real cryptography)
- ✅ No address visible on blockchain
- ✅ Replay protection works
- ✅ Gas cost is higher but privacy is maximum

---

## 📚 Learn More

- [ZK_IMPLEMENTATION.md](../../ZK_IMPLEMENTATION.md) - Complete documentation
- [circuits/README.md](../../circuits/README.md) - Circuit design details
- [Groth16 Paper](https://eprint.iacr.org/2016/260) - Original protocol
- [SnarkJS Docs](https://github.com/iden3/snarkjs) - Proof generation library

---

**Status:** ✅ Ready for production  
**Security:** 🔒 128-bit computational soundness  
**Privacy:** 🎭 TRUE zero-knowledge (cryptographic, not statistical)
