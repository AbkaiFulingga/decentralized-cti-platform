// scripts/test-threshold-3of3.js
//
// Read-only (no state changes) test of the 3/3 ThresholdGovernance logic.
// It uses approveBatch.staticCall(...) from each admin to verify who can still approve,
// and reads getBatchApprovalStatus(...) to show counts.
//
// Usage:
//   npx hardhat run scripts/test-threshold-3of3.js --network sepolia
//   npx hardhat run scripts/test-threshold-3of3.js --network arbitrumSepolia
//
const hre = require('hardhat');
const fs = require('fs');

function pickAddressFile(chainId) {
  return chainId === '421614' ? 'test-addresses-arbitrum.json' : 'test-addresses.json';
}

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  const testData = JSON.parse(fs.readFileSync(pickAddressFile(chainId), 'utf8'));

  const registry = await hre.ethers.getContractAt(
    'PrivacyPreservingRegistry',
    testData.PrivacyPreservingRegistry
  );
  const governance = await hre.ethers.getContractAt(
    'ThresholdGovernance',
    testData.ThresholdGovernance
  );

  const threshold = await governance.threshold();
  const adminCount = await governance.adminCount();

  console.log('Network chainId:', chainId);
  console.log('Governance:', testData.ThresholdGovernance);
  console.log('Registry:', testData.PrivacyPreservingRegistry);
  console.log('Admin count (contract):', adminCount.toString());
  console.log('Threshold (contract):', threshold.toString());

  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  const expectedAdmins = (testData.admins || []).map((a) => a.toLowerCase());

  console.log('\nAdmins (from address file):');
  for (const a of expectedAdmins) console.log(' -', a);

  console.log('\nAdmins (from signers):');
  console.log(' admin1:', admin1.address);
  console.log(' admin2:', admin2.address);
  console.log(' admin3:', admin3.address);

  // Pick a target batch: default = latest batch
  const batchCount = await registry.getBatchCount();
  if (batchCount === 0n) {
    console.log('\nNo batches exist on this network, cannot test approvals.');
    return;
  }

  const batchIndex = Number(batchCount - 1n);

  console.log(`\nTesting batchIndex=${batchIndex} (latest)`);

  const status = await governance.getBatchApprovalStatus(batchIndex);
  console.log('Current status:', {
    approvals: status[0].toString(),
    executed: status[1],
    createdAt: status[2].toString()
  });

  async function canApprove(label, signer) {
    try {
      await governance.connect(signer).approveBatch.staticCall(batchIndex);
      console.log(`✅ ${label} can approve (staticCall passes)`);
      return true;
    } catch (e) {
      console.log(`❌ ${label} cannot approve (staticCall reverts):`, e?.shortMessage || e?.message || e);
      return false;
    }
  }

  console.log('\nStatic-call simulation (no tx)');
  await canApprove('Admin1', admin1);
  await canApprove('Admin2', admin2);
  await canApprove('Admin3', admin3);

  console.log('\nExpectation for 3/3:');
  console.log(
    '- execution should only occur after 3 distinct admins have successfully called approveBatch on-chain.'
  );
  console.log(
    '- staticCall can only tell us whether an approval would revert given the current state; it does not increment counts.'
  );

  console.log('\nDone (read-only).');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
