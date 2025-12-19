const hre = require('hardhat');

async function main() {
  const addresses = require('../test-addresses-arbitrum.json');
  
  console.log('Checking zkVerifier configuration...\n');
  
  const registry = await hre.ethers.getContractAt('PrivacyPreservingRegistry', addresses.PrivacyPreservingRegistry);
  const zkVerifier = await registry.zkVerifier();
  
  console.log('Registry address:', addresses.PrivacyPreservingRegistry);
  console.log('zkVerifier address:', zkVerifier);
  console.log('Is set:', zkVerifier !== '0x0000000000000000000000000000000000000000');
  
  if (zkVerifier === '0x0000000000000000000000000000000000000000') {
    console.log('\n❌ ERROR: zkVerifier not set! You need to call setZKVerifier() first.');
  } else {
    console.log('\n✅ zkVerifier is configured');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
