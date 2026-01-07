/**
 * Debug zkSNARK verifier wiring on-chain.
 *
 * - Generates a proof using the SAME frontend artifacts as the UI
 * - Calls registry.getZKVerifier() to see what verifier is configured
 * - Calls verifier.verifyAndRegisterProof(...) and/or Groth16Verifier.verifyProof(...) directly
 *
 * Usage: node scripts/debug-zk-verifier.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const hre = require('hardhat');
  const { ethers } = hre;

  const rpcUrl = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL;
  const pk = process.env.PRIVATE_KEY_ADMIN1 || process.env.ORACLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!rpcUrl) throw new Error('Missing ARBITRUM_RPC (or ARBITRUM_RPC_URL) in .env');
  if (!pk) throw new Error('Missing PRIVATE_KEY_ADMIN1 (or ORACLE_PRIVATE_KEY / PRIVATE_KEY) in .env');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  const addresses = JSON.parse(fs.readFileSync('test-addresses-arbitrum.json', 'utf8'));
  const registryAddress = addresses.PrivacyPreservingRegistry;
  if (!registryAddress) throw new Error('Missing PrivacyPreservingRegistry in test-addresses-arbitrum.json');

  const contributorTree = JSON.parse(fs.readFileSync('contributor-merkle-tree.json', 'utf8'));
  const proofEntry = (contributorTree.proofs || []).find(
    (p) => (p.address || '').toLowerCase() === signer.address.toLowerCase()
  );
  if (!proofEntry) throw new Error(`Signer not found in contributor tree: ${signer.address}`);

  // Build circuit inputs (match scripts/check-frontend-prover.js)
  const { buildPoseidon } = require('circomlibjs');
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const nonce = BigInt(Date.now());
  const addrBig = BigInt(signer.address);
  const commitment = F.toObject(poseidon([addrBig, nonce]));

  const input = {
    commitment: commitment.toString(),
    merkleRoot: BigInt(contributorTree.root).toString(),
    address: addrBig.toString(),
    nonce: nonce.toString(),
    merkleProof: proofEntry.proof.map((x) => BigInt(x).toString()),
    merklePathIndices: proofEntry.pathIndices
  };

  const snarkjs = require('snarkjs');
  const wasmPath = path.join(__dirname, '../cti-frontend/public/circuits/contributor-proof.wasm');
  const zkeyPath = path.join(__dirname, '../cti-frontend/public/circuits/contributor-proof_final.zkey');

  console.log('[debug-zk-verifier] registry', registryAddress);
  console.log('[debug-zk-verifier] signer', signer.address);
  console.log('[debug-zk-verifier] merkleRoot(hex)', contributorTree.root);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
  console.log('[debug-zk-verifier] proof ok, publicSignals', publicSignals);

  // Format for solidity
  const pA = [proof.pi_a[0], proof.pi_a[1]];
  const pB = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]]
  ];
  const pC = [proof.pi_c[0], proof.pi_c[1]];
  const pub = publicSignals.map((s) => BigInt(s));

  const Registry = await hre.ethers.getContractFactory('PrivacyPreservingRegistry');
  const registry = Registry.attach(registryAddress).connect(signer);

  let zkVerifierAddr;
  try {
    zkVerifierAddr = await registry.getZKVerifier();
  } catch (e) {
    console.log('[debug-zk-verifier] registry.getZKVerifier() failed:', e.shortMessage || e.message);
  }

  console.log('[debug-zk-verifier] registry.getZKVerifier()', zkVerifierAddr);
  console.log('[debug-zk-verifier] addresses.zkVerifier', addresses.zkVerifier);
  console.log('[debug-zk-verifier] addresses.groth16Verifier', addresses.groth16Verifier);

  // Try calling configured verifier (assume ZKVerifier wrapper)
  if (zkVerifierAddr && zkVerifierAddr !== ethers.ZeroAddress) {
    const ZKVerifier = await hre.ethers.getContractFactory('ZKVerifier');
    const v = ZKVerifier.attach(zkVerifierAddr).connect(signer);

    try {
      const ok = await v.verifyAndRegisterProof.staticCall(pA, pB, pC, pub);
      console.log('[debug-zk-verifier] verifyAndRegisterProof.staticCall =>', ok);
    } catch (e) {
      console.log('[debug-zk-verifier] verifyAndRegisterProof.staticCall reverted:', e.shortMessage || e.message);
    }

    // Some variants only expose verifyProof on the groth16 verifier
    try {
      const gvAddr = await v.groth16Verifier();
      console.log('[debug-zk-verifier] v.groth16Verifier()', gvAddr);
    } catch (e) {
      // ignore
    }
  }

  // Try direct Groth16 verifier call if we have it
  if (addresses.groth16Verifier) {
    try {
      const Groth16Verifier = await hre.ethers.getContractFactory('Groth16Verifier');
      const gv = Groth16Verifier.attach(addresses.groth16Verifier).connect(signer);
      const ok = await gv.verifyProof.staticCall(pA, pB, pC, pub);
      console.log('[debug-zk-verifier] Groth16Verifier.verifyProof.staticCall =>', ok);
    } catch (e) {
      console.log('[debug-zk-verifier] Groth16Verifier.verifyProof.staticCall reverted:', e.shortMessage || e.message);
    }
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
