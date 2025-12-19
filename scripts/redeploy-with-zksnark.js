const hre = require('hardhat');
const fs = require('fs');

async function main() {
  console.log('🚀 Deploying PrivacyPreservingRegistry with zkSNARK Support\n');
  
  const [deployer, admin2, admin3] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  // Load existing deployment info
  const zkVerifierDeployment = require('../deployments/zkverifier-arbitrum.json');
  const oldAddresses = require('../test-addresses-arbitrum.json');
  
  console.log('\n📋 Using existing contracts:');
  console.log('ZKVerifier:', zkVerifierDeployment.zkVerifier);
  console.log('Groth16Verifier:', zkVerifierDeployment.groth16Verifier);
  console.log('MerkleZKRegistry:', oldAddresses.MerkleZKRegistry);
  
  // Step 1: Deploy new PrivacyPreservingRegistry
  console.log('\n📦 Deploying PrivacyPreservingRegistry...');
  const PrivacyPreservingRegistry = await hre.ethers.getContractFactory('PrivacyPreservingRegistry');
  const registry = await PrivacyPreservingRegistry.deploy();
  await registry.waitForDeployment();
  
  const registryAddress = await registry.getAddress();
  console.log('✅ Registry deployed:', registryAddress);
  
  // Step 2: Link ZKVerifier
  console.log('\n🔗 Linking ZKVerifier...');
  const tx1 = await registry.setZKVerifier(zkVerifierDeployment.zkVerifier);
  await tx1.wait();
  console.log('✅ ZKVerifier linked');
  
  // Step 3: Link MerkleZKRegistry  
  console.log('\n🔗 Linking MerkleZKRegistry...');
  const tx2 = await registry.setMerkleZKRegistry(oldAddresses.MerkleZKRegistry);
  await tx2.wait();
  console.log('✅ MerkleZKRegistry linked');
  
  // Step 4: Deploy Governance
  console.log('\n📦 Deploying ThresholdGovernance...');
  const ThresholdGovernance = await hre.ethers.getContractFactory('ThresholdGovernance');
  const governance = await ThresholdGovernance.deploy(
    registryAddress,
    [deployer.address, admin2.address, admin3.address],
    2  // 2-of-3 threshold
  );
  await governance.waitForDeployment();
  
  const governanceAddress = await governance.getAddress();
  console.log('✅ Governance deployed:', governanceAddress);
  
  // Step 5: Link Governance to Registry
  console.log('\n🔗 Linking Governance to Registry...');
  const tx3 = await registry.setGovernance(governanceAddress);
  await tx3.wait();
  console.log('✅ Governance linked');
  
  // Step 6: Deploy StorageContribution
  console.log('\n📦 Deploying StorageContribution...');
  const StorageContribution = await hre.ethers.getContractFactory('StorageContribution');
  const storage = await StorageContribution.deploy(registryAddress);
  await storage.waitForDeployment();
  
  const storageAddress = await storage.getAddress();
  console.log('✅ Storage deployed:', storageAddress);
  
  // Step 7: Update test-addresses-arbitrum.json
  const newAddresses = {
    ...oldAddresses,
    PrivacyPreservingRegistry: registryAddress,
    ThresholdGovernance: governanceAddress,
    StorageContribution: storageAddress,
    zkVerifierLinked: true,
    redeployedAt: new Date().toISOString(),
    redeployReason: 'Added zkSNARK support via setZKVerifier()'
  };
  
  fs.writeFileSync(
    './test-addresses-arbitrum.json',
    JSON.stringify(newAddresses, null, 2)
  );
  
  console.log('\n✅ Deployment complete!');
  console.log('\n📝 New addresses:');
  console.log('Registry:', registryAddress);
  console.log('Governance:', governanceAddress);
  console.log('Storage:', storageAddress);
  console.log('\n🔗 Linked contracts:');
  console.log('ZKVerifier:', zkVerifierDeployment.zkVerifier);
  console.log('MerkleZKRegistry:', oldAddresses.MerkleZKRegistry);
  
  console.log('\n📝 Next steps:');
  console.log('1. Update frontend constants.js with new registry address');
  console.log('2. Clear browser cache');
  console.log('3. Test zkSNARK anonymous submission');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
