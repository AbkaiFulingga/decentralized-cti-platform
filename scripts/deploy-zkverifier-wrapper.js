/**
 * Deploy a new ZKVerifier wrapper pointing at a specific Groth16 verifier,
 * and initialized with the current contributor Merkle root.
 */

const fs = require('fs');

async function main() {
  const hre = require('hardhat');
  const { ethers } = hre;

  const addresses = JSON.parse(fs.readFileSync('test-addresses-arbitrum.json', 'utf8'));
  const contributorTree = JSON.parse(fs.readFileSync('contributor-merkle-tree.json', 'utf8'));

  const groth16Verifier = process.env.GROTH16_VERIFIER || addresses.groth16Verifier;
  if (!groth16Verifier) throw new Error('Missing groth16 verifier address (set GROTH16_VERIFIER or update test-addresses-arbitrum.json)');

  const merkleRoot = BigInt(contributorTree.root);

  console.log('[deploy-zkverifier-wrapper] network', hre.network.name);
  console.log('[deploy-zkverifier-wrapper] groth16Verifier', groth16Verifier);
  console.log('[deploy-zkverifier-wrapper] merkleRoot', contributorTree.root);

  const ZKVerifier = await ethers.getContractFactory('ZKVerifier');
  const v = await ZKVerifier.deploy(groth16Verifier, merkleRoot);
  await v.waitForDeployment();

  const addr = await v.getAddress();
  console.log('[deploy-zkverifier-wrapper] deployed ZKVerifier at', addr);

  fs.writeFileSync(
    'scripts/deploy-zkverifier-wrapper.output.json',
    JSON.stringify(
      {
        network: hre.network.name,
        deployedAt: new Date().toISOString(),
        zkVerifier: addr,
        groth16Verifier,
        merkleRoot: contributorTree.root
      },
      null,
      2
    )
  );
  console.log('[deploy-zkverifier-wrapper] wrote scripts/deploy-zkverifier-wrapper.output.json');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
