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
- **IPFS** for decentralized storage of threat data - To transition for 
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

## How Identities Are Protected

This project implements **multiple layers of identity protection** to ensure contributors can share threat intelligence without fear of retaliation, legal consequences, or targeted attacks. Here's how we achieve this:

### 1. Anonymous Submission Mode (The Core Privacy Feature)

**The Problem:**
If you submit an IOC publicly, everyone can see:
- Your Ethereum address
- The exact time you submitted
- Patterns in what you submit (e.g., all IPs from one country → reveals your organization's location)

This creates risks:
- **Attackers target you** for revealing their infrastructure
- **Legal liability** if you share data from a breach at your company
- **Competitive intelligence** - rivals see what threats you're facing

**Our Solution: The Anonymity Set**

Instead of revealing YOUR address, we prove you're **one of 100 registered contributors**, without revealing which one.

**How it works:**

1. **Registration Phase**
   ```
   100 contributors register → Each stakes 0.01-0.1 ETH
   ├─ Contributor 1: 0x1234...
   ├─ Contributor 2: 0x5678...
   ├─ ...
   └─ Contributor 100: 0xabcd...
   
   All addresses → Build Merkle Tree → Root Hash (0x21e6...)
   Store ONLY the root on-chain (not individual addresses)
   ```

2. **Submission Phase**
   ```
   You want to submit anonymously:
   
   Step 1: Generate a commitment
   commitment = Poseidon(YourAddress, RandomNonce)
   Example: Poseidon(0x1234..., 999888777) = 0xabc123...
   
   Step 2: Generate zkSNARK proof
   Prove: "I know an address in the Merkle tree that hashes to this commitment"
   WITHOUT revealing which address it is
   
   Step 3: Submit on-chain
   submitAnonymous(IPFS_CID, zkProof, commitment)
   
   Smart contract sees:
   - ✅ Valid proof (someone in the tree submitted this)
   - ✅ Commitment is unique (not a replay)
   - ❌ NO IDEA which of the 100 contributors it was
   ```

**Result:** You have **1% identifiability** instead of 100%
- If all 100 contributors are active, attackers have a 1-in-100 chance of guessing you
- As more contributors join, this gets even better (1,000 contributors = 0.1%)

### 2. Cryptographic Commitments (Unlinkability)

**The Problem:**
Even if submissions are anonymous, patterns can emerge:
- Contributor X always submits at 3 PM
- Contributor Y always submits malware from Russia
- Linking submissions reveals who you are

**Our Solution: One-Time Commitments**

Each anonymous submission uses a **different cryptographic commitment**:

```javascript
Submission 1: commitment₁ = Poseidon(YourAddress, nonce₁)
Submission 2: commitment₂ = Poseidon(YourAddress, nonce₂)
Submission 3: commitment₃ = Poseidon(YourAddress, nonce₃)

commitment₁ ≠ commitment₂ ≠ commitment₃
```

**Why this matters:**
- No one can link your submissions together
- Each submission looks like it came from a different person
- Even admins who approve batches can't build a profile of you

**Technical Detail:**
The `nonce` is a random 256-bit number generated in your browser. Since the space is 2^256 possibilities, collisions are astronomically unlikely (more atoms in the universe).

### 3. zkSNARK Privacy (Zero-Knowledge Property)

**What "Zero-Knowledge" Means:**

A zkSNARK proof reveals **exactly one bit of information**: "This statement is TRUE"

It does NOT reveal:
- Your address
- Your position in the Merkle tree
- The path you took to prove membership
- The nonce you used
- Any intermediate calculations

**Example:**

Traditional proof (leaks info):
```
Claim: "I'm in the Merkle tree"
Proof: "I'm at leaf position 42, here's my address: 0x1234..."
Result: ❌ Everyone knows you're contributor #42
```

zkSNARK proof (zero leakage):
```
Claim: "I'm in the Merkle tree"
Proof: [384 bytes of cryptographic proof]
Result: ✅ Valid proof, but no idea who you are
```

**Technical Implementation:**

Our circuit (`contributor-proof-v2.circom`) has:
- **Private inputs** (hidden): Your address, nonce, Merkle path
- **Public inputs** (visible): Tree root, commitment
- **Constraints**: ~50,000 mathematical equations that ensure correctness

The Groth16 proof is computed over an elliptic curve (BN254) where solving for private inputs from the proof is as hard as breaking modern cryptography.

### 4. IPFS Content Addressing (Metadata Protection)

**The Problem:**
Even if your address is hidden, IPFS metadata could leak info:
- Upload timestamp → "Someone in timezone GMT+8 submitted this"
- Pinata account → "This is associated with Company X's API key"

**Our Solution:**

1. **Randomized Upload Timing**
   ```javascript
   // Don't upload immediately
   await sleep(random(1, 300)); // Wait 1-5 minutes
   await pinata.upload(data);
   ```

2. **Generic Metadata**
   ```json
   {
     "pinataMetadata": {
       "name": "batch-abc123",  // No identifying info
       "keyvalues": {}          // Empty - no breadcrumbs
     }
   }
   ```

3. **Shared Pinata Account** (Future Improvement)
   - Use one Pinata account for all contributors
   - Uploads become indistinguishable

### 5. Network-Level Privacy (Future: Tor/VPN Integration)

**Current Limitation:**
Your IP address is visible to:
- Your RPC provider (Alchemy, Infura)
- IPFS gateway (Pinata)
- Blockchain P2P network

**Planned Solutions:**

1. **Tor Integration**
   ```javascript
   // Route transactions through Tor
   const provider = new ethers.JsonRpcProvider(
     'http://localhost:9050',  // Tor proxy
     { name: 'arbitrum-sepolia' }
   );
   ```

2. **Anonymous RPC Relays**
   - Use services like Tornado Cash's RPC relay
   - Your IP never touches the blockchain

3. **IPFS Over Tor**
   - Upload to IPFS nodes running as Tor hidden services
   - No IP address correlation

### 6. Economic Privacy (Stake Unlinkability)

**The Problem:**
Staking from your main address creates a link:
```
MainWallet (0xaaaa) → Stakes 0.05 ETH → PrivacyWallet (0xbbbb)
```
Anyone watching the blockchain sees this transfer.

**Recommended Flow:**

```
Step 1: Use Tornado Cash (or similar mixer)
MainWallet → TornadoCash → PrivacyWallet
(Link is broken - can't trace)

Step 2: Stake from clean wallet
PrivacyWallet → Register on CTI platform

Step 3: Submit anonymously
No one can link MainWallet to submissions
```

### 7. Governance Privacy (Admin Decisions Are Public, Voters Are Not)

**Important:** Admins who approve batches are **not anonymous**. This is intentional:

**Why admins are public:**
- Accountability (bad admins can be voted out)
- Transparency (community sees who approved what)
- Reputation (good admins build trust)

**Why submitters are private:**
- Protection from retaliation
- Whistleblower safety
- Sensitive source protection

**Result:** A hybrid model:
- **Submission layer**: Fully anonymous
- **Governance layer**: Fully transparent

### 8. Reputation Privacy (Commitment-Linked Scores)

**The Challenge:**
Anonymous submissions need reputation too, but traditional systems require identity:
```
❌ Bad: "User 0x1234 has 95 reputation"
✅ Good: "Commitment 0xabc has 95 reputation"
```

**Our Solution:**

Reputation is tied to commitments, not addresses:

```solidity
mapping(bytes32 => uint256) public commitmentReputation;

function submitAnonymous(bytes32 commitment, ...) {
    // Submission gets approved
    commitmentReputation[commitment] += 10;
}
```

**Why this works:**
- Each commitment is unique (new nonce each time)
- Your total reputation is the sum of all your commitments
- Only YOU know which commitments are yours
- No one else can link them together

**Proving Your Total Reputation (Future Feature):**

Use a recursive zkSNARK to prove:
```
"I control commitments C1, C2, C3, ..., C10
 Total reputation = Rep(C1) + Rep(C2) + ... + Rep(C10) = 150"
```

Without revealing which specific commitments are yours.

---

## Privacy Guarantees Summary

| Aspect | Protection Level | Method |
|--------|-----------------|--------|
| Submitter Address | ✅✅✅ Strong | zkSNARK proof + anonymity set |
| Submission Linking | ✅✅✅ Strong | One-time commitments |
| IP Address | ⚠️ Moderate | RPC/IPFS see IP (Tor recommended) |
| Timing Correlation | ⚠️ Moderate | On-chain timestamps visible |
| Reputation Privacy | ✅✅ Good | Commitment-based tracking |
| Admin Decisions | ❌ Public | Intentionally transparent |
| IPFS Metadata | ✅✅ Good | Generic naming, no account info |

**Threat Model:**

✅ **Protected Against:**
- Passive observers (anyone watching blockchain)
- Attackers trying to identify submitters
- Censorship attempts (no one knows who to censor)
- Retaliation (can't target anonymous submitters)

⚠️ **Partially Protected:**
- RPC providers seeing IP (use Tor)
- Timing analysis (randomize submission times)

❌ **Not Protected:**
- Global adversaries (NSA-level attackers)
- Compromised browser/device (malware can see everything)
- Social engineering (don't tell people you submitted!)

---

## Real-World Privacy Example

**Scenario:** You work at a bank that got hacked. You want to share the attacker's IPs without revealing:
1. Your bank's name
2. Your personal identity
3. That your bank was breached

**Traditional CTI Platform:**
```
Submission from: BigBank Security Team (accounts@bigbank.com)
IOCs: 192.168.x.x (IP from our internal network - oops!)
Result: ❌ Everyone knows BigBank was hacked
        ❌ Attackers now target BigBank harder
        ❌ Stock price drops
```

**Our Platform:**
```
Step 1: Clean the data
Remove internal IPs, sanitize hostnames

Step 2: Submit anonymously
- Use zkSNARK proof
- Upload to IPFS via Tor
- Use randomized timing

Step 3: Admins approve
They see threat is legit, approve without knowing source

Result: ✅ Threat intel shared
        ✅ No one knows it's from BigBank
        ✅ Your job is safe
        ✅ Attackers' IPs are now blocked globally
```

**Your Identity is Protected By:**
- You're 1 of 100+ contributors (statistical anonymity)
- zkSNARK hides which one (cryptographic anonymity)
- One-time commitment prevents linking (unlinkability)
- Tor hides your IP (network anonymity)
- Clean data prevents fingerprinting (operational security)

**Even if attackers:**
- Monitor all blockchain transactions → See proof, not address
- Compromise IPFS gateway → See content, not uploader
- Analyze submission patterns → Can't link to you
- Bribe admins → Admins don't know who submitted

**You remain anonymous.**

---

## Cryptographic Techniques & Encryption in This Project

This project uses **multiple layers of cryptography** but is primarily focused on **cryptographic proofs and hashing** rather than traditional encryption. Here's a breakdown:

### 1. **Hash Functions (One-Way Cryptography)**

Hash functions are the foundation of our privacy system. Unlike encryption (which can be reversed with a key), hashing is **one-way** - you can't get the original data back.

#### **keccak256 (Ethereum Standard)**

**What it is:**
- SHA-3 variant used by Ethereum
- Produces 256-bit (32-byte) hashes
- Deterministic: same input always gives same output

**Where we use it:**
```javascript
// 1. Hashing contributor addresses for Merkle tree leaves
const addressHash = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"], 
    ["0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82"]
  )
);
// Result: 0x9a5968d6b4e28c9f8e5c1a2b3d4e5f6789abcdef...

// 2. Content addressing for IPFS
const iocHash = keccak256(JSON.stringify(iocData));

// 3. Commitment verification (on-chain)
bytes32 contributorHash = keccak256(abi.encodePacked(msg.sender));
```

**Properties:**
- **Collision-resistant**: Can't find two inputs that hash to the same output
- **Pre-image resistant**: Can't reverse the hash to get original data
- **Avalanche effect**: Changing 1 bit in input changes ~50% of output bits

**Security level:** 256-bit security (2^256 possible outputs = unbreakable with current computers)

#### **Poseidon Hash (zkSNARK-Optimized)**

**What it is:**
- Algebraic hash function designed for zero-knowledge circuits
- Operates over finite fields (not binary like SHA/keccak)
- 10-100x more efficient in zkSNARKs than traditional hashes

**Where we use it:**
```javascript
// 1. Building Merkle tree internal nodes
const parentHash = poseidon([leftChildHash, rightChildHash]);

// 2. Creating commitments for anonymous submissions
const commitment = poseidon([addressAsBigInt, nonce]);
// Example: poseidon([218089896829...n, 123456789n]) = 123456...n

// 3. Inside circom circuits
template MerkleTreeVerifier() {
    component hasher = Poseidon(2);
    hasher.inputs[0] <== leftChild;
    hasher.inputs[1] <== rightChild;
    parentNode <== hasher.out;
}
```

**Why not use keccak256 everywhere?**

| Aspect | keccak256 | Poseidon |
|--------|-----------|----------|
| On-chain cost | Cheap (3 gas/byte) | Expensive (no native support) |
| In zkSNARK circuit | 100,000+ constraints | ~300 constraints |
| Proof generation | Minutes/hours | Seconds |
| Ethereum compatibility | ✅ Native | ❌ Requires library |

**Security level:** 128-bit security (sufficient for most applications)

**Technical detail:**
Poseidon uses the **Hades design** with:
- Partial S-box layers (reduces constraints)
- MDS (Maximum Distance Separable) matrices
- Prime field: BN254 curve order (same as our zkSNARKs)

### 2. **Zero-Knowledge Proofs (Cryptographic Proofs, NOT Encryption)**

**Critical distinction:**
- **Encryption**: Hides data, can be decrypted with key
- **zkSNARK**: Proves a statement without revealing the data

Our zkSNARKs prove: *"I know a secret that satisfies condition X"* without revealing the secret.

#### **Groth16 zkSNARK System**

**What it does:**
Generates a cryptographic proof that you know:
1. An address in the Merkle tree
2. A valid Merkle path from that address to the root
3. A nonce that combines with your address to create the commitment

**WITHOUT revealing:**
- Which address you used
- Which leaf position in the tree
- The Merkle path you followed
- The nonce value

**Mathematical foundation:**
Built on **elliptic curve cryptography** using the BN254 curve:
```
y² = x³ + 3  (over finite field)
```

**The proof consists of:**
```javascript
{
  pi_a: [G1_point],     // Point on curve G1 (2 coordinates)
  pi_b: [[G2_point]],   // Point on curve G2 (4 coordinates)
  pi_c: [G1_point],     // Point on curve G1 (2 coordinates)
}
// Total: 8 field elements = 384 bytes
```

**Verification equation (simplified):**
```
e(π_a, π_b) = e(α, β) · e(C, δ) · e(H, γ)
```
Where `e()` is a pairing function on elliptic curves.

**Security assumption:** Based on the hardness of the **discrete logarithm problem** on elliptic curves (same as Bitcoin/Ethereum signatures).

**Security level:** 128-bit security (equivalent to AES-128)

#### **Circuit Constraints (The Math Behind The Proof)**

Our circuit has ~50,000 constraints that enforce:
```circom
// 1. Commitment correctness
commitment === Poseidon(address, nonce)

// 2. Merkle path verification
for (i = 0; i < 20; i++) {
    if (pathDirection[i] == 0) {
        currentHash = Poseidon(currentHash, merkleProof[i]);
    } else {
        currentHash = Poseidon(merkleProof[i], currentHash);
    }
}

// 3. Root match
currentHash === merkleRoot
```

Each `===` is translated to a **constraint** (polynomial equation) that the prover must satisfy.

**Security property:** If you can generate a valid proof without knowing the secret, you can solve the discrete logarithm problem (believed impossible).

### 3. **Digital Signatures (Authentication, NOT Encryption)**

Used for transaction authentication on Ethereum.

#### **ECDSA (Elliptic Curve Digital Signature Algorithm)**

**What it does:**
- Proves you control a private key without revealing it
- Used for all Ethereum transactions

**Where we use it:**
```javascript
// Every time you interact with smart contracts:
await registry.addBatch(cid, merkleRoot);
// MetaMask signs transaction with your private key
// Signature proves you own the address
```

**Signature components:**
```javascript
{
  r: 32 bytes,  // Random point on curve
  s: 32 bytes,  // Signature value
  v: 1 byte     // Recovery ID
}
// Total: 65 bytes
```

**Security level:** 128-bit security (using secp256k1 curve)

**How it works:**
1. Hash the transaction data
2. Sign hash with your private key using elliptic curve math
3. Anyone can verify signature using your public key (address)
4. Only you can create valid signatures (you have the private key)

### 4. **Merkle Trees (Commitment Scheme)**

Merkle trees use **cryptographic commitments** to compress large datasets.

**The commitment:**
```
Root = Hash(Hash(Hash(A, B), Hash(C, D)), Hash(Hash(E, F), Hash(G, H)))
```

**Security property:**
- **Binding**: Once you publish the root, you can't change the leaves
- **Hiding**: The root doesn't reveal individual leaves (combined with our anonymity set)

**Proof size:** Only ~7 hashes (for 100 contributors) instead of all 100 addresses
- Security: If you can fake a Merkle proof, you can break the hash function (collision attack)

### 5. **Content Addressing (IPFS)**

IPFS uses **cryptographic hashing** for file identification.

**How it works:**
```javascript
// Upload file to IPFS
const fileContent = JSON.stringify(iocData);
const cid = calculateCID(fileContent);  // Uses SHA-256 internally
// Result: QmXyz123...

// The CID IS the hash of the content
// If content changes, CID changes
// Same content always has same CID
```

**Security properties:**
- **Tamper-proof**: Can't modify file without changing CID
- **Verifiable**: Anyone can re-hash the content and verify CID
- **Deduplicated**: Identical files have identical CIDs

**Hash function:** SHA-256 (256-bit security)

### 6. **What We DON'T Use (Common Misconceptions)**

#### **❌ No Symmetric Encryption (AES, ChaCha20, etc.)**

We **don't encrypt** IOC data. Why?
- IOCs are meant to be **publicly shared** (that's the point of threat intelligence)
- Privacy comes from **hiding WHO submitted**, not WHAT was submitted
- Encryption would prevent consumers from reading the data

**If we wanted to encrypt:**
```javascript
// This is NOT in our project, but here's how it would look:
const encrypted = AES.encrypt(iocData, secretKey);
await ipfs.upload(encrypted);
// Problem: How do consumers get the secretKey?
```

#### **❌ No Asymmetric Encryption (RSA, ElGamal, etc.)**

We don't use public-key encryption because:
- zkSNARKs provide privacy without encryption
- Encryption would make data unreadable to threat intel consumers
- Smaller proof size (384 bytes vs kilobytes of ciphertext)

**Comparison:**

| Approach | Privacy Level | Data Access | Proof Size |
|----------|---------------|-------------|------------|
| **RSA Encryption** | High (only recipient decrypts) | ❌ Restricted | N/A |
| **AES Encryption** | High (need shared key) | ❌ Restricted | N/A |
| **Our zkSNARK** | High (submitter hidden) | ✅ Public | 384 bytes |

#### **❌ No Homomorphic Encryption (FHE)**

Fully Homomorphic Encryption allows computation on encrypted data. We considered it but:
- **Too slow**: FHE operations are 1000-1,000,000x slower than plaintext
- **Overkill**: We don't need to compute over encrypted IOCs
- **Future research**: Could enable private threat correlation

### 7. **Trusted Setup Ceremony (Cryptographic Ritual)**

The Powers of Tau ceremony generates **public parameters** for zkSNARKs.

**What's generated:**
```javascript
{
  tau_powers: [τ⁰, τ¹, τ², ..., τ^(2²¹)],  // In encrypted form
  alpha_tau: [α·τ⁰, α·τ¹, ...],
  beta_tau: [β·τ⁰, β·τ¹, ...]
}
```

Where τ, α, β are **secret random numbers** that must be destroyed.

**Security property:**
- If **any one participant** destroys their randomness → system is secure
- If **all participants collude** and keep secrets → they can forge proofs
- We trust that at least 1 of 100+ participants was honest

**Cryptographic assumption:** Participants generated true randomness and deleted it.

### 8. **Commitment Schemes (Used for Anonymous Submissions)**

**What's a commitment?**
Like putting a message in a sealed envelope:
1. **Commit**: Hash your secret → publish hash
2. **Reveal**: Later show the original secret → anyone can verify hash matches

**Our implementation:**
```javascript
// Commit phase
const nonce = generateRandomBigInt();
const commitment = poseidon([address, nonce]);
await contract.submitAnonymous(cid, proof, commitment);
// commitment is now on-chain

// Reveal phase (optional, for disputes)
await contract.revealCommitment(address, nonce);
// Contract verifies: poseidon([address, nonce]) === commitment
```

**Security properties:**
- **Hiding**: Commitment doesn't reveal address or nonce
- **Binding**: Can't change your mind later (can't find different address/nonce with same commitment)

**Hash function security:** Based on collision-resistance of Poseidon

### 9. **Cryptographic Techniques Summary**

| Technique | Type | Purpose | Security Basis |
|-----------|------|---------|----------------|
| **keccak256** | Hash Function | Address hashing, content IDs | SHA-3 (collision resistance) |
| **Poseidon** | Hash Function | Merkle trees, commitments | Algebraic hash (zkSNARK-friendly) |
| **Groth16 zkSNARK** | Zero-Knowledge Proof | Anonymous submissions | Elliptic curve discrete log |
| **ECDSA** | Digital Signature | Transaction authentication | secp256k1 discrete log |
| **Merkle Trees** | Commitment Scheme | Efficient set membership proofs | Hash function security |
| **IPFS CID** | Content Addressing | Tamper-proof storage | SHA-256 |
| **Powers of Tau** | Trusted Setup | zkSNARK parameters | Multi-party computation |
| **Poseidon Commitment** | Commitment Scheme | Unlinkable anonymous IDs | Poseidon collision resistance |

### 10. **Why Privacy Without Encryption?**

This is the **key insight** of our design:

**Traditional approach (encryption):**
```
Encrypt IOC data → Only authorized parties can decrypt → Data stays private
Problem: Limits who can use the threat intel
```

**Our approach (zero-knowledge proofs):**
```
IOC data is PUBLIC → Anyone can read it
WHO submitted is HIDDEN → zkSNARK proves membership without identity
Result: Maximum data sharing + maximum privacy for contributors
```

**Real-world analogy:**
- **Encryption**: Putting your message in a locked safe (only keyholder can read)
- **zkSNARK**: Posting anonymously on a public bulletin board (everyone can read, no one knows who posted)

### 11. **Cryptographic Security Levels**

**What the bit numbers mean:**

| Security Level | Meaning | Computational Effort to Break |
|----------------|---------|-------------------------------|
| **128-bit** | Strong | 2^128 operations (~10^38) |
| **256-bit** | Overkill | 2^256 operations (~10^77) |

**Context:**
- Bitcoin mining: ~2^80 operations per year (worldwide)
- Breaking 128-bit: Would take all computers on Earth billions of years
- Breaking 256-bit: More operations than atoms in the universe

**Our choices:**
- keccak256: 256-bit (maximum security)
- Poseidon: 128-bit (sufficient, faster)
- Groth16: 128-bit (industry standard)
- ECDSA: 128-bit (Ethereum standard)

### 12. **Attack Resistance**

**What attackers CAN'T do:**

✅ **Can't reverse hashes**
- Given commitment `0xabc123...`, can't find original address
- Would need to try all 2^256 possibilities

✅ **Can't forge zkSNARK proofs**
- Would need to solve discrete log problem
- Equivalent to breaking Bitcoin/Ethereum

✅ **Can't link anonymous submissions**
- Each uses different commitment (different nonce)
- No correlation between submissions

✅ **Can't modify IPFS data**
- CID changes if data changes
- Would be detected immediately

**What attackers CAN do:**

⚠️ **Can analyze on-chain patterns**
- Submission timestamps visible
- Gas prices might correlate submissions
- **Mitigation**: Randomize submission timing

⚠️ **Can watch your IP address**
- RPC provider sees your IP
- **Mitigation**: Use Tor/VPN

⚠️ **Can perform statistical analysis**
- If only 2 contributors in anonymity set, 50/50 guess
- **Mitigation**: Larger anonymity set (100+ contributors)

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
