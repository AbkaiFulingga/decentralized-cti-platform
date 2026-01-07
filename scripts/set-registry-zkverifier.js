/**
 * Point the live PrivacyPreservingRegistry to a new ZKVerifier wrapper.
 */

const fs = require('fs');

async function main() {
  const hre = require('hardhat');
  const { ethers } = hre;

  const addresses = JSON.parse(fs.readFileSync('test-addresses-arbitrum.json', 'utf8'));
  const registryAddress = addresses.PrivacyPreservingRegistry;
  if (!registryAddress) throw new Error('Missing PrivacyPreservingRegistry in test-addresses-arbitrum.json');

  const newZkVerifier = process.env.NEW_ZKVERIFIER;
  if (!newZkVerifier) throw new Error('Set NEW_ZKVERIFIER to the new ZKVerifier address');

  console.log('[set-registry-zkverifier] network', hre.network.name);
  console.log('[set-registry-zkverifier] registry', registryAddress);
  console.log('[set-registry-zkverifier] newZkVerifier', newZkVerifier);

  const Registry = await ethers.getContractFactory('PrivacyPreservingRegistry');
  const registry = Registry.attach(registryAddress);

  // Preflight
  const current = await registry.getZKVerifier();
  console.log('[set-registry-zkverifier] current getZKVerifier()', current);

  const tx = await registry.setZKVerifier(newZkVerifier);
  console.log('[set-registry-zkverifier] tx', tx.hash);
  await tx.wait();

  const after = await registry.getZKVerifier();
  console.log('[set-registry-zkverifier] updated getZKVerifier()', after);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
