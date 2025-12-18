# CP2 Final Technical Specification

**Document Version**: 1.0  
**Date**: 19 December 2025  
**Status**: Normative Specification for CP2 Implementation  

---

## 1) System Architecture (Normative Spec)

### 1.1 Components

**C1. Web Client (Contributor/Consumer UI)**
- MUST support wallet connection and transaction signing.
- MUST implement encryption + IPFS upload in the submission flow when confidentiality mode is used.
- SHOULD validate metadata locally before submitting to reduce on-chain reverts.

**C2. IPFS Storage Layer**
- MUST store **ciphertext only** for confidential submissions (never plaintext).
- MUST return CID for uploaded ciphertext.
- MUST have a persistence strategy: pinning via Pinata or self-hosted pinning cluster.

**C3. Key Management / Distribution Layer**
- MUST generate per-file symmetric keys (K_ioc).
- MUST NOT store K_ioc in plaintext on-chain.
- SHOULD implement key wrapping for authorized recipients (public-key wrapping or role-based group key).

**C4. Smart Contract Suite (Registry + Authorization + Governance)**
- MUST verify authorization on submission (credential signature and issuer authorization).
- MUST record minimal metadata + CID commitment (not the full CID by default) to reduce leakage.
- MUST emit structured events for indexing and monitoring.

**C5. Governance Authority**
- MUST manage issuer allowlist (e.g., via Merkle root updates).
- MUST be able to rotate roots, revoke issuers (via root update), and define role policies.

**C6. Optional Privacy Layer (CP2 Privacy Enhancement)**
- SHOULD provide integration point to replace/supplement EIP-712 credential signature with ZKP authorization (Groth16).
- SHOULD be deployed on L2 for cost feasibility.

---

## 2) Data Models (Normative Spec)

### 2.1 IOC Artifact and Metadata

**IOC artifact** may be STIX bundle, JSON, PDF, PCAP, etc.

**Metadata MUST include** at minimum:
- `iocType` (enum/int)
- `tags[]`
- `confidence` (0–100 or enum)
- `description` (bounded length)
- `createdAt` (timestamp)
- `schemaVersion`

### 2.2 On-chain Record (Minimal)

On-chain storage MUST be minimal (verification/provenance layer). Recommended fields:
- `bytes32 cidCommitment` = keccak256(CID of ciphertext)
- `bytes32 iocId` = keccak256(cidCommitment || type || timestamp || submitterBinding || randomNonce)
- `uint64 timestamp`
- `iocType, confidence, tagsHash`
- `status` (Pending/Accepted/Revoked/Flagged)
- `submitMode` (Public / Anonymous)

### 2.3 Credential Schema (EIP-712)

Credential MUST be structured and signed by an authorized issuer. Minimum fields:
- `subject`
- `role`
- `issuer`
- `issuedAt`
- `expiresAt`
- `nonce`
- `chainId + domain separator` (EIP-712)

---

## 3) Cryptography Specifications (Final CP2)

### 3.1 Hashing and Commitments

- On-chain commitments MUST use `keccak256` for Solidity compatibility.
- Merkle leaves for allowlists SHOULD use keccak256(address/role tuple).
- IPFS integrity is provided by content addressing, but you MUST NOT assume a single hash algorithm for CID; refer to "multihash CID integrity".

### 3.2 Encryption (Confidentiality Mode)

Because IPFS has no native access control, **client-side encryption before IPFS upload is REQUIRED** for confidential artifacts.

**Algorithm MUST be**: AES-256-GCM authenticated encryption.

**Per-file key MUST be**:
- `K_ioc`: 256-bit random (CSPRNG)
- Unique per artifact (no reuse across submissions)

**Nonce/IV MUST be**:
- 96-bit random nonce (recommended for GCM)

**AAD (Additional Authenticated Data) SHOULD be**:
- metadata hash (bind ciphertext to metadata to prevent substitution)

**Encryption output MUST include**:
- `ciphertext`
- `authTag` (128-bit)
- `nonce`
- `algorithmId = "AES-256-GCM"`
- `keyId = keccak256(K_ioc)` for lookup (do not expose K_ioc)

### 3.3 Key Distribution / Wrapping

K_ioc MUST NOT be published on-chain.

One of the following MUST be implemented for CP2 (pick one and document):
- **Option A (Preferred): Public-key wrapping**
  - `Wrap(PK_recipient, K_ioc)` stored off-chain (or retrievable via key service)
- **Option B: Role-based shared key (demo-scale)**
  - Allowed only with explicit limitation note
- **Option C: Per-user vault**
  - Static password protects vault, not file key

---

## 4) Storage Specifications (IPFS)

### 4.1 IPFS Upload

Submission MUST upload encrypted payload:
- `cidEnc = IPFS.add(ciphertext)`
- OPTIONAL pin: `IPFS.pin.add(cidEnc)` or Pinata pin

