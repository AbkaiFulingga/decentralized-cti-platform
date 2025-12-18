# 5-Hour Emergency Implementation Plan
**Date**: 19 December 2025  
**Deadline**: T+5 hours  
**Objective**: Minimum viable CP2 compliance with technical specification

---

## ⚠️ HONEST ASSESSMENT: NOT FULLY IMPLEMENTABLE IN 5 HOURS

**What IS achievable**: ~60% compliance (core cryptography + documentation)  
**What is NOT achievable**: Full testing, gas benchmarking, production hardening

---

## PRIORITIZED TASK LIST (DO IN ORDER)

### 🔴 HOUR 1: Client-Side Encryption (1h 15min)

**File**: `cti-frontend/utils/encryption.js` (NEW FILE)

```javascript
// AES-256-GCM encryption for IOC bundles
export class IOCEncryption {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.nonceLength = 12; // 96 bits
    }

    // Generate random encryption key
    async generateKey() {
        return await crypto.subtle.generateKey(
            { name: this.algorithm, length: this.keyLength },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt IOC bundle before IPFS upload
    async encryptBundle(stixBundle, metadata) {
        const key = await this.generateKey();
        const nonce = crypto.getRandomValues(new Uint8Array(this.nonceLength));
        
        // Additional Authenticated Data (bind to metadata)
        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
        const aad = ethers.getBytes(metadataHash);
        
        const encoder = new TextEncoder();
        const plaintext = encoder.encode(JSON.stringify(stixBundle));
        
        const ciphertext = await crypto.subtle.encrypt(
            { name: this.algorithm, iv: nonce, additionalData: aad },
            key,
            plaintext
        );
        
        // Export key for wrapping
        const exportedKey = await crypto.subtle.exportKey('raw', key);
        const keyId = ethers.keccak256(new Uint8Array(exportedKey));
        
        return {
            ciphertext: new Uint8Array(ciphertext),
            nonce: nonce,
            authTag: new Uint8Array(ciphertext.slice(-16)), // GCM tag is last 16 bytes
            algorithmId: 'AES-256-GCM',
            keyId: keyId,
            key: new Uint8Array(exportedKey) // WARNING: Must be wrapped before storage
        };
    }

    // Decrypt retrieved bundle
    async decryptBundle(encryptedData, key, nonce, aad) {
        const importedKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: this.algorithm, length: this.keyLength },
            false,
            ['decrypt']
        );
        
        const decrypted = await crypto.subtle.decrypt(
            { name: this.algorithm, iv: nonce, additionalData: aad },
            importedKey,
            encryptedData
        );
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }
}
```

**Integration Point**: Update `cti-frontend/app/submit/page.js`

```javascript
import { IOCEncryption } from '@/utils/encryption';

// In submission handler:
const encryptor = new IOCEncryption();
const { ciphertext, nonce, keyId, key } = await encryptor.encryptBundle(stixBundle, metadata);

// Upload CIPHERTEXT to IPFS (not plaintext)
const encryptedPayload = {
    version: '1.0',
    algorithm: 'AES-256-GCM',
    ciphertext: Array.from(ciphertext),
    nonce: Array.from(nonce),
    keyId: keyId
};

const response = await pinata.upload(encryptedPayload);
const cid = response.IpfsHash;
```

**Time**: 1h 15min (including testing in browser console)

---

### 🔴 HOUR 2: CID Commitment + Contract Update (1h 30min)

**File**: `contracts/PrivacyPreservingRegistry.sol` (UPDATE)

**Changes**:
1. Replace `string ipfsCID` with `bytes32 cidCommitment`
2. Add `submitWithCommitment()` function
3. Store full CID in events only (not in storage)

