# File Usage Analysis - Decentralized CTI Platform

## 🟢 ACTIVELY USED FILES

### **Smart Contracts** (Production)
| File | Status | Usage |
|------|--------|-------|
| `PrivacyPreservingRegistry.sol` | ✅ **ACTIVE** | Main registry - used by `deployComplete.js`, all test scripts, frontend |
| `ThresholdGovernance.sol` | ✅ **ACTIVE** | 2-of-3 governance - deployed by `deployComplete.js`, used in admin panels |
| `StorageContribution.sol` | ✅ **ACTIVE** | IPFS pinning incentives - deployed by `deployComplete.js`, has frontend UI |
| `MerkleZKRegistry.sol` | ✅ **ACTIVE** | Anonymous submission layer - deployed by `deploy-merkle-zk.js`, integrated in frontend |
| `OracleIOCFeed.sol` | ✅ **ACTIVE** | Automated feeds - deployed by `deploy-oracle.js`, used by `oracle-service.js` |

### **Backend Scripts** (Production)
| File | Status | Usage |
|------|--------|-------|
| `deployComplete.js` | ✅ **ACTIVE** | Main deployment script - creates `test-addresses.json` |
| `oracle-service.js` | ✅ **ACTIVE** | PM2 daemon - runs via `npm run oracle:pm2` |
| `stix-utils.js` | ✅ **ACTIVE** | STIX 2.1 converter - imported by `addSTIXBatch.js`, `test-stix-conversion.js` |
| `deploy-merkle-zk.js` | ✅ **ACTIVE** | Deploys MerkleZK on Arbitrum - creates `deployments/merkle-zk-arbitrum.json` |
| `deploy-oracle.js` | ✅ **ACTIVE** | Deploys OracleIOCFeed contract |
| `registerAdminAsContributor.js` | ✅ **ACTIVE** | Critical setup script - admins must be contributors to approve batches |
| `testTieredStaking.js` | ✅ **ACTIVE** | Tests 3-tier system (micro/standard/premium) |
| `test1-registry.js` | ✅ **ACTIVE** | Registry functionality tests |
| `test2-governance.js` | ✅ **ACTIVE** | Governance approval tests |
| `test3-zkp-integration.js` | ✅ **ACTIVE** | ZKP/anonymous submission tests |
| `test4-privacy-governance.js` | ✅ **ACTIVE** | Privacy + governance integration tests |
| `addPrivacyBatch.js` | ✅ **ACTIVE** | Submit batches to PrivacyPreservingRegistry |
| `addSTIXBatch.js` | ✅ **ACTIVE** | Submit STIX-formatted batches |
| `admin2ApproveBatches.js` | ✅ **ACTIVE** | Admin approval workflow |
| `verifyPrivacyIOC.js` | ✅ **ACTIVE** | Verify IOCs from PrivacyPreservingRegistry |
| `submitEnhancedAnonymous.js` | ✅ **ACTIVE** | Anonymous batch submission |
| `registerEnhancedAnonymous.js` | ✅ **ACTIVE** | Anonymous contributor registration |

### **Frontend Components** (All Active)
| Component | Status | Usage |
|-----------|--------|-------|
| `IOCSubmissionForm.jsx` | ✅ **ACTIVE** | Main submission UI - uses PrivacyPreservingRegistry |
| `IOCVerification.jsx` | ✅ **ACTIVE** | Merkle proof verification |
| `AdminGovernancePanel.jsx` | ✅ **ACTIVE** | Admin approval interface |
| `PlatformDashboard.jsx` | ✅ **ACTIVE** | Real-time statistics |
| `BatchBrowser.jsx` | ✅ **ACTIVE** | Browse L1 + L2 batches |
| `OracleFeedDisplay.jsx` | ✅ **ACTIVE** | Display automated threat feeds |
| `StorageContribution.jsx` | ✅ **ACTIVE** | IPFS provider registration |
| `AnalyticsDashboard.jsx` | ✅ **ACTIVE** | Platform analytics |
| `EnhancedIOCSearch.jsx` | ✅ **ACTIVE** | Search across networks |
| `IOCUniverse.jsx` | ✅ **ACTIVE** | 3D visualization component |

### **Configuration Files**
| File | Status | Usage |
|------|--------|-------|
| `test-addresses.json` | ✅ **ACTIVE** | Sepolia deployment addresses - created by `deployComplete.js` |
| `test-addresses-arbitrum.json` | ✅ **ACTIVE** | Arbitrum deployment addresses |
| `.env.example` | ✅ **ACTIVE** | Template for environment variables |
| `hardhat.config.js` | ✅ **ACTIVE** | Hardhat network configuration |
| `package.json` | ✅ **ACTIVE** | Dependencies + oracle scripts |
| `contributor-merkle-tree.json` | ✅ **ACTIVE** | Pre-registered contributor commitments |
| `stix-sample.json` | ✅ **ACTIVE** | Example STIX 2.1 structure |

---

## 🟡 LEGACY/DEPRECATED FILES (Old Iterations)

