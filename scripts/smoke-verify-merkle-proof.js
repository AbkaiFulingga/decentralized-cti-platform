#!/usr/bin/env node
/**
 * Smoke test: verify the Poseidon Merkle proof in contributor-merkle-tree.json
 * recomputes the published root.
 *
 * This catches the exact condition that triggers the circom assert:
 *   merkleRoot === merkleChecker.root
 */

const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require('circomlibjs');

function normalizeHex32(x) {
  if (typeof x !== 'string') throw new Error(`Expected hex string, got ${typeof x}`);
  if (!x.startsWith('0x')) throw new Error(`Not 0x-prefixed: ${x}`);
  const hex = x.slice(2);
  if (hex.length > 64) throw new Error(`Too long for bytes32: ${x.length}`);
  return '0x' + hex.padStart(64, '0');
}

async function main() {
  const file = process.argv[2] || path.join(__dirname, '..', 'contributor-merkle-tree.json');
  const idx = Number(process.argv[3] ?? 0);

  const tree = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!tree?.proofs?.length) throw new Error('No proofs found in tree file');

  const proofObj = tree.proofs[idx];
  if (!proofObj) throw new Error(`No proof at index ${idx}`);

  const root = normalizeHex32(tree.root);
  const leaf = normalizeHex32(proofObj.leaf ?? tree.leaves?.[idx]);
  const pathElements = proofObj.proof;
  const pathIndices = proofObj.pathIndices;

  if (!Array.isArray(pathElements) || !Array.isArray(pathIndices)) {
    throw new Error('Proof is missing proof/pathIndices arrays');
  }
  if (pathElements.length !== pathIndices.length) {
    throw new Error(`Length mismatch: elements=${pathElements.length} indices=${pathIndices.length}`);
  }

  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  let cur = BigInt(leaf);
  for (let i = 0; i < pathElements.length; i++) {
    const sib = BigInt(pathElements[i]);
    const bit = Number(pathIndices[i]) ? 1 : 0;
    const out = bit === 0 ? poseidon([cur, sib]) : poseidon([sib, cur]);
    cur = BigInt(F.toString(out));
  }

  const got = '0x' + cur.toString(16).padStart(64, '0');

  console.log(JSON.stringify({
    file,
    proofIndex: idx,
    treeDepth: tree.treeDepth,
    expectedRoot: root,
    recomputedRoot: got,
    match: got.toLowerCase() === root.toLowerCase(),
    pathIndicesAllZero: Array.isArray(pathIndices) && pathIndices.every((b) => Number(b) === 0),
  }, null, 2));

  process.exit(got.toLowerCase() === root.toLowerCase() ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
