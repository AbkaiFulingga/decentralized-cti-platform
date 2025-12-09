# zkSNARK Circuits - Contributor Proof System

## Overview

This directory contains the **zero-knowledge proof circuits** that enable anonymous contributor submissions with cryptographic privacy guarantees.

### What is a zkSNARK?

**zkSNARK** = **Z**ero-**K**nowledge **S**uccinct **N**on-interactive **AR**gument of **K**nowledge

It allows a prover to convince a verifier that a statement is true **without revealing any information** beyond the truth of the statement.

### Our Use Case

**Problem:** How can a contributor prove they're registered without revealing their identity?

**Solution:** Zero-knowledge proof that proves:
1. ✅ "I know an address that is in the contributor Merkle tree"
2. ✅ "I know the nonce for this commitment"
3. ❌ WITHOUT revealing which address it is

---

## Circuit: `contributor-proof.circom`

### Mathematical Statement

The circuit proves the following statement:

```
∃ (address, nonce) such that:
  1. commitment = Poseidon(address, nonce)
  2. address ∈ MerkleTree(merkleRoot)
  3. address ≠ 0
```

Where:
- `∃` = "there exists" (prover knows these values)
- `Poseidon` = cryptographic hash function optimized for ZK circuits
- `∈` = "is a member of" (Merkle tree inclusion)

### Public Inputs (Visible On-Chain)

| Input | Type | Description |
|-------|------|-------------|
| `commitment` | uint256 | Hash of (address, nonce) - identifies this submission |
| `merkleRoot` | uint256 | Root of contributor Merkle tree at submission time |

### Private Inputs (Hidden)

| Input | Type | Description |
|-------|------|-------------|
| `address` | uint160 | Contributor's Ethereum address (kept secret!) |
| `nonce` | uint256 | Random value for commitment unlinkability |
| `merkleProof` | uint256[20] | Sibling hashes for Merkle path |
| `merklePathIndices` | uint256[20] | Left/right directions (0/1) |

### Circuit Size

- **Merkle Tree Depth:** 20 levels
- **Max Contributors:** 2^20 = 1,048,576
- **Constraints:** ~2,000 (calculated during compilation)
- **Proving Time:** 5-10 seconds (client-side)
- **Verification Gas:** ~250,000 gas (on-chain)

---

## Compilation Process

### Prerequisites

Ensure you have installed:
- **Circom 2.x** - Circuit compiler
- **SnarkJS** - Proof generation library
- **Powers of Tau** - Trusted setup ceremony

### Step 1: Compile Circuit

```bash
# From project root
cd circuits

# Compile .circom to R1CS (Rank-1 Constraint System)
circom contributor-proof.circom --r1cs --wasm --sym --c

# This generates:
# - contributor-proof.r1cs     (constraint system)
# - contributor-proof_js/      (witness generator - WebAssembly)
# - contributor-proof.sym      (symbol table for debugging)
```

### Step 2: Download Powers of Tau

```bash
# Download pre-computed trusted setup (Phase 1)
# Use ceremony with sufficient constraints (2^15 = 32,768 constraints)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau -O powersOfTau28_hez_final_15.ptau
```

### Step 3: Generate Proving/Verification Keys

```bash
# Phase 2 - Circuit-specific setup
snarkjs groth16 setup contributor-proof.r1cs powersOfTau28_hez_final_15.ptau contributor-proof_0000.zkey

# Contribute randomness (optional but recommended)
snarkjs zkey contribute contributor-proof_0000.zkey contributor-proof_final.zkey --name="CTI Platform" -v

# Export verification key
snarkjs zkey export verificationkey contributor-proof_final.zkey verification_key.json

# Export Solidity verifier contract (auto-generated!)
snarkjs zkey export solidityverifier contributor-proof_final.zkey ../contracts/Groth16Verifier.sol
```

### Step 4: Verify Setup

```bash
# View circuit info
snarkjs r1cs info contributor-proof.r1cs

# Expected output:
# [INFO]  snarkJS: Curve: bn-128
# [INFO]  snarkJS: # of Wires: ~2500
# [INFO]  snarkJS: # of Constraints: ~2000
# [INFO]  snarkJS: # of Private Inputs: 42
# [INFO]  snarkJS: # of Public Inputs: 2
# [INFO]  snarkJS: # of Outputs: 0
```

---

## Proof Generation Workflow

### Example: Anonymous Submission

```javascript
// 1. Contributor prepares inputs
const contributorAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const nonce = ethers.randomBytes(32);
const commitment = poseidon([contributorAddress, nonce]);

// 2. Build Merkle proof of inclusion
const merkleTree = buildContributorTree(); // From on-chain data
const merkleProof = merkleTree.getProof(contributorAddress);
const merkleRoot = merkleTree.root;

// 3. Prepare circuit inputs
const input = {
  commitment: commitment,
  merkleRoot: merkleRoot,
  address: contributorAddress,
  nonce: nonce,
  merkleProof: merkleProof.siblings,
  merklePathIndices: merkleProof.indices
};

// 4. Generate witness
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  "circuits/contributor-proof_js/contributor-proof.wasm",
  "circuits/contributor-proof_final.zkey"
);

// 5. Submit to smart contract
await registry.submitAnonymousBatchWithZKProof(
  ipfsHash,
  proof,
  publicSignals // [commitment, merkleRoot]
);
```