### **Contracts** (Old Versions - Not Used in Production)
| File | Status | Reason |
|------|--------|--------|
| `IOCRegistry.sol` | 🟡 **LEGACY** | Original simple version - superseded by PrivacyPreservingRegistry |
| `IOCRegistryMerkle.sol` | 🟡 **LEGACY** | Early Merkle version - superseded by PrivacyPreservingRegistry |
| `EnhancedIOCRegistry.sol` | 🟡 **LEGACY** | Mid-iteration - superseded by PrivacyPreservingRegistry |
| `Governance.sol` | 🟡 **LEGACY** | Old voting system - superseded by ThresholdGovernance |
| `CredentialRegistry.sol` | 🟡 **LEGACY** | Early credential system - functionality merged into PrivacyPreservingRegistry |

**Evidence**: 
- `deployComplete.js` only deploys `PrivacyPreservingRegistry`, not the old contracts
- `test-addresses.json` only contains `PrivacyPreservingRegistry`, not `IOCRegistry` or `EnhancedIOCRegistry`
- Frontend uses `PrivacyPreservingRegistry` ABI exclusively

### **Scripts** (Old/Testing)
| File | Status | Reason |
|------|--------|--------|
| `deploy.js` | 🟡 **LEGACY** | Old deployment script - superseded by `deployComplete.js` |
| `deployMerkle.js` | 🟡 **LEGACY** | Deploys old `IOCRegistryMerkle` - superseded by `deployComplete.js` |
| `deployGovernance.js` | 🟡 **LEGACY** | Deploys old `Governance.sol` + `IOCRegistryMerkle` - superseded by `deployComplete.js` |
| `interact.js` | 🟡 **LEGACY** | Interacts with old `IOCRegistry.sol` (hardcoded localhost address) |
| `addBatch.js` | 🟡 **LEGACY** | Uses old `IOCRegistryMerkle` from `deployedAddress.json` |
| `verifyIOC.js` | 🟡 **LEGACY** | Verifies from old `IOCRegistryMerkle` |
| `readBatches.js` | 🟡 **LEGACY** | Reads from old `IOCRegistryMerkle` |
| `proposeAndVote.js` | 🟡 **LEGACY** | Uses old `Governance.sol` (not ThresholdGovernance) |
| `governanceSepolia.js` | 🟡 **DEBUGGING** | Old debug script |

**Evidence**: These reference `deployedAddress.json` (old format) instead of `test-addresses.json` (current format)

### **Backup Files** (Editor Artifacts)
| File | Status | Reason |
|------|--------|--------|
| `Governance.sol.save` | 🔴 **ARTIFACT** | vim/editor backup - identical to old `Governance.sol` |
| `zkp-utils.js.save` | 🔴 **ARTIFACT** | vim/editor backup - corrupted (starts with "xxxkx") |

---

## 🔴 DEBUG/TEMPORARY FILES

| File | Status | Purpose |
|------|--------|---------|
| `checkAdmin3.js` | 🔧 **DEBUG** | Debugging admin3 approval issues |
| `debugAddBatch.js` | 🔧 **DEBUG** | Debugging batch submission reverts |
| `debugAdmin3Approvals.js` | 🔧 **DEBUG** | Debugging approval workflow |
| `debugApprovals.js` | 🔧 **DEBUG** | General approval debugging |
| `checkActualABI.js` | 🔧 **DEBUG** | ABI mismatch troubleshooting |
| `checkAdminContributorStatus.js` | 🔧 **DEBUG** | Check if admins are registered contributors |
| `checkBatchSubmitters.js` | 🔧 **DEBUG** | Verify batch submitter addresses |
| `checkContractExists.js` | 🔧 **DEBUG** | Verify deployment |
| `checkContractFunctions.js` | 🔧 **DEBUG** | List contract functions |
| `checkDeployedContract.js` | 🔧 **DEBUG** | Check contract state |
| `verifyDeployment.js` | 🔧 **DEBUG** | Verify all contracts deployed correctly |
| `verifyAdminRegistration.js` | 🔧 **DEBUG** | Check admin registration status |
| `verifyBothContracts.js` | 🔧 **DEBUG** | Compare two contract versions |
| `detailedVotingHistory.js` | 🔧 **DEBUG** | Audit voting history |
| `fundAdmin3.js` | 🔧 **DEBUG** | Send ETH to admin3 for gas |
| `addAdmin3.js` | 🔧 **DEBUG** | Add third admin to governance |
| `testModifiedOption3.js` | 🔧 **DEBUG** | Test specific approval scenario |
| `testNewDeployment.js` | 🔧 **DEBUG** | Test fresh deployment |
| `testWithAdmin1.js` | 🔧 **DEBUG** | Test with admin1 signer |
| `approveAllWithAdmin1.js` | 🔧 **DEBUG** | Batch approve all pending with admin1 |

**Purpose**: These were created during development to troubleshoot issues (e.g., "Not active contributor" errors)

---

## 📊 UNUSED BUT POTENTIALLY USEFUL

