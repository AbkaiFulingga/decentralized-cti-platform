# Fixes Applied - December 22, 2025

## Issues Resolved

### 1. ✅ zksnark-prover.js - Undefined Address Error
**Error**: `Cannot read properties of undefined (reading 'toLowerCase')`

**Root Cause**: The `isAddressInTree()` function didn't check if contributor entries had an `address` property before calling `.toLowerCase()`

**Fix**: Added null safety checks
```javascript
// Before:
c => c.address.toLowerCase() === addressLower

// After:
c => c && c.address && c.address.toLowerCase() === addressLower
```

**File**: `cti-frontend/utils/zksnark-prover.js:105`

---

### 2. ✅ EnhancedIOCSearch.jsx - getBatch Decoding Error
**Error**: `could not decode result data... method: "getBatch"`

**Root Cause**: Two issues:
1. The ABI definition didn't match the actual contract return type (`string cid` vs `bytes32 cidCommitment`)
2. The contract stores only `cidCommitment` (keccak256 hash), not the actual CID string
3. Frontend was treating return values as array indices instead of named properties

**Fix**: 
1. Updated ABI to match contract signature:
```javascript
"function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)"
```

2. Query `BatchAdded` events to get actual CID values:
```javascript
const filter = registry.filters.BatchAdded();
const events = await registry.queryFilter(filter, 0, 'latest');
const cidMap = {};
events.forEach(event => {
  cidMap[Number(event.args.index)] = event.args.cid;
});
```

3. Use named properties instead of array indices:
```javascript
// Before:
cid: batch[0],
merkleRoot: batch[1],
timestamp: Number(batch[2]),

// After:
cid: cid,  // from event
merkleRoot: batch.merkleRoot,
timestamp: Number(batch.timestamp),
```

**File**: `cti-frontend/components/EnhancedIOCSearch.jsx:92-145`

---

### 3. ✅ Merkle Tree Hashing Inconsistency
**Error**: "likely a problem with keccak256 and poseidon root or my address not being a part of the tree"

**Root Cause**: The `build-contributor-tree.js` script was using incorrect hashing:
```javascript
// WRONG: Hashes UTF-8 string representation
keccak256(ethers.toUtf8Bytes(addr.toLowerCase()))

// CORRECT: Hashes the address bytes directly
keccak256(addr.toLowerCase())
```

This didn't match OpenZeppelin's `MerkleProof.verify()` which expects `keccak256(abi.encodePacked(address))`.

**Fix**: Updated `scripts/build-contributor-tree.js` to use correct hashing and improved tree structure:

```javascript
// Build Merkle tree - use keccak256 of the address directly
const leaves = contributors.map(addr => 
    keccak256(addr.toLowerCase())
);

const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
```

Also restructured the output JSON to include:
- `hashFunction: 'keccak256'` field for clarity
- Separate `contributors`, `leaves`, and `proofs` arrays
- Proper metadata (timestamp, treeDepth, contributorCount)

**Files**: 
- `scripts/build-contributor-tree.js`
- `contributor-merkle-tree.json` (regenerated)

---

## Architecture Notes

The platform uses **two different anonymous submission paths**:

### Path 1: MerkleZKRegistry (Arbitrum L2)
- Uses **keccak256** hashing for Merkle trees
- Verified with OpenZeppelin's `MerkleProof.verify()`
- Stores contributor commitment on-chain
- Prevents replay attacks with `usedCommitments` mapping

### Path 2: zkSNARK Groth16 (Frontend)
- Uses **Poseidon** hashing in circuits (`contributor-proof.circom`)
- Generates zero-knowledge proofs client-side
- Verified via `Groth16Verifier.sol`
- More gas-efficient but requires circuit setup

Both paths are valid - they serve different use cases and are not meant to be mixed.

---

## Deployment Steps Completed

1. ✅ Fixed code on local machine
2. ✅ Copied updated files to server (192.168.1.11):
   - `scripts/build-contributor-tree.js`
   - `cti-frontend/utils/zksnark-prover.js`
   - `cti-frontend/components/EnhancedIOCSearch.jsx`
3. ✅ Regenerated contributor Merkle tree on server with correct hashing
4. ✅ Restarted Next.js development server via PM2

---

## Testing Verification

You should now be able to:

1. ✅ Query batches from both Sepolia and Arbitrum Sepolia without decoding errors
2. ✅ See correct CID values from events instead of cidCommitment hashes
3. ✅ Verify your address is in the contributor tree
4. ✅ Submit anonymous batches via MerkleZKRegistry with valid Merkle proofs

---

## Next Steps (If Issues Persist)

If you're still seeing errors:

1. **Check your address is registered**:
   ```bash
   ssh sc@192.168.1.11
   cd ~/blockchain-dev
   cat contributor-merkle-tree.json | grep -i "0x26337"
   ```

2. **Verify on-chain Merkle root matches**:
   ```bash
   npx hardhat run scripts/check-merkle-root.js --network arbitrumSepolia
   ```

3. **Clear browser cache** to reload the updated frontend code

4. **Check PM2 logs** for any runtime errors:
   ```bash
   ssh sc@192.168.1.11 'pm2 logs nextjs-dev --lines 50'
   ```