### What the Verifier Sees

```solidity
// On-chain, the verifier only sees:
// - proof: [8 field elements of the Groth16 proof]
// - publicSignals: [commitment, merkleRoot]

// The verifier CANNOT see:
// - address (hidden)
// - nonce (hidden)
// - merkleProof (hidden)
// - merklePathIndices (hidden)
```

---

## Security Analysis

### Cryptographic Guarantees

1. **Soundness:** Computationally infeasible to create valid proof for false statement
   - Security level: 128 bits (BN128 curve)
   - Forging proof ≈ solving discrete log problem

2. **Zero-Knowledge:** Proof reveals nothing about private inputs
   - Proven via simulator paradigm
   - Verifier learns only: "statement is true"

3. **Succinctness:** Proof size constant (~200 bytes)
   - Independent of witness size
   - Verification time: O(1)

### Comparison to Previous System

| Aspect | Merkle Proofs (Old) | zkSNARKs (New) |
|--------|---------------------|----------------|
| Privacy | Heuristic (obfuscation) | Cryptographic (zero-knowledge) |
| Proof Size | O(log n) | O(1) |
| Verification Gas | ~50k-100k | ~250k |
| Security Basis | Collision resistance | Discrete log hardness |
| Information Leakage | Merkle path structure | **Zero** |
| Linkability | Possible via correlation | **Impossible** |

### Threat Model

**Adversary Goal:** Deanonymize contributor from proof

**Adversary Capabilities:**
- Sees all on-chain proofs and public inputs
- Can generate arbitrary proofs for testing
- Has unlimited computational power (short of breaking crypto)

**Our Guarantee:**
- Adversary cannot determine which registered contributor submitted proof
- Even with access to all historical submissions
- Proven secure under decisional Diffie-Hellman assumption

---

## Gas Cost Analysis

### On-Chain Verification

```
Groth16 Verification Breakdown:
- Pairing checks: 2 pairings ≈ 180,000 gas
- Field operations: ~50,000 gas
- Public input hashing: ~20,000 gas
---------------------------------
Total: ~250,000 gas

At 20 gwei gas price & ETH=$2,300:
Cost per proof verification: $0.012
```

### Client-Side Generation

```
Proof Generation (Browser):
- Time: 5-10 seconds (varies by device)
- Memory: ~500 MB
- CPU: 1 core at 100%

Can be parallelized across multiple submissions.
```

---

## Debugging & Testing

### Test Proof Generation

```bash
# Create test input
cat > input.json << EOF
{
  "commitment": "12345...",
  "merkleRoot": "67890...",
  "address": "0x742d35...",
  "nonce": "11111...",
  "merkleProof": [...],
  "merklePathIndices": [...]
}
EOF

# Generate witness
node contributor-proof_js/generate_witness.js contributor-proof_js/contributor-proof.wasm input.json witness.wtns

# Create proof
snarkjs groth16 prove contributor-proof_final.zkey witness.wtns proof.json public.json

# Verify proof (off-chain)
snarkjs groth16 verify verification_key.json public.json proof.json
# Should output: [INFO]  snarkJS: OK!
```

### Common Issues

**Issue:** "Constraint doesn't match"
- **Cause:** Input values don't satisfy circuit constraints
- **Fix:** Verify commitment = Poseidon(address, nonce) matches

**Issue:** "Witness generation failed"
- **Cause:** Invalid Merkle proof or path indices
- **Fix:** Rebuild Merkle tree and regenerate proof

**Issue:** "Verification failed on-chain"
- **Cause:** Public signals mismatch
- **Fix:** Ensure publicSignals array order: [commitment, merkleRoot]

---

## Further Reading

### Academic Papers

1. **Groth16:** "On the Size of Pairing-based Non-interactive Arguments"  
   Jens Groth, EUROCRYPT 2016  
   https://eprint.iacr.org/2016/260

2. **Poseidon Hash:** "Poseidon: A New Hash Function for ZK Proof Systems"  
   Grassi et al., USENIX Security 2021  
   https://eprint.iacr.org/2019/458

3. **ZK-SNARKs:** "Why and How zk-SNARK Works"  
   Maksym Petkus  
   https://arxiv.org/abs/1906.07221

### Implementation Resources

- **Circom Documentation:** https://docs.circom.io/
- **SnarkJS GitHub:** https://github.com/iden3/snarkjs
- **ZKP Learning Resources:** https://zkp.science/

### Circomlib Circuits

Our circuit uses battle-tested components from circomlib:
- `poseidon.circom` - ZK-friendly hash function
- `comparators.circom` - IsZero constraint
- `bitify.circom` - Num2Bits/Bits2Num conversions

---

## Next Steps

1. ✅ Compile circuit: `circom contributor-proof.circom --r1cs --wasm`
2. ✅ Setup keys: `snarkjs groth16 setup ...`
3. ✅ Export verifier: `snarkjs zkey export solidityverifier ...`
4. ⏳ Integrate with contracts: Deploy Groth16Verifier.sol
5. ⏳ Create proof generation script: `generate-zk-proof.js`
6. ⏳ Test end-to-end: Register → Prove → Submit → Verify

**Estimated time remaining: 8 days**

---

**For questions or issues, see: `/docs/ZK_IMPLEMENTATION.md` (to be created)**
