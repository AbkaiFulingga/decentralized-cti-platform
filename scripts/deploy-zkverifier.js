/**
 * 🚀 Deploy zkSNARK Verifier Contracts
 * 
 * Deploys:
 * 1. Groth16Verifier.sol (auto-generated from circuit)
 * 2. ZKVerifier.sol (application wrapper)
 * 
 * Links ZKVerifier to PrivacyPreservingRegistry
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-zkverifier.js --network arbitrumSepolia
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const { buildPoseidon } = require('circomlibjs');
const { MerkleTree } = require('merkletreejs');

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔐 zkSNARK Verifier Deployment');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
  console.log('');

  // Load existing addresses
  const addressesPath = path.join(__dirname, '../test-addresses-arbitrum.json');
  let addresses = {};
  
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
    console.log('📋 Existing Deployment:');
    console.log(`   Registry: ${addresses.PrivacyPreservingRegistry}`);
    console.log('');
  } else {
    console.error('❌ Error: PrivacyPreservingRegistry not deployed');
    console.log('   Deploy main contracts first:');
    console.log('   npx hardhat run scripts/deployComplete.js --network arbitrumSepolia');
    process.exit(1);
  }

  // Step 1: Deploy Groth16Verifier
  console.log('─────────────────────────────────────────────────────────');
  console.log('📜 Step 1: Deploying Groth16Verifier (auto-generated)...');
  console.log('─────────────────────────────────────────────────────────');
  
  const Groth16Verifier = await ethers.getContractFactory('Groth16Verifier');
  console.log('   Deploying contract...');
  
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  
  const groth16Address = await groth16Verifier.getAddress();
  console.log(`✅ Groth16Verifier deployed: ${groth16Address}`);
  console.log('');

  // Step 2: Build initial Merkle root from existing contributors
  console.log('─────────────────────────────────────────────────────────');
  console.log('🌳 Step 2: Building initial contributor Merkle tree...');
  console.log('─────────────────────────────────────────────────────────');
  
  const Registry = await ethers.getContractAt(
    'PrivacyPreservingRegistry',
    addresses.PrivacyPreservingRegistry
  );
  
  // Get contributor registered events
  const filter = Registry.filters.ContributorRegistered();
  const events = await Registry.queryFilter(filter);
  
  console.log(`   Found ${events.length} registered contributors`);
  
  let initialMerkleRoot;
  
  if (events.length > 0) {
    // Build Merkle tree
    const poseidon = await buildPoseidon();
    
    const contributors = events.map(event => event.args.contributor);
    console.log(`   Building tree with ${contributors.length} contributors...`);
    
    const leaves = contributors.map(addr => {
      const addrBigInt = BigInt(addr);
      return poseidon.F.toString(poseidon([addrBigInt]));
    });
    
    const tree = new MerkleTree(leaves, (data) => {
      const input = Array.isArray(data) ? data : [data];
      const hash = poseidon(input.map(x => BigInt(x)));
      return poseidon.F.toString(hash);
    }, { sortPairs: true });
    
    initialMerkleRoot = '0x' + tree.getRoot().toString('hex');
    console.log(`   Merkle root: ${initialMerkleRoot}`);
    
  } else {
    console.log('   No contributors yet, using zero root');
    initialMerkleRoot = '0x' + '0'.repeat(64);
  }
  console.log('');

  // Step 3: Deploy ZKVerifier
  console.log('─────────────────────────────────────────────────────────');
  console.log('🔐 Step 3: Deploying ZKVerifier (application wrapper)...');
  console.log('─────────────────────────────────────────────────────────');
  
  const ZKVerifier = await ethers.getContractFactory('ZKVerifier');
  console.log('   Deploying contract...');
  console.log(`   Groth16Verifier: ${groth16Address}`);
  console.log(`   Initial Merkle root: ${initialMerkleRoot}`);
  
  const zkVerifier = await ZKVerifier.deploy(groth16Address, initialMerkleRoot);
  await zkVerifier.waitForDeployment();
  
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log(`✅ ZKVerifier deployed: ${zkVerifierAddress}`);
  console.log('');

  // Step 4: Link ZKVerifier to Registry
  console.log('─────────────────────────────────────────────────────────');
  console.log('🔗 Step 4: Linking ZKVerifier to Registry...');
  console.log('─────────────────────────────────────────────────────────');
  
  console.log('   Setting registry in ZKVerifier...');
  const setRegistryTx = await zkVerifier.setRegistry(addresses.PrivacyPreservingRegistry);
  await setRegistryTx.wait();
  console.log('✅ Registry address set in ZKVerifier');
  
  // Note: Need to add setZKVerifier() function to PrivacyPreservingRegistry
  console.log('');
  console.log('⚠️  Manual step required:');
  console.log('   Add setZKVerifier() to PrivacyPreservingRegistry contract');
  console.log('   Or call from admin if function exists');
  console.log('');

  // Step 5: Save addresses
  console.log('─────────────────────────────────────────────────────────');
  console.log('💾 Step 5: Saving deployment addresses...');
  console.log('─────────────────────────────────────────────────────────');
  
  addresses.Groth16Verifier = groth16Address;
  addresses.ZKVerifier = zkVerifierAddress;
  addresses.initialMerkleRoot = initialMerkleRoot;
  
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(addresses, null, 2)
  );
  
  console.log(`✅ Addresses saved to ${addressesPath}`);
  console.log('');

  // Display summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ zkSNARK Verifier Deployment Complete!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Deployed Contracts:');
  console.log(`   Groth16Verifier: ${groth16Address}`);
  console.log(`   ZKVerifier: ${zkVerifierAddress}`);
  console.log(`   Registry: ${addresses.PrivacyPreservingRegistry}`);
  console.log('');
  console.log('🔐 Configuration:');
  console.log(`   Initial Merkle root: ${initialMerkleRoot}`);
  console.log(`   Contributors in tree: ${events.length}`);
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('   1. Update PrivacyPreservingRegistry with zkSNARK support');
  console.log('   2. Generate a test proof:');
  console.log(`      node scripts/zkp/generate-zk-proof.js ${deployer.address} 12345`);
  console.log('   3. Submit anonymous batch:');
  console.log('      node scripts/zkp/submit-with-proof.js');
  console.log('');
  console.log('📊 Gas Costs:');
  const groth16Gas = (await groth16Verifier.deploymentTransaction()).gasLimit;
  const zkVerifierGas = (await zkVerifier.deploymentTransaction()).gasLimit;
  console.log(`   Groth16Verifier: ${groth16Gas.toString()} gas`);
  console.log(`   ZKVerifier: ${zkVerifierGas.toString()} gas`);
  console.log('');
  console.log('🔒 Security Note:');
  console.log('   Circuit hash: 61dca7b1 47277ee9 44f745dd 0d4ca5c8');
  console.log('   Constraints: 10,918');
  console.log('   Security level: 128-bit computational soundness');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
