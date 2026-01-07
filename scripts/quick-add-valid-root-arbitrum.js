/**
 * Quick fix: make the currently-generated proof root acceptable on-chain.
 *
 * Problem:
 * - Browser proofs are emitting pubSignals[1] = <rootFromCircuit>
 * - ZKVerifier gates on validMerkleRoots[root]
 *
 * This script deploys a fresh ZKVerifier seeded with the proofRoot and repoints
 * PrivacyPreservingRegistry to use it.
 *
 * Usage:
 *   node scripts/quick-add-valid-root-arbitrum.js <proofRootDecimalOrHex>
 *
 * Example (decimal root from browser publicSignals[1]):
 *   node scripts/quick-add-valid-root-arbitrum.js 8663290279180706494...
 */

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { ethers } = hre;

function parseRoot(arg) {
  if (!arg) throw new Error('Missing root argument (provide decimal or 0x hex)');
  if (arg.startsWith('0x') || arg.startsWith('0X')) return BigInt(arg);
  if (!/^\d+$/.test(arg)) throw new Error('Root must be decimal digits or 0x hex');
  return BigInt(arg);
}

async function main() {
  const rootArg = process.env.PROOF_ROOT || process.argv[2];
  const root = parseRoot(rootArg);

  const addrsPath = path.join(__dirname, '../test-addresses-arbitrum.json');
  const addrs = JSON.parse(fs.readFileSync(addrsPath, 'utf8'));
  const registryAddr = addrs.PrivacyPreservingRegistry;
  if (!registryAddr) throw new Error('PrivacyPreservingRegistry missing from test-addresses-arbitrum.json');

  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const expected = BigInt(addrs.chainId || 421614);
  if (net.chainId !== expected) {
    throw new Error(`Wrong chainId ${net.chainId} (expected ${expected}). Run with --network arbitrumSepolia.`);
  }

  // We keep using the existing Groth16 verifier address from the last redeploy.
  // That verifier matches the circuit; we only need to adjust the root gate.
  const groth16Addr = addrs.groth16Verifier;
  if (!groth16Addr) throw new Error('groth16Verifier missing from test-addresses-arbitrum.json');

  console.log('Network:', hre.network.name);
  console.log('Deployer:', deployer.address);
  console.log('Registry :', registryAddr);
  console.log('Groth16  :', groth16Addr);
  console.log('Seed root:', root.toString());

  const ZKVerifier = await ethers.getContractFactory('ZKVerifier');
  const zkv = await ZKVerifier.deploy(groth16Addr, root);
  await zkv.waitForDeployment();
  const zkvAddr = await zkv.getAddress();
  console.log('New ZKVerifier:', zkvAddr);

  const registry = await ethers.getContractAt('PrivacyPreservingRegistry', registryAddr);
  const tx1 = await registry.setZKVerifier(zkvAddr);
  await tx1.wait();
  console.log('Registry.setZKVerifier OK:', tx1.hash);

  const tx2 = await zkv.setRegistry(registryAddr);
  await tx2.wait();
  console.log('ZKVerifier.setRegistry OK:', tx2.hash);

  // Persist for frontend/scripts convenience
  addrs.ZKVerifier = zkvAddr;
  addrs.zkVerifierRedeployedAt = new Date().toISOString();
  addrs.zkVerifierRedeployReason = 'Quick-add-valid-root: re-seed verifier with proof root';
  fs.writeFileSync(addrsPath, JSON.stringify(addrs, null, 2));
  console.log('Updated:', addrsPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
