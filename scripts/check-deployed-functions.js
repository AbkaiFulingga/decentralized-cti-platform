const { ethers } = require("hardhat");

async function main() {
  const addresses = require('../test-addresses-arbitrum.json');
  
  console.log('Checking PrivacyPreservingRegistry at:', addresses.PrivacyPreservingRegistry);
  
  const registry = await ethers.getContractAt(
    'PrivacyPreservingRegistry',
    addresses.PrivacyPreservingRegistry
  );
  
  console.log('\n=== Contract Interface ===');
  
  // Try calling zkVerifier()
  try {
    const zkVerifier = await registry.zkVerifier();
    console.log('✅ zkVerifier():', zkVerifier);
  } catch (e) {
    console.log('❌ zkVerifier() not found:', e.message);
  }
  
  // Check if setZKVerifier exists
  try {
    const iface = registry.interface;
    const func = iface.getFunction('addBatchWithZKProof');
    console.log('✅ addBatchWithZKProof exists:', func.format());
  } catch (e) {
    console.log('❌ addBatchWithZKProof not found:', e.message);
  }
  
  // List all functions
  console.log('\n=== All Functions ===');
  const fragment = registry.interface.fragments.filter(f => f.type === 'function');
  fragment.forEach(f => {
    console.log(' -', f.format());
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
