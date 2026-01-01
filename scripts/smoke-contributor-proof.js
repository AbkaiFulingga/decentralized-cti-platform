#!/usr/bin/env node
/*
  Node smoke test for the contributor Groth16 circuit.

  Why this exists:
  - cti-frontend/utils/zksnark-prover.js intentionally blocks SSR/Node proving.
  - We still want a server-side, repeatable proof generation test to confirm
    the Merkle root + padding semantics match the circuit (fixing line 97).

  Usage (from repo root):
    node scripts/smoke-contributor-proof.js

  Exit code:
    0 on success, 1 on failure.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const snarkjs = require('snarkjs');
const circomlibjs = require('circomlibjs');
const { ethers } = require('ethers');

const REPO_ROOT = path.join(__dirname, '..');

const TREE_FILE = path.join(REPO_ROOT, 'contributor-merkle-tree.json');
const WASM_FILE = path.join(REPO_ROOT, 'cti-frontend/public/circuits/contributor-proof.wasm');
const ZKEY_FILE = path.join(REPO_ROOT, 'cti-frontend/public/circuits/contributor-proof_final.zkey');

const CIRCUIT_LEVELS = 20;

function randNonce() {
  // random 31 bytes to stay comfortably < BN254 field
  return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}

function toFieldDec(x) {
  // snarkjs likes decimal string inputs for big field elements
  return BigInt(x).toString(10);
}

function hexRootToDec(rootHex) {
  if (typeof rootHex !== 'string' || !rootHex.startsWith('0x')) {
    throw new Error(`Invalid root hex: ${rootHex}`);
  }
  return BigInt(rootHex).toString(10);
}

async function buildPoseidon() {
  // circomlibjs poseidon returns a function with .F
  return circomlibjs.buildPoseidon();
}

function poseidon1ToBigInt(poseidon, a) {
  const out = poseidon([BigInt(a)]);
  return BigInt(poseidon.F.toString(out));
}

function poseidon2ToBigInt(poseidon, a, b) {
  const out = poseidon([BigInt(a), BigInt(b)]);
  return BigInt(poseidon.F.toString(out));
}

function getZeroSubtreeRoots(poseidon, levels) {
  // zero[0] is the empty leaf value (0)
  // zero[i+1] = H(zero[i], zero[i])
  const zeros = [0n];
  for (let i = 0; i < levels; i++) {
    zeros.push(poseidon2ToBigInt(poseidon, zeros[i], zeros[i]));
  }
  return zeros; // length levels+1
}

function padProofToCircuitDepth({
  poseidon,
  leafIndex,
  proofSiblings,
  proofPathIndices,
  realDepth,
  circuitLevels
}) {
  const zeros = getZeroSubtreeRoots(poseidon, circuitLevels);

  const siblings = proofSiblings.map((x) => BigInt(x));
  const indices = proofPathIndices.map((x) => Number(x));

  let idx = BigInt(leafIndex);
  for (let level = realDepth; level < circuitLevels; level++) {
    // Above the real tree, we assume the leaf is the only populated node.
    // So at each higher level, the sibling is the empty subtree root at that level.
    const bit = Number(idx & 1n); // 0 => leaf on left
    indices.push(bit);
    siblings.push(zeros[level]);
    idx >>= 1n;
  }

  if (siblings.length !== circuitLevels || indices.length !== circuitLevels) {
    throw new Error(`Padding failed: siblings=${siblings.length}, indices=${indices.length}`);
  }

  return { siblings, indices };
}

function computeRootFromProof({ poseidon, leaf, siblings, indices }) {
  let cur = BigInt(leaf);
  for (let level = 0; level < siblings.length; level++) {
    const sib = BigInt(siblings[level]);
    const bit = Number(indices[level]);
    cur = bit === 0 ? poseidon2ToBigInt(poseidon, cur, sib) : poseidon2ToBigInt(poseidon, sib, cur);
  }
  return cur;
}

async function main() {
  if (!fs.existsSync(TREE_FILE)) {
    throw new Error(`Missing tree file: ${TREE_FILE}`);
  }
  if (!fs.existsSync(WASM_FILE)) {
    throw new Error(`Missing wasm: ${WASM_FILE}`);
  }
  if (!fs.existsSync(ZKEY_FILE)) {
    throw new Error(`Missing zkey: ${ZKEY_FILE}`);
  }

  const tree = JSON.parse(fs.readFileSync(TREE_FILE, 'utf8'));
  const address = tree?.contributors?.[0];
  const proof = tree?.proofs?.[0];

  if (!address || !proof) {
    throw new Error('Tree JSON missing contributors/proofs');
  }

  const poseidon = await buildPoseidon();

  const addressBig = ethers.toBigInt(address);
  const leaf = poseidon1ToBigInt(poseidon, addressBig);

  const realDepth = Number(tree.treeDepth ?? proof.treeDepth ?? (proof?.siblings?.length ?? 0));
  const leafIndex = BigInt(proof.leafIndex ?? 0);

  const proofSiblings = proof.siblings;
  const proofPathIndices = proof.pathIndices;

  if (!Array.isArray(proofSiblings) || !Array.isArray(proofPathIndices)) {
    throw new Error('Proof missing siblings/pathIndices arrays');
  }

  const padded = padProofToCircuitDepth({
    poseidon,
    leafIndex,
    proofSiblings: proofSiblings.map((x) => BigInt(x)),
    proofPathIndices,
    realDepth,
    circuitLevels: CIRCUIT_LEVELS
  });

  const computedRoot20 = computeRootFromProof({
    poseidon,
    leaf,
    siblings: padded.siblings,
    indices: padded.indices
  });

  const nonce = randNonce();
  const commitment = poseidon2ToBigInt(poseidon, addressBig, nonce);

  const input = {
    // circuit public
    commitment: toFieldDec(commitment),
    merkleRoot: toFieldDec(computedRoot20),

    // circuit private
    address: toFieldDec(addressBig),
    nonce: toFieldDec(nonce),
    merkleProof: padded.siblings.map(toFieldDec),
    merklePathIndices: padded.indices
  };

  // This is the real test: if padding/root are inconsistent with the circuit,
  // fullProve will throw with the assert at line 97.
  const { proof: grothProof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_FILE,
    ZKEY_FILE
  );

  // Quick sanity assertions
  if (!grothProof || !publicSignals) {
    throw new Error('snarkjs returned no proof/publicSignals');
  }

  console.log(JSON.stringify({
    ok: true,
    address,
    treeRootDepth8: tree.root,
    computedRootDepth20: '0x' + computedRoot20.toString(16),
    publicSignalsLen: publicSignals.length,
    publicSignalsHead: publicSignals.slice(0, 4)
  }, null, 2));
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e?.stack || e);
  process.exitCode = 1;
});
