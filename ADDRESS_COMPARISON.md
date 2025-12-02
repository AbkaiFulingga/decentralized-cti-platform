# Address Comparison - Mac vs Server

## 🔴 MISMATCH DETECTED

Your Mac files are **OUT OF SYNC** with your server deployment!

---

## Frontend (`cti-frontend/utils/constants.js`)

✅ **CORRECT** - I already updated this with server addresses:

| Contract | Address in Frontend |
|----------|-------------------|
| Registry | `0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44` |
| Governance | `0xa186FEE32e311f65C55612fc98195B27113d1e48` |
| Storage | `0xBBCC5a5c29Fbf3aB8B97a4869871C70fADE6C0Cd` |
| MerkleZK | `0x22f2060fbe50403e588d70156776F72ab060Ab9c` |

---

## Backend JSON Files

### ❌ `test-addresses-arbitrum.json` (Mac - OUTDATED)

| Contract | Address in File |
|----------|----------------|
| Registry | `0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E` ❌ |
| Governance | `0x759eC9e57D8aE5c34de304D3126936bB216668F3` ❌ |
| Storage | `0x958C59e4a2225635043539372e995F17AEE6e50d` ❌ |
| MerkleZK | **MISSING** ❌ |

### ❌ `contributor-merkle-tree.json` (Mac - OUTDATED)

| Field | Value in File |
|-------|--------------|
| merkleZKAddress | `0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1` ❌ (OLD) |

---

## ✅ Server Deployment (ACTUAL ADDRESSES)

From your server output:
```
Registry: 0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44
Governance: 0xa186FEE32e311f65C55612fc98195B27113d1e48  
Storage: 0xBBCC5a5c29Fbf3aB8B97a4869871C70fADE6C0Cd
MerkleZK: 0x22f2060fbe50403e588d70156776F72ab060Ab9c (NEW)
```

---

## Impact Analysis

### ✅ What Works
- **Frontend** → Uses correct addresses from `constants.js`
- **Anonymous submissions** → Should work with updated frontend

### ❌ What Doesn't Work
- **Backend scripts** → Read from `test-addresses-arbitrum.json` (wrong addresses)
- **Any script using `contributor-merkle-tree.json`** → References OLD MerkleZK

---

## Fix Required

### Option 1: Update Mac Files Manually

Update `test-addresses-arbitrum.json`:
```json
{
  "network": "arbitrumSepolia",
  "chainId": "421614",
  "PrivacyPreservingRegistry": "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44",
  "ThresholdGovernance": "0xa186FEE32e311f65C55612fc98195B27113d1e48",
  "StorageContribution": "0xBBCC5a5c29Fbf3aB8B97a4869871C70fADE6C0Cd",
  "MerkleZKRegistry": "0x22f2060fbe50403e588d70156776F72ab060Ab9c",
  "admins": [
    "0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82",
    "0xf78afa5E41eDF35c05c1aEB082C1789283b09d3B",
    "0x0D5CaD75D37adA5A81EbEe04387229a40B0a457f"
  ],
  "threshold": 2
}
```

Update `contributor-merkle-tree.json`:
```json
{
  "root": "0xca3f375f2781ea9580207b753d11dca88dd7b7e23f299f6aeeba337c8b8a74ba",
  "leaves": ["0xca3f375f2781ea9580207b753d11dca88dd7b7e23f299f6aeeba337c8b8a74ba"],
  "contributors": ["0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82"],
  "contributorCount": 1,
  "treeDepth": 0,
  "network": "arbitrumSepolia",
  "merkleZKAddress": "0x22f2060fbe50403e588d70156776F72ab060Ab9c"
}
```

### Option 2: Copy from Server

```bash
# From your Mac
scp sc@sc:~/blockchain-dev/test-addresses-arbitrum.json ~/decentralized-cti-platform-1/
scp sc@sc:~/blockchain-dev/contributor-merkle-tree.json ~/decentralized-cti-platform-1/
```

### Option 3: Git Sync (if files pushed from server)

```bash
# On server first
cd ~/blockchain-dev
git add test-addresses-arbitrum.json contributor-merkle-tree.json
git commit -m "Update addresses after MerkleZK redeploy"
git push origin main

# Then on Mac
cd ~/decentralized-cti-platform-1
git pull origin main
```

---

## Verification

After updating, check all three sources match:

### Frontend
```bash
grep -A3 "contracts:" cti-frontend/utils/constants.js | grep -E "(registry|merkleZK)"
```
Should show:
- registry: `0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44`
- merkleZK: `0x22f2060fbe50403e588d70156776F72ab060Ab9c`

### Backend JSON
```bash
cat test-addresses-arbitrum.json | grep -E "(Registry|MerkleZK)"
```
Should show:
- PrivacyPreservingRegistry: `0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44`
- MerkleZKRegistry: `0x22f2060fbe50403e588d70156776F72ab060Ab9c`

### Contributor Tree
```bash
cat contributor-merkle-tree.json | grep merkleZKAddress
```
Should show:
- merkleZKAddress: `0x22f2060fbe50403e588d70156776F72ab060Ab9c`

---

## Summary

| File | Status | Action Required |
|------|--------|----------------|
| `cti-frontend/utils/constants.js` | ✅ CORRECT | None |
| `test-addresses-arbitrum.json` | ❌ OUTDATED | Update/sync from server |
| `contributor-merkle-tree.json` | ❌ OUTDATED | Update/sync from server |

**Next Step:** Choose one of the 3 fix options above to sync your Mac files with the server deployment.
