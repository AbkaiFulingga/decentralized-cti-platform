# Decentralized CTI Platform - AI Agent Instructions

## Architecture Overview

This is a **blockchain-based Cyber Threat Intelligence (CTI) sharing platform** that combines Ethereum smart contracts, IPFS storage, and a Next.js frontend. The system enables privacy-preserving IOC (Indicator of Compromise) submissions with cryptographic proofs.

### Core Components

1. **Smart Contracts** (`contracts/`)
   - `PrivacyPreservingRegistry.sol`: Main IOC registry with tiered staking (0.01/0.05/0.1 ETH) and dual-mode submissions (public/anonymous with 256-bit commitments)
   - `ThresholdGovernance.sol`: 2-of-3 multi-signature admin approval system for batch validation
   - `MerkleZKRegistry.sol`: Merkle proof validation for individual IOC verification
   - `OracleIOCFeed.sol`: Automated threat feed ingestion (AbuseIPDB integration)
   - `StorageContribution.sol`: Distributed IPFS pinning incentive mechanism

2. **Backend Scripts** (`scripts/`)
   - Deployment: `deployComplete.js` deploys all contracts atomically and links them
   - Oracle service: `oracle-service.js` runs as PM2 daemon (`npm run oracle:pm2`) to auto-submit threat feeds
   - STIX conversion: `stix-utils.js` converts flat IOC arrays to STIX 2.1 format with auto-pattern detection

3. **Frontend** (`cti-frontend/`)
   - Next.js 15 with ethers.js v6 for Web3 interactions
   - MetaMask integration for transaction signing
   - Real-time dashboard fetching on-chain statistics

## Critical Workflows

### Deployment Flow
```bash
# 1. Configure environment
cp .env.example .env
# Add: SEPOLIA_RPC_URL, PRIVATE_KEY_ADMIN1-3, PINATA_JWT

# 2. Deploy contracts (creates test-addresses.json)
npx hardhat run scripts/deployComplete.js --network sepolia

# 3. For Arbitrum: Deploy MerkleZK and link
npx hardhat run scripts/deploy-merkle-zk.js --network arbitrumSepolia
npx hardhat run scripts/link-merkle-zk.js --network arbitrumSepolia

# 4. Start oracle service
npm run oracle:pm2
```

**Important**: 
- Contracts must be deployed in order (Registry → Governance → Storage) and linked via `setGovernance()`
- For anonymous submissions on L2: MerkleZKRegistry must be linked to PrivacyPreservingRegistry via `setMerkleZKRegistry()`
- The deployment script handles this automatically

### IOC Submission Pattern
Contributors must register with stake **before** submitting:
```javascript
// 1. Register with tier-based stake
await registry.registerContributor({ value: ethers.parseEther("0.05") }); // Standard tier

// 2. Build Merkle tree from IOC array
const leaves = iocs.map(ioc => keccak256(ioc));
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const root = tree.getHexRoot();

// 3. Upload to IPFS via Pinata
const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
  pinataContent: { iocs },
  pinataMetadata: { name: 'batch-...' }
}, { headers: { 'Authorization': `Bearer ${PINATA_JWT}` }});

// 4. Submit batch on-chain
await registry.addBatch(response.data.IpfsHash, root);
```

**Anonymous mode** uses `keccak256(abi.encodePacked(address, nonce))` as commitment instead of exposing submitter address.

### Governance Approval
Batches require **2-of-3 admin approvals** before acceptance:
```javascript
// Admin 1
await governance.connect(admin1).approveBatch(batchIndex);
// Admin 2 (triggers auto-execution at threshold)
await governance.connect(admin2).approveBatch(batchIndex);
```

Auto-execution calls `registry.acceptBatch()` which updates contributor reputation (+7/+10/+15 based on tier).

## Project-Specific Conventions

### Contract Patterns
- **Never call external contracts in constructors** - use separate `setGovernance()` setter to avoid circular dependencies
- **Tier-aware logic**: All contributor functions check `contributors[addr].tier` to apply differential rewards/penalties
- **Replay protection**: Anonymous commitments use `usedNullifiers` mapping to prevent double-submission
- **Gas optimization**: Merkle trees enable O(log n) verification instead of storing all IOCs on-chain

### Script Patterns
- **Multi-admin support**: Scripts load `PRIVATE_KEY_ADMIN1/2/3` from `.env` and filter undefined keys for Hardhat config
- **Network detection**: Use `test-addresses.json` for Sepolia, `test-addresses-arbitrum.json` for L2
- **IPFS uploads**: All uploads go **directly to Pinata API** (no local IPFS node required) with `Bearer ${PINATA_JWT}` auth

### Frontend Patterns
- **Contract ABIs**: Stored in `cti-frontend/registry-abi.json` (must manually update after contract changes)
- **Address loading**: Fetch from deployed JSON files based on detected chain ID
- **Merkle proof generation**: Frontend rebuilds tree client-side for verification (uses same keccak256 + sortPairs config)

## Environment Variables

Required in `.env`:
- `SEPOLIA_RPC_URL`: Alchemy/Infura endpoint
- `PRIVATE_KEY_ADMIN1/2/3`: Deployer + governance admin keys
- `PINATA_JWT`: Pinata API bearer token (get from https://pinata.cloud)
- `ORACLE_PRIVATE_KEY`: Separate key for oracle service
- `ABUSEIPDB_KEY`: (Optional) For automated threat feed ingestion

## Testing & Debugging

### Run Test Suites
```bash
# Registry functionality
npx hardhat run scripts/test1-registry.js --network sepolia

# Governance voting
npx hardhat run scripts/test2-governance.js --network sepolia

# ZKP integration
npx hardhat run scripts/test3-zkp-integration.js --network sepolia
```

### Common Issues
- **"Not active contributor" revert**: User didn't call `registerContributor()` with sufficient stake
- **"Already approved" error**: Admin tried voting twice on same batch (check `batchApprovals[index].hasApproved[admin]`)
- **Frontend shows wrong data**: ABI may be outdated - rebuild contracts and update `registry-abi.json`
- **IPFS upload fails**: Check `PINATA_JWT` is valid (test at https://api.pinata.cloud/data/testAuthentication)

## Key Files Reference

- `hardhat.config.js`: Network configs (Sepolia mainnet: 11155111, Arbitrum Sepolia: 421614)
- `test-addresses.json`: Live deployment addresses on Sepolia testnet
- `contributor-merkle-tree.json`: Pre-registered contributor commitment tree for anonymous mode
- `stix-sample.json`: Example STIX 2.1 bundle structure for IOC conversion

## STIX 2.1 Integration

The platform auto-converts IOC arrays to STIX format:
- IP → `[ipv4-addr:value = '...']`
- Domain → `[domain-name:value = '...']`
- MD5/SHA-1/SHA-256 → `[file:hashes.TYPE = '...']`

Use `STIXConverter.convertToSTIX(iocsArray)` to generate compliant bundles with RFC 4122 UUIDs.

## Oracle Service

Long-running automated bot (`scripts/oracle-service.js`):
- Fetches AbuseIPDB blacklist every 24h via cron
- Builds Merkle tree and uploads to Pinata
- Submits batch to `OracleIOCFeed` contract
- Runs as PM2 daemon: `npm run oracle:pm2` (logs: `npm run oracle:logs`)

**Critical**: Oracle must have ETH for gas and be registered as contributor before submitting.
