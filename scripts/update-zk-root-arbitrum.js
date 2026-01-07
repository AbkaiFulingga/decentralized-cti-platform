// scripts/update-zk-root-arbitrum.js
// Updates the on-chain ZKVerifier's accepted contributor Merkle root
// so browser-generated proofs (based on contributor-merkle-tree.json) verify again.
//
// Usage:
//   npx hardhat run scripts/update-zk-root-arbitrum.js --network arbitrumSepolia
//
// Reads:
//   - test-addresses-arbitrum.json (PrivacyPreservingRegistry address)
//   - contributor-merkle-tree.json (root)
//
// Requires deployer/admin PRIVATE_KEY_ADMIN1 in .env that matches verifier owner.

const hre = require('hardhat');
const fs = require('fs');

function mustReadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

async function main() {
  const addrs = mustReadJson('./test-addresses-arbitrum.json');
  const tree = mustReadJson('./contributor-merkle-tree.json');

  if (!tree?.root) {
    throw new Error('contributor-merkle-tree.json missing root');
  }

  const rootHex = tree.root;
  const rootUint = BigInt(rootHex);

  const registryAddr = addrs.PrivacyPreservingRegistry;
  if (!registryAddr) {
    throw new Error('test-addresses-arbitrum.json missing PrivacyPreservingRegistry');
  }

  const [signer] = await hre.ethers.getSigners();
  const signerAddr = await signer.getAddress();

  const registry = await hre.ethers.getContractAt('PrivacyPreservingRegistry', registryAddr, signer);
  const zkVerifierAddr = await registry.zkVerifier();

  if (!zkVerifierAddr || zkVerifierAddr === hre.ethers.ZeroAddress) {
    throw new Error('Registry has no zkVerifier set (zkVerifier == 0x0)');
  }

  const zkVerifier = await hre.ethers.getContractAt('ZKVerifier', zkVerifierAddr, signer);
  const owner = await zkVerifier.owner();

  console.log('Network:', hre.network.name);
  console.log('Signer:', signerAddr);
  console.log('Registry:', registryAddr);
  console.log('ZKVerifier:', zkVerifierAddr);
  console.log('ZKVerifier.owner:', owner);
  console.log('New tree.root:', rootHex);
  console.log('New tree.root (uint):', rootUint.toString());

  if (owner.toLowerCase() !== signerAddr.toLowerCase()) {
    throw new Error('Signer is not ZKVerifier.owner; cannot update root');
  }

  const current = await zkVerifier.currentMerkleRoot();
  console.log('Current verifier root (uint):', current.toString());

  if (current === rootUint) {
    console.log('✅ Verifier already has this root; nothing to do.');
    return;
  }

  const tx = await zkVerifier.updateMerkleRoot(rootUint);
  console.log('⏳ Sent updateMerkleRoot tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Root updated in block:', receipt.blockNumber);

  const ok = await zkVerifier.validMerkleRoots(rootUint);
  console.log('Verifier validMerkleRoots(newRoot) =', ok);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