| File | Status | Notes |
|------|--------|-------|
| `zkp-utils.js` | ⚠️ **UNUSED** | Has ZKP utility functions but not imported anywhere. Consider merging into `stix-utils.js` or documenting |
| `zkp-utils-enhanced.js` | ⚠️ **UNUSED** | Enhanced ZKP functions - may be for future features |
| `update-contributor-merkle.js` | ⚠️ **UNUSED** | Updates `contributor-merkle-tree.json` - likely used during setup |
| `verifySingleIOC.js` | ⚠️ **UNUSED** | Standalone IOC verification - functionality exists in frontend |
| `test-stix-conversion.js` | ⚠️ **MINIMAL** | Tests STIX conversion but may not be in CI/CD |

---

## 🗑️ SAFE TO DELETE/ARCHIVE

### **Contracts**
- `IOCRegistry.sol` → Archive to `contracts/legacy/`
- `IOCRegistryMerkle.sol` → Archive to `contracts/legacy/`
- `EnhancedIOCRegistry.sol` → Archive to `contracts/legacy/`
- `Governance.sol` → Archive to `contracts/legacy/`
- `CredentialRegistry.sol` → Archive to `contracts/legacy/`
- `Governance.sol.save` → **DELETE** (editor backup)

### **Scripts**
- `deploy.js` → Archive to `scripts/legacy/`
- `deployMerkle.js` → Archive to `scripts/legacy/`
- `deployGovernance.js` → Archive to `scripts/legacy/`
- `interact.js` → Archive to `scripts/legacy/`
- `addBatch.js` → Archive to `scripts/legacy/`
- `verifyIOC.js` → Archive to `scripts/legacy/`
- `readBatches.js` → Archive to `scripts/legacy/`
- `proposeAndVote.js` → Archive to `scripts/legacy/`
- `governanceSepolia.js` → Archive to `scripts/legacy/`
- `zkp-utils.js.save` → **DELETE** (corrupted backup)

### **Debug Scripts** (Move to `scripts/debug/`)
All the `check*.js`, `debug*.js`, `test*.js` (except the main test1-4 suite) files

### **Deployment Artifacts**
- `deployedAddress.json` → **DELETE** or archive (old format, superseded by `test-addresses.json`)
- `deployment-*.txt` → Archive to `deployments/logs/` (historical records)

---

## 📝 RECOMMENDATIONS

### **1. Reorganize File Structure**
```bash
contracts/
  ├── core/                    # Active contracts
  │   ├── PrivacyPreservingRegistry.sol
  │   ├── ThresholdGovernance.sol
  │   ├── StorageContribution.sol
  │   ├── MerkleZKRegistry.sol
  │   └── OracleIOCFeed.sol
  └── legacy/                  # Old iterations
      ├── IOCRegistry.sol
      ├── IOCRegistryMerkle.sol
      ├── EnhancedIOCRegistry.sol
      └── Governance.sol

scripts/
  ├── deploy/                  # Production deployment
  │   ├── deployComplete.js
  │   ├── deploy-merkle-zk.js
  │   └── deploy-oracle.js
  ├── admin/                   # Admin operations
  │   ├── registerAdminAsContributor.js
  │   └── admin2ApproveBatches.js
  ├── submit/                  # IOC submission
  │   ├── addPrivacyBatch.js
  │   ├── addSTIXBatch.js
  │   └── submitEnhancedAnonymous.js
  ├── test/                    # Test suites
  │   ├── test1-registry.js
  │   ├── test2-governance.js
  │   ├── test3-zkp-integration.js
  │   └── test4-privacy-governance.js
  ├── utils/                   # Utilities
  │   ├── stix-utils.js
  │   ├── zkp-utils.js
  │   └── oracle-service.js
  ├── debug/                   # Troubleshooting (non-production)
  │   ├── check*.js
  │   └── debug*.js
  └── legacy/                  # Old scripts
      ├── deploy.js
      ├── deployMerkle.js
      └── deployGovernance.js
```

### **2. Update Documentation**
- Add comment at top of legacy files: `// DEPRECATED: Use PrivacyPreservingRegistry instead`
- Update README to only reference active contracts
- Create `MIGRATION.md` explaining v1 → v2 → v3 evolution

### **3. Clean Package Scripts**
Remove any references to old deployment scripts in `package.json` if they exist

### **4. Add .gitignore Entries**
```
*.save
*.swp
deployedAddress.json
deployment-*.txt
```

---

## 🎯 PRODUCTION DEPLOYMENT CHECKLIST

**Current Active Stack:**
1. ✅ Deploy: `npx hardhat run scripts/deployComplete.js --network sepolia`
2. ✅ Deploy Merkle: `npx hardhat run scripts/deploy-merkle-zk.js --network arbitrumSepolia`
3. ✅ Deploy Oracle: `npx hardhat run scripts/deploy-oracle.js --network arbitrumSepolia`
4. ✅ Register Admins: `npx hardhat run scripts/registerAdminAsContributor.js --network sepolia`
5. ✅ Start Oracle: `npm run oracle:pm2`

**Do NOT use:**
- ❌ `deploy.js` (old)
- ❌ `deployMerkle.js` (old)
- ❌ `deployGovernance.js` (old)
- ❌ Any script referencing `IOCRegistry`, `IOCRegistryMerkle`, or old `Governance.sol`
