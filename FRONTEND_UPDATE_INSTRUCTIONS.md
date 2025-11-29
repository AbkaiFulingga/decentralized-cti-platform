# Frontend Update Instructions - ZKP Fix Deployment

## Problem Identified
Your frontend was calling the **OLD Registry** (`0x892ad6...`) which doesn't have the ZKP fix, causing "Invalid ZKP commitment" errors.

## What Was Fixed
✅ Updated `cti-frontend/utils/constants.js` with NEW contract addresses

## Address Changes

### Arbitrum Sepolia Network

| Contract | OLD Address (❌ Don't Use) | NEW Address (✅ Use This) |
|----------|---------------------------|---------------------------|
| **Registry** | `0x892AD6E47dbD86aD7855f7eEAe0F4fCa6223C36A` | `0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E` |
| **Governance** | `0xeB09652Ed1a543C5Ec36873C83cAFC3356AAca52` | `0x759eC9e57D8aE5c34de304D3126936bB216668F3` |
| **Storage** | `0x177fD44E879a162f3b642b313F253D97bD73a301` | `0x958C59e4a2225635043539372e995F17AEE6e50d` |
| **MerkleZK** | `0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1` | `0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1` *(unchanged)* |

## Next Steps (CRITICAL - Required Before Testing)

### 1. Link Contracts (Run These Commands)

```bash
# Step 1: Update MerkleZK → Registry link
npx hardhat run scripts/update-merkle-registry.js --network arbitrumSepolia

# Step 2: Update Registry → MerkleZK link
npx hardhat run scripts/link-merkle-zk.js --network arbitrumSepolia
```

**What these do:**
- `update-merkle-registry.js`: Updates MerkleZK's `mainRegistry` to point to NEW Registry
- `link-merkle-zk.js`: Updates NEW Registry's `merkleZKRegistry` to trust MerkleZK

**Why this is required:**
Without bidirectional linking, anonymous submissions will **still fail** because the Registry won't trust the MerkleZK's delegated submissions.

### 2. Restart Frontend Dev Server

```bash
cd cti-frontend
npm run dev
```

### 3. Test Anonymous Submission

1. Go to `/submit` page
2. Select **"Anonymous"** mode
3. Add some test IOCs (e.g., `192.168.1.100`, `malware.example.com`)
4. Submit

**Expected Result:** ✅ Transaction succeeds (no "Invalid ZKP commitment" error)

## Verification Commands

Check if contracts are linked:

```bash
# Check if MerkleZK points to NEW Registry
cast call 0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1 \
  "mainRegistry()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# Should return: 0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E


# Check if NEW Registry trusts MerkleZK
cast call 0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E \
  "merkleZKRegistry()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# Should return: 0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1
```

## Why This Happened

1. You deployed NEW contracts with `deployComplete.js`
2. Frontend was still using OLD contract addresses
3. OLD Registry doesn't have the ZKP fix (added in recent code changes)
4. Contracts weren't linked bidirectionally

## What Changed in NEW Registry

The NEW Registry (`0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E`) has these fixes:

```solidity
// 1. Added variable to store MerkleZK address
address public merkleZKRegistry;

// 2. Added setter function (owner only)
function setMerkleZKRegistry(address _merkleZKRegistry) external onlyOwner {
    merkleZKRegistry = _merkleZKRegistry;
}

// 3. Modified addBatch() to trust MerkleZK submissions
function addBatch(string memory ipfsCid, bytes32 merkleRoot) public payable {
    // ... existing checks ...
    
    // NEW: Trust submissions from MerkleZK (bypass validCommitments check)
    if (msg.sender != merkleZKRegistry) {
        require(validCommitments[commitment], "Invalid ZKP commitment");
    }
    
    // ... rest of function ...
}
```

This allows MerkleZK to forward anonymous submissions without requiring pre-registered commitments.

## Contributor Tree Status

✅ Admin 1 (`0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82`) is already registered in MerkleZK
✅ Single-leaf Merkle tree is valid (no need to wait for other admins)
✅ Proof generation works correctly (empty array for single-leaf tree)

## Troubleshooting

### If submission still fails after linking:

1. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check MetaMask network** - should be "Arbitrum Sepolia"
3. **Verify contract addresses in browser console**:
   ```javascript
   console.log(CONTRACT_ADDRESSES);
   ```
4. **Check transaction revert reason** on Arbiscan

### If linking script fails:

- Ensure you're using Admin 1 wallet (`0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82`)
- Check you have enough ETH for gas (~0.001 ETH)
- Verify you're on Arbitrum Sepolia network

## Explorer Links

- **NEW Registry**: https://sepolia.arbiscan.io/address/0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E
- **MerkleZK**: https://sepolia.arbiscan.io/address/0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1
- **NEW Governance**: https://sepolia.arbiscan.io/address/0x759eC9e57D8aE5c34de304D3126936bB216668F3

---

**Status**: 🟡 Frontend updated, contracts need linking before testing
**Next Action**: Run the 2 linking commands above
