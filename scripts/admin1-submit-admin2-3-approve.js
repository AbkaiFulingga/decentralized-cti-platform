// scripts/admin1-submit-admin2-3-approve.js
//
// One-click flow:
// 1) Ensure admin1 is a contributor (STANDARD tier by default)
// 2) Submit a small public IOC batch as admin1
// 3) Approve it as admin2, then admin3 (ThresholdGovernance)
//
// Usage (examples):
//   npx hardhat run scripts/admin1-submit-admin2-3-approve.js --network sepolia
//   npx hardhat run scripts/admin1-submit-admin2-3-approve.js --network arbitrumSepolia
//
// Optional env vars:
//   CTI_IOCS="8.8.8.8,malicious.com,deadbeef"
//   CTI_STAKE_TIER_ETH="0.05"   (0.01/0.05/0.10 depending on your contract)
//   CTI_USE_PINATA=0            (default 0; uses placeholder CID unless you wire IPFS)
//   CTI_IPFS_CID="manual-cid"  (if provided, used as ipfsCid)
//
const hre = require('hardhat');
const fs = require('fs');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

function pickAddressFile(chainId) {
  return chainId === '421614' ? 'test-addresses-arbitrum.json' : 'test-addresses.json';
}

function parseIocsEnv() {
  const raw = (process.env.CTI_IOCS || '').trim();
  if (!raw) return ['8.8.8.8', 'malicious.com', 'deadbeefcafebabe1234567890abcdef'];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureContributorStandard(registry, admin1) {
  const contributor = await registry.contributors(admin1.address);
  // Common layouts:
  // - PrivacyPreservingRegistry: (submissions, stakedAmount, reputation, lastSubmission, tierStake, isActive)
  const isActive = Boolean(contributor?.[5]);

  if (isActive) return { already: true, contributor };

  const tierEth = (process.env.CTI_STAKE_TIER_ETH || '0.05').trim();
  const stake = hre.ethers.parseEther(tierEth);

  console.log(`Registering admin1 as contributor (tier=${tierEth} ETH)...`);
  const tx = await registry.connect(admin1).registerContributor(stake, { value: stake });
  const receipt = await tx.wait();
  return { already: false, receipt };
}

async function submitPublicBatch(registry, admin1, { ipfsCid, merkleRoot }) {
  // PrivacyPreservingRegistry.addBatch(string,bytes32,bool,bytes32,bytes)
  // Contract requires a small submission fee (1% of an estimated gas cost).
  // Use a safe value so this script works across typical gasprices.
  const submissionFee = hre.ethers.parseEther('0.001');

  // Preflight: estimateGas + staticCall helps surface common failures.
  try {
    await registry
      .connect(admin1)
      .addBatch.estimateGas(ipfsCid, merkleRoot, true, hre.ethers.ZeroHash, '0x', { value: submissionFee });
  } catch (e) {
    console.log('⚠️  estimateGas failed:', e?.shortMessage || e?.message || e);
  }

  try {
    await registry
      .connect(admin1)
      .addBatch.staticCall(ipfsCid, merkleRoot, true, hre.ethers.ZeroHash, '0x', { value: submissionFee });
  } catch (e) {
    console.log('⚠️  staticCall failed:', e?.shortMessage || e?.message || e);
  }

  const tx = await registry
    .connect(admin1)
    .addBatch(ipfsCid, merkleRoot, true, hre.ethers.ZeroHash, '0x', { value: submissionFee });
  const receipt = await tx.wait();

  // Parse BatchAdded(index, cid, ...)
  const batchSubmitted = receipt.logs
    .map((l) => {
      try {
        return registry.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p && p.name === 'BatchAdded');

  const batchIndex = batchSubmitted ? Number(batchSubmitted.args.index) : null;
  return { receipt, batchIndex };
}

async function approve(governance, signer, batchIndex) {
  // Preflight: if this would revert, staticCall will throw.
  await governance.connect(signer).approveBatch.staticCall(batchIndex);

  const tx = await governance.connect(signer).approveBatch(batchIndex);
  const receipt = await tx.wait();
  return { receipt };
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  // Fail fast if we somehow end up on Hardhat's in-process network.
  // This avoids confusing "reverted" errors when using Sepolia addresses against localhost.
  if (chainId === '31337') {
    throw new Error(
      'Connected to Hardhat localhost (31337). Make sure you pass --network sepolia or --network arbitrumSepolia and that your Hardhat runner actually honors it.'
    );
  }
  const addressFile = pickAddressFile(chainId);

  const testData = JSON.parse(fs.readFileSync(addressFile, 'utf8'));

  const registryAddr = testData.PrivacyPreservingRegistry;
  const governanceAddr = testData.ThresholdGovernance;

  if (!registryAddr || !governanceAddr) {
    throw new Error(
      `Missing addresses in ${addressFile}. Need PrivacyPreservingRegistry and ThresholdGovernance.`
    );
  }

  const [admin1, admin2, admin3] = await hre.ethers.getSigners();

  console.log('Network chainId:', chainId);
  console.log('Admin1:', admin1.address);
  console.log('Admin2:', admin2.address);
  console.log('Admin3:', admin3.address);
  console.log('Registry:', registryAddr);
  console.log('Governance:', governanceAddr);

  const registry = await hre.ethers.getContractAt('PrivacyPreservingRegistry', registryAddr);
  const governance = await hre.ethers.getContractAt('ThresholdGovernance', governanceAddr);

  // 1) Ensure admin1 is a contributor
  await ensureContributorStandard(registry, admin1);

  // 2) Build merkle root from IOCs
  const iocs = parseIocsEnv();
  const leaves = iocs.map((x) => keccak256(x));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = tree.getHexRoot();

  // 3) Decide CID
  const ipfsCid = (process.env.CTI_IPFS_CID || '').trim() || `dev-cid-${Date.now()}`;

  console.log('\nSubmitting batch as admin1...');
  console.log('IOCs:', iocs);
  console.log('MerkleRoot:', merkleRoot);
  console.log('IPFS CID:', ipfsCid);

  const { receipt: submitReceipt, batchIndex } = await submitPublicBatch(registry, admin1, {
    ipfsCid,
    merkleRoot
  });

  console.log('Submit tx:', submitReceipt.hash);

  if (batchIndex === null) {
    console.log(
      '⚠️  Could not parse BatchSubmitted event to determine batchIndex. Will fallback to latest batchCount-1.'
    );
    const batchCount = await registry.getBatchCount();
    const fallbackIndex = Number(batchCount) - 1;
    console.log('Fallback batchIndex:', fallbackIndex);

    await runApprovalsAndReport({ registry, governance, admin2, admin3, batchIndex: fallbackIndex });
    return;
  }

  console.log('Batch index:', batchIndex);

  await runApprovalsAndReport({ registry, governance, admin2, admin3, batchIndex });
}

async function runApprovalsAndReport({ registry, governance, admin2, admin3, batchIndex }) {
  console.log('\nApproving as admin2...');
  try {
    const { receipt } = await approve(governance, admin2, batchIndex);
    console.log('Admin2 approve tx:', receipt.hash);
  } catch (e) {
    console.log('Admin2 approval skipped/failed:', e?.message || e);
  }

  console.log('\nApproving as admin3...');
  try {
    const { receipt } = await approve(governance, admin3, batchIndex);
    console.log('Admin3 approve tx:', receipt.hash);
  } catch (e) {
    console.log('Admin3 approval skipped/failed:', e?.message || e);
  }

  const status = await governance.getBatchApprovalStatus(batchIndex);
  const approvals = Number(status[0]);
  const executed = Boolean(status[1]);

  const batch = await registry.getBatch(batchIndex);
  const accepted = Boolean(batch[3]);

  console.log('\nFinal status:');
  console.log(`  Approvals: ${approvals}`);
  console.log(`  Executed (gov): ${executed}`);
  console.log(`  Accepted (registry): ${accepted}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