### 4.2 Availability

Because IPFS persistence is not guaranteed, the system MUST define:
- Who pins (governance nodes, Pinata, or dedicated pinning service)
- Replication target (e.g., ≥2 pinned replicas)
- Monitoring plan (pin status checks)

---

## 5) Smart Contract Specifications (Verification + Registry)

### 5.1 submitIOC() interface (baseline)

Contract MUST accept:
- `cidCommitment`
- metadata struct
- credential struct + signature
- issuer Merkle proof (if Merkle-based issuer verification is used)

### 5.2 Verification Logic (MUST)

On submission, contract MUST:
1. Verify EIP-712 signature recovers issuer
2. Verify issuer is authorized (Merkle proof or allowlist)
3. Verify role permissions
4. Verify temporal validity (issuedAt/expiresAt)
5. Verify replay protection (nonce uniqueness)
6. Verify duplicate submission logic (iocId uniqueness)
7. Emit an event with record identifiers

### 5.3 On-chain Privacy Defaults

- SHOULD store only CID commitment on-chain (not full CID) to reduce leakage
- SHOULD avoid storing contributor identity unless required by policy

---

## 6) ZKP Privacy Enhancement (CP2 Roadmap / Optional Implementation)

### 6.1 Target Statement

ZKP SHOULD prove:
- "I hold a valid credential issued by an authorized issuer" without revealing credential contents or address

### 6.2 ZKP Plumbing

- Off-chain proving, on-chain verification via verifier contract
- L2 deployment recommended (Arbitrum) to reduce verification gas

### 6.3 Anti-replay / Double-use in Anonymous Mode

Anonymous submissions MUST use a nullifier-like value:
- `nullifier = H(secret, scope)` stored on-chain to prevent reuse
- Avoid relying on address-based nonce in anonymous mode (address is visible on-chain otherwise)

---

## 7) Threat Controls (Minimum CP2 Security Requirements)

The system MUST address these threats:
- **Unauthorized retrieval** → encryption + key policy
- **CID leakage** → commitments on-chain
- **Spam/malicious submissions** → credential authorization + rate limit optional
- **Replay attacks** → nonces + EIP-712 domain separation
- **Issuer compromise** → root rotation + expiry
- **IPFS unavailability** → pinning strategy
- **Smart contract vulnerabilities** → audits/tests + secure patterns

---

## 8) CP2 Evaluation Metrics (What to Measure)

CP2 evaluation MUST include at minimum:
- Gas cost per submission (Sepolia vs Arbitrum)
- End-to-end latency (encrypt+upload + tx confirmation)
- Throughput under batch submissions
- If ZKP implemented: proving time, proof size, verification cost

---

## 9) "Stay-True" Alignment Notes (so examiner sees consistency)

To remain consistent with CP1/Claude:
- Do NOT drop encryption unless you explicitly change objectives/scope—CP1 assumes encryption is required due to IPFS access control limitations.
- Do NOT claim cross-chain forwarding between Sepolia and Arbitrum Sepolia unless you implement canonical bridging; treat deployments as comparative environments in CP2.
- Prefer CID commitment on-chain (privacy) and emit CID in events / off-chain index where needed.

---

## 10) Implementation Status Tracker

### CRITICAL PATH (5-Hour Sprint)

| Component | Status | Priority | Time Estimate |
|-----------|--------|----------|---------------|
| **Client-side AES-256-GCM encryption** | ❌ Not Started | P0 | 1.5 hours |
| **CID commitment (keccak256)** | ❌ Not Started | P0 | 0.5 hours |
| **EIP-712 credential schema** | ❌ Not Started | P0 | 1.5 hours |
| **Contract verification logic** | ❌ Not Started | P0 | 1.5 hours |
| **Documentation updates** | ❌ Not Started | P1 | Ongoing |

### DEFERRED (Beyond 5 Hours)

- Key wrapping implementation (Option A)
- ZKP integration (already exists, needs EIP-712 integration)
- Comprehensive testing
- Gas benchmarking

---

## 11) Compliance Matrix

| Requirement | Current State | Gap | Action |
|-------------|--------------|-----|--------|
| **C1: Wallet connection** | ✅ Implemented | None | - |
| **C1: Encryption in UI** | ❌ Missing | Critical | Implement crypto.subtle |
| **C2: Ciphertext-only IPFS** | ❌ Plaintext currently | Critical | Encrypt before upload |
| **C3: Key management** | ❌ No keys exist | Critical | Generate K_ioc |
| **C4: CID commitment** | ❌ Stores full CID | Critical | Hash CID on-chain |
| **C4: EIP-712 verification** | ❌ Standard tx only | Critical | Add EIP-712 logic |
| **C5: Merkle issuer root** | ✅ Contributor tree exists | Adapt | Reuse for issuers |
| **C6: ZKP integration** | ✅ Groth16 exists | Document | Already done |

---

**Document End**
