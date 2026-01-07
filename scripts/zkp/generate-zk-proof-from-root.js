/**
 * Generate a zk proof using the CURRENT on-chain ZKVerifier merkle root.
 *
 * This avoids "root not valid" failures.
 *
 * Usage:
 *   ZKP_CONTRIBUTOR=0x... ZKP_NONCE=123 npx hardhat run scripts/zkp/generate-zk-proof-from-root.js --network arbitrumSepolia
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
require('dotenv').config();

const WASM_PATH = path.join(__dirname, '../../circuits/contributor-proof_js/contributor-proof.wasm');
const ZKEY_PATH = path.join(__dirname, '../../circuits/contributor-proof_final.zkey');
const VKEY_PATH = path.join(__dirname, '../../circuits/verification_key.json');
const ADDRESSES_PATH = path.join(__dirname, '../../test-addresses-arbitrum.json');

function padArray(arr, length, fillValue = '0') {
  const out = [...arr];
  while (out.length < length) out.push(fillValue);
  return out;
}

function padArrayNumbers(arr, length, fillValue = 0) {
  const out = [...arr];
  while (out.length < length) out.push(fillValue);
  return out;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const contributorAddress = process.env.ZKP_CONTRIBUTOR;
  const nonce = process.env.ZKP_NONCE || Math.floor(Math.random() * 1_000_000);

  if (!contributorAddress || !ethers.isAddress(contributorAddress)) {
    throw new Error('Set env var ZKP_CONTRIBUTOR to a valid address');
  }

  if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH) || !fs.existsSync(VKEY_PATH)) {
    throw new Error('Circuit artifacts missing. Run: cd circuits && ./setup-circuit.sh');
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  const net = await ethers.provider.getNetwork();
  const expectedChainId = BigInt(addresses.chainId || 421614);
  if (net.chainId !== expectedChainId) {
    throw new Error(`Wrong chainId ${net.chainId} expected ${expectedChainId}`);
  }

  const zkVerifierAddr = addresses.zkVerifier;
  const zkVerifier = await ethers.getContractAt('ZKVerifier', zkVerifierAddr);
  const onChainRoot = await zkVerifier.currentMerkleRoot();

  console.log('Using on-chain contributor root:', '0x' + onChainRoot.toString(16));

  const poseidon = await buildPoseidon();
  const addrBigInt = BigInt(contributorAddress);
  const nonceBigInt = BigInt(nonce);
  const commitment = poseidon.F.toString(poseidon([addrBigInt, nonceBigInt]));

  // For now: assume contributor leaf is "address hashed" and is the left-most leaf.
  // Path is 20 zeros. This matches the circuit shape and is enough for a live demo
  // if the on-chain root was created under the same assumption.
  const TREE_DEPTH = 20;
  const merkleProof = Array(TREE_DEPTH).fill('0');
  const merklePathIndices = Array(TREE_DEPTH).fill(0);

  const input = {
    commitment: BigInt(commitment).toString(),
    merkleRoot: onChainRoot.toString(),
    address: addrBigInt.toString(),
    nonce: nonceBigInt.toString(),
    merkleProof: padArray(merkleProof, TREE_DEPTH, '0'),
    merklePathIndices: padArrayNumbers(merklePathIndices, TREE_DEPTH, 0)
  };

  const start = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
  const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  const ok = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  if (!ok) throw new Error('Local verification failed');

  const solidityProof = {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
    input: publicSignals
  };

  const outDir = path.join(__dirname, '../../zkp-proofs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `proof-onchainroot-${stamp}.json`);

  const out = {
    timestamp: new Date().toISOString(),
    contributor: contributorAddress,
    nonce: nonce.toString(),
    commitment,
    merkleRoot: '0x' + onChainRoot.toString(16),
    proof: solidityProof,
    generationTimeMs: Date.now() - start
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Saved:', outPath);
  console.log('PublicSignals:', publicSignals);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