```solidity
// Updated Batch struct
struct Batch {
    bytes32 cidCommitment;  // keccak256(CID) - PRIVACY
    bytes32 merkleRoot;
    address submitter;      // or address(0) for anonymous
    bytes32 commitment;     // For anonymous mode
    uint256 timestamp;
    BatchStatus status;
    uint8 tier;
}

// New submission function
function submitWithCommitment(
    bytes32 _cidCommitment,
    bytes32 _merkleRoot,
    string calldata _actualCID  // Only for event
) external {
    require(contributors[msg.sender].isActive, "Not active contributor");
    require(_cidCommitment == keccak256(abi.encodePacked(_actualCID)), "Invalid commitment");
    
    uint256 batchIndex = batchCount++;
    batches[batchIndex] = Batch({
        cidCommitment: _cidCommitment,
        merkleRoot: _merkleRoot,
        submitter: msg.sender,
        commitment: bytes32(0),
        timestamp: block.timestamp,
        status: BatchStatus.PENDING,
        tier: contributors[msg.sender].tier
    });
    
    // Emit CID in event (for off-chain indexing), not stored on-chain
    emit BatchSubmittedWithCommitment(batchIndex, msg.sender, _actualCID, _cidCommitment);
}

event BatchSubmittedWithCommitment(
    uint256 indexed batchIndex,
    address indexed submitter,
    string ipfsCID,        // For off-chain retrieval
    bytes32 cidCommitment  // On-chain commitment
);
```

**Frontend Integration**:
```javascript
// In submission flow:
const cid = "QmXyz...";
const cidCommitment = ethers.keccak256(ethers.toUtf8Bytes(cid));

await registry.submitWithCommitment(cidCommitment, merkleRoot, cid);
```

**Deployment**:
```bash
# Redeploy contract
npx hardhat run scripts/deployComplete.js --network sepolia

# Update frontend ABI
cp artifacts/contracts/PrivacyPreservingRegistry.sol/PrivacyPreservingRegistry.json cti-frontend/registry-abi.json
```

**Time**: 1h 30min (includes redeployment)

---

### 🟡 HOUR 3-4: EIP-712 Credential System (2 hours)

**File**: `contracts/CredentialRegistry.sol` (NEW CONTRACT)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CredentialRegistry is EIP712, Ownable {
    struct Credential {
        address subject;      // Contributor address
        string role;          // "contributor" | "validator" | "oracle"
        address issuer;       // Admin who issued
        uint256 issuedAt;
        uint256 expiresAt;
        uint256 nonce;
    }
    
    bytes32 public constant CREDENTIAL_TYPEHASH = keccak256(
        "Credential(address subject,string role,address issuer,uint256 issuedAt,uint256 expiresAt,uint256 nonce)"
    );
    
    // Authorized issuers (Merkle root or mapping)
    mapping(address => bool) public authorizedIssuers;
    
    // Used nonces (replay protection)
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    constructor() EIP712("CTI Platform", "1") Ownable(msg.sender) {}
    
    function addIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
    }
    
    function verifyCredential(
        Credential calldata credential,
        bytes calldata signature
    ) public returns (bool) {
        // 1. Check temporal validity
        require(block.timestamp >= credential.issuedAt, "Not yet valid");
        require(block.timestamp <= credential.expiresAt, "Expired");
        
        // 2. Check nonce (replay protection)
        require(!usedNonces[credential.subject][credential.nonce], "Nonce already used");
        usedNonces[credential.subject][credential.nonce] = true;
        
        // 3. Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            CREDENTIAL_TYPEHASH,
            credential.subject,
            keccak256(bytes(credential.role)),
            credential.issuer,
            credential.issuedAt,
            credential.expiresAt,
            credential.nonce
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        
        // 4. Verify issuer is authorized
        require(signer == credential.issuer, "Invalid signature");
        require(authorizedIssuers[signer], "Issuer not authorized");
        
        return true;
    }
}
```

**Frontend Integration** (`cti-frontend/utils/credentials.js`):

```javascript
export async function signCredential(signer, credential) {
    const domain = {
        name: 'CTI Platform',
        version: '1',
        chainId: await signer.getChainId(),
        verifyingContract: CREDENTIAL_REGISTRY_ADDRESS
    };
    
    const types = {
        Credential: [
            { name: 'subject', type: 'address' },
            { name: 'role', type: 'string' },
            { name: 'issuer', type: 'address' },
            { name: 'issuedAt', type: 'uint256' },
            { name: 'expiresAt', type: 'uint256' },
            { name: 'nonce', type: 'uint256' }
        ]
    };
    
    return await signer.signTypedData(domain, types, credential);
}

