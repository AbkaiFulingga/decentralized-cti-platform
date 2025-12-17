# Decentralized Cyber Threat Intelligence (CTI) Sharing Platform

## What is this project?

This is a blockchain-based platform that allows cybersecurity researchers and organizations to share threat intelligence (like malicious IP addresses, malware hashes, and suspicious domains) in a **privacy-preserving** and **trustless** way. Think of it as a collaborative database of cyber threats, but without a central authority controlling who can contribute or view the data.

## The Problem We're Solving

Traditional threat intelligence sharing has several issues:

1. **Centralization Risk** - One company controls the data and can censor contributions
2. **No Contributor Privacy** - Everyone knows who submitted which threat indicators
3. **Trust Issues** - Hard to verify if submissions are legitimate without revealing the contributor
4. **No Incentives** - Contributors don't get rewarded for quality submissions
5. **Data Manipulation** - Centralized databases can be altered without detection

## Our Solution

We built a system that uses:
- **Ethereum Smart Contracts** (on Arbitrum Layer 2) for trustless data management
- **IPFS** for decentralized storage of threat data
- **Zero-Knowledge Proofs** for anonymous yet verified submissions
- **Merkle Trees** for efficient cryptographic proofs
- **Staking Mechanism** for spam prevention and quality control

---

## Key Components Explained

### 1. Smart Contracts (The Rules Engine)

We have several smart contracts working together:

#### **PrivacyPreservingRegistry.sol** - Main IOC Registry
This is the core contract that stores all threat intelligence submissions.

**Why we built it:**
- Stores references to IPFS data (not the actual data, which would be expensive)
- Enforces a **tiered staking system** to prevent spam:
  - **Basic Tier**: 0.01 ETH stake → +7 reputation per accepted batch
  - **Standard Tier**: 0.05 ETH → +10 reputation
  - **Premium Tier**: 0.1 ETH → +15 reputation
- Tracks contributor reputation (like Reddit karma, but for threat intelligence)
- Supports both **public** and **anonymous** submissions

**How it works:**
1. Contributors register by staking ETH
2. They submit batches of IOCs (Indicators of Compromise) with an IPFS hash
3. A governance system (2-of-3 multi-sig) approves quality submissions
4. Accepted submissions increase contributor reputation
5. Bad actors lose their stake if they spam

#### **MerkleZKRegistry.sol** - Anonymous Submission Handler
This contract enables contributors to submit threat intelligence **without revealing their identity**.

**Why we need it:**
- Some organizations can't publicly admit they were hacked
- Researchers may want to share data from sensitive sources
- Prevents targeting of specific contributors by attackers

**How it works:**
- Maintains a **Merkle tree** of all registered contributors
- Contributors prove they're in the tree without revealing which leaf they are
- Uses cryptographic commitments to prevent reuse attacks

#### **ThresholdGovernance.sol** - Decentralized Approval System
Prevents one person from controlling what gets approved.

**Why 2-of-3 multi-signature:**
- Requires 2 out of 3 admins to approve a batch
- Prevents single admin corruption
- Allows for dispute resolution
- Enables emergency response if one admin is compromised

#### **OracleIOCFeed.sol** - Automated Threat Feed Integration
Automatically imports threat data from external sources like AbuseIPDB.

**Why automation matters:**
- Keeps the database fresh with latest threats
- Reduces manual submission burden
- Cross-validates data from multiple sources

### 2. Merkle Trees (The Efficiency Magic)

**What's a Merkle tree?**
Think of it like a family tree, but for data. Instead of storing all 100 contributor addresses on-chain (expensive!), we:
1. Hash each address
2. Combine pairs of hashes repeatedly until we get one **root hash**
3. Store only this single root hash on-chain (cheap!)

**Example with 4 contributors:**
```
         Root Hash (0xabc...)
              /\
             /  \
        Hash1   Hash2
         /\      /\
        A  B    C  D
    (contributors)
```

**Why we use Merkle trees:**
- **Gas Efficiency**: Storing 100 addresses on-chain = ~$50 in gas fees. Storing 1 root hash = $0.50
- **Privacy**: The root hash doesn't reveal individual contributors
- **Proof Generation**: You can prove you're in the tree by providing a path (proof) of ~7 hashes, not all 100 addresses
- **Easy Updates**: When contributors join, we rebuild the tree offline and update just the root

