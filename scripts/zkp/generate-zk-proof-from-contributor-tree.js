/**
 * Generate a zk proof using contributor-merkle-tree.json (Poseidon tree, depth 20).
 *
 * This matches the on-chain ZKVerifier root only after
 * `scripts/update-merkle-root-onchain.js` has been called.
 *
 * Usage:
 *   ZKP_CONTRIBUTOR=0x... ZKP_NONCE=123 npx hardhat run scripts/zkp/generate-zk-proof-from-contributor-tree.js --network arbitrumSepolia
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
const TREE_PATH = path.join(__dirname, '../../contributor-merkle-tree.json');
const ADDRESSES_PATH = path.join(__dirname, '../../test-addresses-arbitrum.json');

function strip0x(hex) {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

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
  const contributorAddress = process.env.ZKP_CONTRIBUTOR;
  const nonce = process.env.ZKP_NONCE || Math.floor(Math.random() * 1_000_000);

  if (!contributorAddress || !ethers.isAddress(contributorAddress)) {
    throw new Error('Set env var ZKP_CONTRIBUTOR to a valid address');
  }
  if (!fs.existsSync(TREE_PATH)) {
    throw new Error('Missing contributor-merkle-tree.json. Run scripts/build-poseidon-tree.js first.');
  }

  const tree = JSON.parse(fs.readFileSync(TREE_PATH, 'utf8'));
  const proofEntry = (tree.proofs || []).find(
    (p) => p.address.toLowerCase() === contributorAddress.toLowerCase()
  );
  if (!proofEntry) {
    throw new Error(`No proof found for ${contributorAddress} in contributor-merkle-tree.json`);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  const net = await ethers.provider.getNetwork();
  const expectedChainId = BigInt(addresses.chainId || 421614);
  if (net.chainId !== expectedChainId) {
    throw new Error(`Wrong chainId ${net.chainId} expected ${expectedChainId}`);
  }

  const poseidon = await buildPoseidon();
  const addrBigInt = BigInt(contributorAddress);
  const nonceBigInt = BigInt(nonce);

  const commitment = poseidon.F.toString(poseidon([addrBigInt, nonceBigInt]));

  const TREE_DEPTH = 20;
  const merkleRootHex = tree.root;

  const merkleProof = proofEntry.proof.map((x) => BigInt(x).toString());
  const merklePathIndices = proofEntry.pathIndices;

  const input = {
    commitment: BigInt(commitment).toString(),
    merkleRoot: BigInt(merkleRootHex).toString(),
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
  const outPath = path.join(outDir, `proof-tree-${stamp}.json`);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        contributor: contributorAddress,
        nonce: nonce.toString(),
        commitment,
        merkleRoot: merkleRootHex,
        proof: solidityProof,
        generationTimeMs: Date.now() - start
      },
      null,
      2
    )
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ SUCCESS - Proof Generated (from contributor-merkle-tree.json)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Saved:', outPath);
  console.log('merkleRoot:', merkleRootHex);
  console.log('publicSignals:', publicSignals);

  // Ensure the process exits (snarkjs / wasm can keep handles open in some Node versions).
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