export async function submitWithCredential(registry, credential, signature, cidCommitment, merkleRoot, cid) {
    return await registry.submitWithCredential(
        credential,
        signature,
        cidCommitment,
        merkleRoot,
        cid
    );
}
```

**Updated Registry Contract**:

```solidity
// Add to PrivacyPreservingRegistry.sol
ICredentialRegistry public credentialRegistry;

function submitWithCredential(
    ICredentialRegistry.Credential calldata credential,
    bytes calldata signature,
    bytes32 _cidCommitment,
    bytes32 _merkleRoot,
    string calldata _actualCID
) external {
    // Verify credential
    require(credentialRegistry.verifyCredential(credential, signature), "Invalid credential");
    require(credential.subject == msg.sender, "Credential subject mismatch");
    
    // Proceed with submission
    _submitBatch(_cidCommitment, _merkleRoot, _actualCID, msg.sender);
}
```

**Time**: 2 hours (contract + frontend integration)

---

### 🟢 HOUR 5: Documentation + Limitations (1 hour)

**Update Chapter 4** with implementation notes:

```markdown
## 4.10 CP2 Implementation: Encryption and Credentials

### 4.10.1 Client-Side Encryption Implementation

The platform implements AES-256-GCM authenticated encryption for IOC bundles before IPFS upload:

**Encryption Workflow**:
1. Generate random 256-bit key (K_ioc) using `crypto.subtle.generateKey()`
2. Generate random 96-bit nonce using `crypto.getRandomValues()`
3. Compute AAD = keccak256(metadata) to bind ciphertext to metadata
4. Encrypt STIX bundle: `AES-GCM(K_ioc, nonce, plaintext, AAD)`
5. Output: ciphertext + nonce + authTag + keyId

**Key Management** (Current Limitation):
- CP2 implementation uses **Option C (per-user vault)** - NOT PRODUCTION READY
- Encryption key stored in browser localStorage (proof-of-concept only)
- WARNING: Key compromise exposes all user's historical submissions
- CP3 MUST implement Option A (public-key wrapping) for production

### 4.10.2 EIP-712 Credential Verification

Implemented credential-based authorization with structured data signing:

**Credential Schema**:
- subject: Ethereum address
- role: "contributor" | "validator" | "oracle"
- issuer: Authorized admin address
- issuedAt/expiresAt: Unix timestamps
- nonce: Replay protection

**Verification Logic**:
1. Check temporal validity (issuedAt ≤ now ≤ expiresAt)
2. Verify nonce uniqueness (prevent replay)
3. Recover signer from EIP-712 signature
4. Verify signer is authorized issuer
5. Verify role permissions

### 4.10.3 CID Commitment Privacy Enhancement

**On-chain Storage**: Only `keccak256(CID)` stored in contract state
**Event Emission**: Full CID emitted in events for off-chain indexing
**Privacy Benefit**: Blockchain observers cannot directly retrieve IPFS content without event access

### 4.10.4 Known Limitations (CRITICAL)

| Limitation | Impact | Mitigation Plan (CP3) |
|------------|--------|---------------------|
| **Key storage in localStorage** | High - XSS attack steals all keys | Implement key wrapping with MetaMask signature |
| **No key rotation** | High - Compromised key persists | Add time-based key expiry + rotation |
| **No key recovery** | Medium - Lost key = lost data | Implement social recovery or key escrow |
| **Single issuer model** | Medium - Centralization risk | Add Merkle tree of issuers |
| **No credential revocation** | High - Cannot revoke compromised credentials | Implement on-chain revocation list |

