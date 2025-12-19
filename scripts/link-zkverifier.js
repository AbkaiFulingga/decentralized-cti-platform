const hre = require('hardhat');

async function main() {
  console.log('🔗 Linking ZKVerifier to PrivacyPreservingRegistry\n');
  
  const addresses = require('../test-addresses-arbitrum.json');
  const zkVerifierDeployment = require('../deployments/zkverifier-arbitrum.json');
  
  const registryAddress = addresses.PrivacyPreservingRegistry;
  const zkVerifierAddress = zkVerifierDeployment.zkVerifier;
  
  console.log('Registry:', registryAddress);
  console.log('ZKVerifier:', zkVerifierAddress);
  
  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log('\n🔑 Using account:', signer.address);
  
  // Get contract instance
  const registry = await hre.ethers.getContractAt('PrivacyPreservingRegistry', registryAddress);
  
  // Check current zkVerifier
  try {
    const currentZKVerifier = await registry.zkVerifier();
    console.log('\nCurrent zkVerifier:', currentZKVerifier);
    
    if (currentZKVerifier.toLowerCase() === zkVerifierAddress.toLowerCase()) {
      console.log('✅ ZKVerifier already set correctly!');
      return;
    }
  } catch (error) {
    console.log('⚠️  Could not read current zkVerifier (might not be supported)');
  }
  
  // Set zkVerifier
  console.log('\n📤 Calling setZKVerifier()...');
  const tx = await registry.setZKVerifier(zkVerifierAddress);
  
  console.log('TX hash:', tx.hash);
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await tx.wait();
  
  console.log('✅ Transaction confirmed!');
  console.log('Block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  
  // Verify
  const newZKVerifier = await registry.zkVerifier();
  console.log('\n🔍 Verification:');
  console.log('Expected:', zkVerifierAddress);
  console.log('Actual:', newZKVerifier);
  
  if (newZKVerifier.toLowerCase() === zkVerifierAddress.toLowerCase()) {
    console.log('\n✅ SUCCESS! ZKVerifier linked to registry');
    console.log('\n📝 Next steps:');
    console.log('1. Clear browser cache');
    console.log('2. Try anonymous submission with zkSNARK proof');
    console.log('3. Transaction should now succeed!');
  } else {
    console.log('\n❌ ERROR: Verification failed');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
