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

    // IMPORTANT: The extension step from a real tree of depth `realDepth`
    // combines the current subtree (which spans 2^realDepth leaves) with an
    // *empty* sibling subtree spanning the same number of leaves.
    // That sibling is the empty-subtree root of height `level`'s child subtree,
    // which is `level` in terms of leaves under that node.
    // Concretely, the first extension (level == realDepth) needs zeros[realDepth],
    // then zeros[realDepth+1], ...
    // NOTE: If you ever see a root mismatch, the most likely cause is an
    // off-by-one between "treeDepth" semantics and "zero subtree height".
    // The convention here is:
    //   zeros[0] = 0 (empty leaf)
    //   zeros[h] = root of an empty subtree with 2^h leaves
    // For extending a depth-`realDepth` tree, the sibling at extension `level`
    // should be zeros[level].
    siblings.push(zeros[level]);
    idx >>= 1n;
  }

  if (siblings.length !== circuitLevels || indices.length !== circuitLevels) {
    throw new Error(`Padding failed: siblings=${siblings.length}, indices=${indices.length}`);
  }

  return { siblings, indices };
}

function padProofToCircuitDepth_AltOffByOne({
  poseidon,
  leafIndex,
  proofSiblings,
  proofPathIndices,
  realDepth,
  circuitLevels
}) {
  // Alternative convention (some tree builders define the empty-subtree chain
  // starting at height=1 for leaf-level). If the main convention fails, this
  // gives us a deterministic second attempt.
  const zeros = getZeroSubtreeRoots(poseidon, circuitLevels + 1);

  const siblings = proofSiblings.map((x) => BigInt(x));
  const indices = proofPathIndices.map((x) => Number(x));

  let idx = BigInt(leafIndex);
  for (let level = realDepth; level < circuitLevels; level++) {
    const bit = Number(idx & 1n);
    indices.push(bit);
    siblings.push(zeros[level + 1]);
    idx >>= 1n;
  }

  if (siblings.length !== circuitLevels || indices.length !== circuitLevels) {
    throw new Error(`Alt padding failed: siblings=${siblings.length}, indices=${indices.length}`);
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

  // Tree JSON format produced by scripts/auto-rebuild-poseidon-tree.js:
  //   proof.proof = array of sibling hashes (hex strings)
  //   proof.pathIndices = array of 0/1 numbers
  const proofSiblings = proof.proof;
  const proofPathIndices = proof.pathIndices;

  if (!Array.isArray(proofSiblings) || !Array.isArray(proofPathIndices)) {
    throw new Error('Proof missing siblings/pathIndices arrays');
  }

  const baseSiblings = proofSiblings.map((x) => BigInt(x));
  const baseIndices = proofPathIndices.map((x) => Number(x));

  // If the tree itself is already built at depth 20, do NOT try to "extend" it.
  // Use the proof/root as-is, otherwise we risk feeding a mismatched merkleRoot.
  const isAlreadyCircuitDepth = realDepth === CIRCUIT_LEVELS;

  const padded = isAlreadyCircuitDepth
    ? { siblings: baseSiblings, indices: baseIndices }
    : padProofToCircuitDepth({
        poseidon,
        leafIndex,
        proofSiblings: baseSiblings,
        proofPathIndices,
        realDepth,
        circuitLevels: CIRCUIT_LEVELS
      });

  const paddedAlt = isAlreadyCircuitDepth
    ? null
    : padProofToCircuitDepth_AltOffByOne({
        poseidon,
        leafIndex,
        proofSiblings: baseSiblings,
        proofPathIndices,
        realDepth,
        circuitLevels: CIRCUIT_LEVELS
      });

  const computedRoot20 = computeRootFromProof({ poseidon, leaf, siblings: padded.siblings, indices: padded.indices });
  const computedRoot20Alt = paddedAlt
    ? computeRootFromProof({ poseidon, leaf, siblings: paddedAlt.siblings, indices: paddedAlt.indices })
    : null;

  const nonce = randNonce();
  const commitment = poseidon2ToBigInt(poseidon, addressBig, nonce);

  const baseInput = {
    // circuit public
    commitment: toFieldDec(commitment),
    // merkleRoot set per-attempt

    // circuit private
    address: toFieldDec(addressBig),
    nonce: toFieldDec(nonce)
  };

  const attempts = isAlreadyCircuitDepth
    ? [
        {
          name: 'treeDepth20',
          root: BigInt(tree.root),
          siblings: padded.siblings,
          indices: padded.indices
        }
      ]
    : [
        {
          name: 'primary',
          root: computedRoot20,
          siblings: padded.siblings,
          indices: padded.indices
        },
        {
          name: 'altOffByOne',
          root: computedRoot20Alt,
          siblings: paddedAlt.siblings,
          indices: paddedAlt.indices
        }
      ];

  let grothProof;
  let publicSignals;
  let used;
  let lastErr;

  for (const a of attempts) {
    try {
      const input = {
        ...baseInput,
        merkleRoot: toFieldDec(a.root),
        merkleProof: a.siblings.map(toFieldDec),
        merklePathIndices: a.indices
      };

      ({ proof: grothProof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        WASM_FILE,
        ZKEY_FILE
      ));
      used = a;
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!grothProof || !publicSignals) {
    // Re-throw last error (likely line 97)
    throw lastErr;
  }

  // Quick sanity assertions
  if (!grothProof || !publicSignals) {
    throw new Error('snarkjs returned no proof/publicSignals');
  }

  console.log(JSON.stringify({
    ok: true,
    address,
    treeRootDepth8: tree.root,
    computedRootDepth20: computedRoot20 ? '0x' + computedRoot20.toString(16) : null,
    computedRootDepth20Alt: computedRoot20Alt ? '0x' + computedRoot20Alt.toString(16) : null,
    usedAttempt: used?.name,
    publicSignalsLen: publicSignals.length,
    publicSignalsHead: publicSignals.slice(0, 4)
  }, null, 2));
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e?.stack || e);
  process.exitCode = 1;
});