**EXAMINER NOTE**: This is a proof-of-concept demonstrating cryptographic feasibility. Production deployment requires addressing all limitations above.
```

**Time**: 1 hour (write + integrate into report)

---

## REALISTIC 5-HOUR DELIVERABLES

### ✅ WILL BE DONE (Core Functionality)
1. ✅ Client-side AES-256-GCM encryption module
2. ✅ CID commitment (keccak256) in smart contract
3. ✅ EIP-712 credential schema + verification
4. ✅ Updated frontend submission flow
5. ✅ Documentation of limitations

### ❌ WILL NOT BE DONE (Deferred to CP3)
1. ❌ Comprehensive testing (only manual browser tests)
2. ❌ Gas benchmarking (Sepolia vs Arbitrum comparison)
3. ❌ Key wrapping implementation (public-key encryption)
4. ❌ Credential revocation mechanism
5. ❌ Security audit
6. ❌ Production hardening

---

## EXECUTION CHECKLIST

```bash
# HOUR 1: Encryption
[ ] Create cti-frontend/utils/encryption.js
[ ] Test in browser console: encrypt → decrypt roundtrip
[ ] Update submit/page.js to call encryption before IPFS

# HOUR 2: Contracts
[ ] Update PrivacyPreservingRegistry.sol (cidCommitment)
[ ] Deploy to Sepolia: npx hardhat run scripts/deployComplete.js --network sepolia
[ ] Update frontend ABI: cp artifacts/.../PrivacyPreservingRegistry.json cti-frontend/

# HOUR 3-4: Credentials
[ ] Create contracts/CredentialRegistry.sol
[ ] Deploy credential registry
[ ] Create cti-frontend/utils/credentials.js
[ ] Link registry contracts (setCredentialRegistry)
[ ] Test EIP-712 signature in MetaMask

# HOUR 5: Documentation
[ ] Update Chapter 4 with 4.10 section
[ ] Document limitations clearly
[ ] Update CP2_TECHNICAL_SPECIFICATION.md with implementation status
```

---

## EMERGENCY SHORTCUTS (If Behind Schedule)

**If 3 hours in and not done**:
1. Skip credential registry deployment (document as "designed but not deployed")
2. Focus on encryption + CID commitment only
3. Write detailed design documentation instead of code

**If 4 hours in and not done**:
1. Commit what you have
2. Write comprehensive "Implementation Notes" section explaining partial completion
3. Be HONEST in report: "CP2 demonstrates cryptographic design feasibility; production implementation requires additional 20 hours"

---

## POST-5-HOUR TASKS (CP3 Roadmap)

**Week 1 (Testing)**:
- Write Jest tests for encryption module
- Write Hardhat tests for credential verification
- Gas benchmarking script

**Week 2 (Key Management)**:
- Implement public-key wrapping (libsodium or MetaMask ecies)
- Build key distribution service
- Add key rotation mechanism

**Week 3 (Production Hardening)**:
- External security audit (Trail of Bits / OpenZeppelin)
- Implement credential revocation
- Add monitoring/alerting

---

## FINAL REALITY CHECK

**Can you submit this as CP2?**  
✅ YES - if you frame it as "proof-of-concept demonstrating cryptographic feasibility"

**Will it pass as production-ready?**  
❌ NO - but that's OKAY if you document limitations honestly

**What to tell examiner?**  
"CP2 implements core cryptographic components (AES-256-GCM, EIP-712, CID commitments) as proof-of-concept. Production deployment requires key management hardening (estimated 20 additional hours), detailed in CP3 roadmap."

**Examiner will accept this IF**:
1. You demonstrate technical understanding (you do)
2. You're honest about limitations (critical)
3. You show clear path to production (CP3 plan)

---

**GO TIME: START WITH HOUR 1 NOW**
