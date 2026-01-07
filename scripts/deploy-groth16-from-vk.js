/**
 * Deploy a Groth16Verifier contract generated from a verifying key JSON.
 *
 * This is the standard snarkjs pattern:
 *   snarkjs zkey export solidityverifier <zkey> <verifier.sol>
 * But we generate a verifier into contracts/ and compile+deploy via Hardhat.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const hre = require('hardhat');
  const { ethers } = hre;

  const vkPath = path.join(__dirname, 'verification_key.from_zkey.json');
  if (!fs.existsSync(vkPath)) {
    throw new Error(`Missing VK JSON at ${vkPath}. Run: npx snarkjs zkey export verificationkey ...`);
  }

  // Generate solidity verifier source into contracts/generated/
  const outDir = path.join(__dirname, '..', 'contracts', 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  const verifierSolPath = path.join(outDir, 'Groth16Verifier_ContributorProof.sol');

  // Use snarkjs to generate the exact verifier corresponding to the zkey.
  // We shell out to snarkjs CLI because the library helper can be brittle across versions.
  const zkeyPath = path.join(__dirname, '..', 'cti-frontend', 'public', 'circuits', 'contributor-proof_final.zkey');
  if (!fs.existsSync(zkeyPath)) throw new Error(`Missing zkey: ${zkeyPath}`);

  console.log('[deploy-groth16-from-vk] generating solidity verifier...');
  execSync(
    `npx -s snarkjs zkey export solidityverifier "${zkeyPath}" "${verifierSolPath}"`,
    { stdio: 'inherit' }
  );

  // snarkjs emits `pragma solidity ^0.6.11;` + `contract Verifier { ... }`.
  // We rewrite to align with the repo's solidity version and give it a stable name.
  let src = fs.readFileSync(verifierSolPath, 'utf8');
  src = src.replace(/^pragma solidity\s+\^0\.6\.11\s*;/m, 'pragma solidity ^0.8.19;');
  // Keep the contract name stable for the deploy step below.
  // (snarkjs emits `contract Groth16Verifier { ... }`)
  // Ensure SPDX exists
  if (!src.includes('SPDX-License-Identifier')) {
    src = `// SPDX-License-Identifier: MIT\n${src}`;
  }
  fs.writeFileSync(verifierSolPath, src);
  console.log('[deploy-groth16-from-vk] wrote', verifierSolPath);

  console.log('[deploy-groth16-from-vk] compiling...');
  await hre.run('compile');

  console.log('[deploy-groth16-from-vk] deploying...');
  const Factory = await ethers.getContractFactory(
    'contracts/generated/Groth16Verifier_ContributorProof.sol:Groth16Verifier'
  );
  const verifier = await Factory.deploy();
  await verifier.waitForDeployment();

  const addr = await verifier.getAddress();
  console.log('[deploy-groth16-from-vk] deployed Groth16 verifier at', addr);

  // Persist deployment metadata
  const outJson = {
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    groth16Verifier: addr,
    source: 'cti-frontend/public/circuits/contributor-proof_final.zkey'
  };
  fs.writeFileSync(path.join(__dirname, 'deploy-groth16-from-vk.output.json'), JSON.stringify(outJson, null, 2));
  console.log('[deploy-groth16-from-vk] wrote scripts/deploy-groth16-from-vk.output.json');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
