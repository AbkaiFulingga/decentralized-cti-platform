# Quick ZKP Diagnostic Commands

## 1. Check MerkleZK Configuration
```bash
cast call 0x22f2060fbe50403e588d70156776F72ab060Ab9c \
  "contributorMerkleRoot()(bytes32)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```
**Expected:** Should return a non-zero root (0xca3f375f2781ea9580207b753d11dca88dd7b7e23f299f6aeeba337c8b8a74ba)
**If zero:** Tree not initialized

## 2. Check MerkleZK Points to Correct Registry
```bash
cast call 0x22f2060fbe50403e588d70156776F72ab060Ab9c \
  "mainRegistry()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```
**Expected:** `0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44`
**If different:** MerkleZK pointing to wrong Registry

## 3. Check Registry Trusts MerkleZK
```bash
cast call 0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44 \
  "merkleZKRegistry()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```
**Expected:** `0x22f2060fbe50403e588d70156776F72ab060Ab9c`
**If zero or different:** Registry doesn't trust MerkleZK

## 4. Run Full Diagnostic
```bash
cd ~/blockchain-dev
npx hardhat run scripts/diagnose-zkp-submission.js --network arbitrumSepolia
```

## Common Fixes

### If tree not initialized:
```bash
npx hardhat run scripts/add-admins-to-contributor-tree.js --network arbitrumSepolia
```

### If addresses don't match:
You need to redeploy MerkleZK pointing to correct Registry:
```bash
npx hardhat run scripts/redeploy-merkle-zk.js --network arbitrumSepolia
```

### If Registry doesn't trust MerkleZK:
```bash
npx hardhat run scripts/link-merkle-zk.js --network arbitrumSepolia
```

## Frontend Changes Made

1. ✅ Increased minimum submission fee to 0.001 ETH
2. ✅ Increased gas limit from 450,000 to 500,000
3. ✅ Added detailed error logging
4. ✅ Added specific error messages for ZKP failures

## Test After Changes

1. Restart frontend: `cd cti-frontend && npm run dev`
2. Clear browser cache (Cmd+Shift+R)
3. Open browser console (F12)
4. Try anonymous submission
5. Check console for detailed error logs
