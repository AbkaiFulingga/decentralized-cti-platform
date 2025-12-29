// scripts/deployL1SepoliaCIDView.js
//
// Purpose:
// Deploy L1 (Sepolia) contracts using the L1-only registry variant that stores plaintext CIDs on-chain.
// This avoids relying on eth_getLogs for CID retrieval.
//
// IMPORTANT:
// - This script is intended for Sepolia ONLY.
// - Do NOT run this on Arbitrum Sepolia (L2).

const hre = require('hardhat');
const fs = require('fs');

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  if (chainId !== '11155111') {
    throw new Error(`Refusing to run: expected Sepolia (11155111) but got chainId=${chainId}`);
  }

  console.log('=== Sepolia L1 Deploy (CID View Registry) ===');
  const [deployer, a2, a3] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH');

  // Deploy registry (L1 variant)
  console.log('\n1) Deploying PrivacyPreservingRegistryL1...');
  const Registry = await hre.ethers.getContractFactory('PrivacyPreservingRegistryL1');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log('✅ Registry(L1):', registryAddress);

  // Admin set: keep same 3-of-3 behavior
  const admins = [deployer?.address, a2?.address || deployer.address, a3?.address || deployer.address];
  const threshold = 3;

  console.log('\n2) Deploying ThresholdGovernance...');
  const Governance = await hre.ethers.getContractFactory('ThresholdGovernance');
  const governance = await Governance.deploy(admins, threshold, registryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log('✅ Governance:', governanceAddress);

  console.log('\n3) Deploying StorageContribution...');
  const Storage = await hre.ethers.getContractFactory('StorageContribution');
  const storage = await Storage.deploy(registryAddress, governanceAddress);
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();
  console.log('✅ Storage:', storageAddress);

  console.log('\n4) Linking governance to registry...');
  const tx = await registry.setGovernance(governanceAddress);
  await tx.wait();
  console.log('✅ Linked');

  const microStake = await registry.MICRO_STAKE();
  const standardStake = await registry.STANDARD_STAKE();
  const premiumStake = await registry.PREMIUM_STAKE();

  const deploymentData = {
    network: 'sepolia',
    chainId: '11155111',
    PrivacyPreservingRegistry: registryAddress,
    ThresholdGovernance: governanceAddress,
    StorageContribution: storageAddress,
    admins,
    threshold,
    features: {
      tieredStaking: true,
      adminRewards: true,
      communityFeedback: true,
      badActorDetection: true,
      storageContribution: true,
      l1CidView: true
    },
    stakingTiers: {
      micro: { amount: hre.ethers.formatEther(microStake), reputationBonus: 7 },
      standard: { amount: hre.ethers.formatEther(standardStake), reputationBonus: 10 },
      premium: { amount: hre.ethers.formatEther(premiumStake), reputationBonus: 15 }
    },
    // Helpful when setting deploymentBlock in the frontend
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync('test-addresses.json', JSON.stringify(deploymentData, null, 2));
  console.log('\n✅ Wrote test-addresses.json (Sepolia)');

  console.log('\nExplorer Links:');
  console.log('Registry:', `https://sepolia.etherscan.io/address/${registryAddress}`);
  console.log('Governance:', `https://sepolia.etherscan.io/address/${governanceAddress}`);
  console.log('Storage:', `https://sepolia.etherscan.io/address/${storageAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