**In our system:**
- We have 100 contributors in the anonymity set (your address + 99 test addresses)
- This gives you **1% identifiability** instead of 100% if you submitted publicly
- Tree depth = 20 levels (supports up to 2^20 = 1 million contributors)
- Uses **keccak256** for address hashing (Ethereum standard)

### 3. Poseidon Hash Function (The zkSNARK Secret Sauce)

**What's Poseidon?**
A special hash function designed for **zero-knowledge circuits**. Unlike SHA-256 or keccak256, Poseidon is optimized for use inside zkSNARKs.

**Why not use regular keccak256 everywhere?**
- **keccak256** (Ethereum's standard): Great on-chain, terrible in zkSNARKs (too complex)
- **Poseidon**: Specifically designed for zkSNARK circuits (10-100x more efficient)

**Where we use Poseidon:**
- **Building the internal Merkle tree structure**: After hashing addresses with keccak256, we use Poseidon to combine them into parent nodes
- **Inside zkSNARK circuits**: When generating proofs that you're in the tree

**Why the two-stage approach?**
```
Stage 1: Address → keccak256 → Leaf hash
         (Compatible with Ethereum)

Stage 2: Leaf hashes → Poseidon → Internal nodes → Root
         (Efficient for zkSNARKs)
```

This hybrid approach gives us:
- Ethereum compatibility (can verify addresses on-chain)
- zkSNARK efficiency (proofs generate in seconds, not hours)

### 4. Powers of Tau (The Trusted Setup Ceremony)

**What's a "trusted setup"?**
zkSNARKs need some initial random numbers to generate and verify proofs. These numbers MUST be destroyed after creation, or someone could forge proofs.

**Powers of Tau** is a multi-party ceremony where:
1. Person A generates random numbers and computes special values
2. Person A destroys their randomness
3. Person B takes those values, adds MORE randomness
4. Person B destroys their randomness
5. Repeat with thousands of participants...

**Key insight:** As long as **just ONE person** destroys their randomness, the whole system is secure.

**Why we use Powers of Tau:**
- Our project uses the **Perpetual Powers of Tau** ceremony (Hermez/zkSync version)
- Over 100 participants contributed randomness
- We trust that at least 1 of those 100 people was honest
- Downloaded from: `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau`

**What we got from it:**
- File: `powersOfTau28_hez_final_21.ptau` (2^21 constraints, supports up to 2 million gates in our circuit)
- This file is used to generate:
  - **Proving key** (`contributor_proof_final.zkey`) - for creating proofs
  - **Verification key** - embedded in our smart contract

**Our ceremony steps:**
```bash
# 1. Download Powers of Tau (trusted setup)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau

# 2. Compile our circuit
circom contributor-proof-v2.circom --r1cs --wasm --sym

# 3. Generate initial proving key
snarkjs groth16 setup contributor-proof-v2.r1cs powersOfTau28_hez_final_21.ptau contributor_0000.zkey

# 4. Contribute our own randomness (Phase 2)
snarkjs zkey contribute contributor_0000.zkey contributor_final.zkey

# 5. Export verification key for smart contract
snarkjs zkey export verificationkey contributor_final.zkey verification_key.json
```

### 5. zkSNARKs (Zero-Knowledge Proofs)

**What we prove:**
"I am a registered contributor in the Merkle tree, but I won't tell you which one I am."

**Our circuit (`contributor-proof-v2.circom`):**
```circom
// Inputs (private - hidden from everyone)
signal input address;           // Your Ethereum address
signal input nonce;             // Random number (prevents replay attacks)
signal input merkleProof[20];   // Your path in the tree

// Inputs (public - visible on-chain)
signal input merkleRoot;        // The tree root everyone trusts
signal input commitment;        // Hash of your address + nonce

// Verification steps:
1. Check that Poseidon(address, nonce) = commitment
2. Check that Merkle proof is valid for your address
3. Check that proof leads to the merkleRoot
```

**Why this works:**
- You generate a proof on your computer (takes ~5 seconds)
- Anyone can verify the proof on-chain (costs ~$0.20 in gas)
- The proof is only 3 points on an elliptic curve (~384 bytes)
- No one learns your address, only that you're in the set of 100

**Groth16 vs other proof systems:**
- **Groth16**: What we use - smallest proofs, fast verification
- **PLONK**: Newer, no trusted setup needed, but larger proofs
- **STARKs**: No trusted setup, but huge proofs (100KB+)

We chose Groth16 because:
- Gas costs are lowest (~100K gas per verification)
- Trusted setup is acceptable (Powers of Tau is reputable)
- Widely supported (snarkjs, circom, Solidity verifiers)

---

## Data Flow: How It All Works Together

### Public Submission Flow
```
1. Contributor registers with 0.05 ETH stake
2. Collects IOCs: ['192.168.1.1', 'malware.exe hash', 'evil.com']
3. Converts to STIX 2.1 format (standard threat intel format)
4. Uploads to IPFS via Pinata → Gets CID: QmXyz...
5. Builds Merkle tree of IOC hashes
6. Calls registry.addBatch(CID, merkleRoot, isPublic=true)
7. Governance admins review and approve
8. Contributor gains +10 reputation
```

### Anonymous Submission Flow
```
1. Frontend loads contributor Merkle tree (100 contributors)
2. User clicks "Submit Anonymously"
3. JavaScript generates zkSNARK proof:
   - Input: user's address, random nonce, Merkle proof
   - Output: Groth16 proof (384 bytes)
4. Frontend calls MerkleZKRegistry.submitAnonymous(CID, proof, commitment)
5. Smart contract verifies proof on-chain
6. If valid, forwards to main registry
7. Batch gets approved without revealing submitter
8. Reputation still increases (tracked by commitment, not address)
```

### Why the Merkle Root Needs to Be On-Chain

**The Problem:**
- Your frontend generates a proof using a local Merkle tree
- Smart contract verifies against an on-chain Merkle root
- If they don't match → proof fails!

**Current Status:**
- Local tree root: `0x170bfd99a01767b8f20808e8aeea20364f82b3c6ac011bb1d8e754e11ee96343`
- On-chain root: (needs to be updated)

**Fix:**
```bash
npx hardhat run scripts/update-merkle-root-onchain.js --network arbitrumSepolia
```

This syncs the tree root from your local file to the smart contract.

---

## Technology Stack

### Blockchain Layer
- **Network**: Arbitrum Sepolia (Layer 2 - cheaper than Ethereum mainnet)
- **Smart Contracts**: Solidity 0.8.20
- **Framework**: Hardhat
- **Libraries**: OpenZeppelin (battle-tested security)

### Cryptography
- **Hash Functions**: 
  - keccak256 (Ethereum standard, for addresses)
  - Poseidon (zkSNARK-friendly, for tree internals)
- **zkSNARK System**: Groth16
- **Circuit Compiler**: circom 2.x
- **Proof Generator**: snarkjs
- **Trusted Setup**: Hermez Powers of Tau (2^21 constraints)

### Storage
- **On-Chain**: Smart contract state (roots, reputation, approvals)
- **Off-Chain**: IPFS via Pinata (IOC data, STIX bundles)
- **Local**: Merkle tree files (regenerated daily)

### Frontend
- **Framework**: Next.js 15.5.4 (React-based)
- **Web3**: ethers.js v6 (blockchain interaction)
- **Wallet**: MetaMask integration
- **Styling**: Tailwind CSS

### Backend Scripts
- **Language**: JavaScript (Node.js)
- **Scheduler**: PM2 with cron (oracle service runs every 24h)
- **APIs**: 
  - Pinata (IPFS uploads)
  - AbuseIPDB (threat feed)

---

## Security Considerations

### Replay Attack Prevention
**Problem**: Someone copies your zkSNARK proof and resubmits it.

**Solution**: 
- Each proof includes a unique `commitment = Poseidon(address, nonce)`
- Contract tracks `usedCommitments` mapping
- Second submission with same commitment gets rejected

### Sybil Attack Prevention
**Problem**: One person creates 100 addresses to control the anonymity set.

**Solution**:
- Staking requirement (0.01-0.1 ETH per contributor)
- Makes creating fake contributors expensive
- Governance can slash malicious actors

### Front-Running Protection
**Problem**: Miner sees your transaction and submits the same data first.

**Solution**:
- Commitment-reveal scheme (could be added)
- Currently: IPFS CID acts as content hash (can't frontrun unique data)

### Smart Contract Security
- OpenZeppelin contracts (audited standards)
- Access controls (Ownable, multi-sig governance)
- Reentrancy guards
- Input validation (zero address checks, empty data checks)

---

## Performance Metrics

### Gas Costs (Arbitrum Sepolia)
- Register contributor: ~150K gas (~$0.30)
- Submit public batch: ~200K gas (~$0.40)
- Submit anonymous batch: ~350K gas (~$0.70) - includes zkSNARK verification
- Approve batch (governance): ~100K gas (~$0.20)

### Proof Generation
- Circuit constraints: ~50K
- Proving time: 3-5 seconds (browser)
- Proof size: 384 bytes (3 G1 points + 1 G2 point)
- Verification time: <1 second on-chain

### Scalability
- Current: 100 contributors in anonymity set
- Max: 2^20 = 1,048,576 contributors (limited by tree depth)
- IPFS: Unlimited storage (decentralized)
- Arbitrum L2: ~4000 TPS (vs Ethereum's 15 TPS)

---

## Why Each Design Choice Matters

### Why Arbitrum Instead of Ethereum Mainnet?
- **Cost**: Ethereum gas = $50/transaction, Arbitrum = $0.50
- **Speed**: 2-second block times vs 12 seconds
- **Security**: Inherits Ethereum L1 security through optimistic rollups

### Why IPFS Instead of On-Chain Storage?
- **Cost**: Storing 1KB on-chain = ~$20, IPFS = $0.01
- **Censorship Resistance**: Data lives on multiple nodes
- **Immutability**: Content-addressed (hash = filename)

### Why Multi-Sig Governance Instead of Full DAO?
- **Speed**: 2-of-3 can approve in minutes vs days of voting
- **Quality Control**: Human review catches sophisticated attacks
- **Future-Proof**: Can upgrade to full DAO later

### Why Groth16 Instead of STARKs?
- **Gas Costs**: Groth16 = ~100K gas, STARKs = ~500K gas
- **Proof Size**: Groth16 = 384 bytes, STARKs = 100KB
- **Maturity**: Groth16 is battle-tested (ZCash since 2016)

---

## Future Improvements

### Planned Features
1. **On-Chain Reputation NFTs** - Contributors get SBTs (Soulbound Tokens)
2. **Automated Tree Updates** - Cron job updates Merkle root daily
3. **Batch Verification** - Verify multiple proofs in one transaction
4. **Cross-Chain Bridge** - Share IOCs across multiple L2s
5. **AI Deduplication** - Filter duplicate submissions automatically

### Research Ideas
1. **Recursive SNARKs** - Prove you're in multiple trees at once
2. **PLONK Migration** - Remove trusted setup requirement
3. **Homomorphic Encryption** - Compute over encrypted IOCs
4. **Threshold Signatures** - Decentralize governance further

---

## How to Use This Project

### For Contributors
1. Connect MetaMask to Arbitrum Sepolia
2. Register with your chosen stake tier
3. Submit IOCs via the web interface
4. Choose public or anonymous mode
5. Build reputation over time

### For Consumers (Threat Intel Users)
1. Browse the dashboard for latest threats
2. Query by IOC type (IP, hash, domain)
3. Verify submissions using Merkle proofs
4. Export to STIX 2.1 format for your SIEM

### For Developers
1. Clone the repository
2. Deploy contracts to testnet
3. Run the oracle service
4. Customize the frontend
5. Integrate with your threat intel pipeline

---

## Conclusion

This project demonstrates how blockchain, cryptography, and decentralized storage can solve real-world problems in cybersecurity. By combining:

- **Merkle trees** for efficiency
- **Poseidon hashing** for zkSNARK optimization  
- **Powers of Tau** for trusted setup
- **Groth16 proofs** for anonymity
- **IPFS** for decentralized storage
- **Smart contracts** for trustless coordination

We created a system where anyone can contribute threat intelligence without fear of censorship or retaliation, while maintaining high data quality through economic incentives and cryptographic verification.

**The result?** A decentralized, privacy-preserving, verifiable threat intelligence network that no single entity controls.

---

## Learn More

- **Merkle Trees**: https://en.wikipedia.org/wiki/Merkle_tree
- **zkSNARKs**: https://z.cash/technology/zksnarks/
- **Poseidon Hash**: https://www.poseidon-hash.info/
- **Powers of Tau**: https://github.com/iden3/snarkjs#7-prepare-phase-2
- **Groth16**: https://eprint.iacr.org/2016/260.pdf
- **STIX Format**: https://oasis-open.github.io/cti-documentation/
- **Arbitrum**: https://arbitrum.io/

**Project Repository**: https://github.com/AbkaiFulingga/decentralized-cti-platform

---

*Last Updated: December 17, 2025*
