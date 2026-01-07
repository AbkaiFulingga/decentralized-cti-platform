/*
 * Node-side sanity check for the *frontend* zkSNARK prover logic.
 *
 * Goal: confirm that the same inputs + circuit artifacts the browser uses
 * can successfully produce a Groth16 proof on this machine.
 *
 * This avoids mismatches with the legacy circuits/ witness generator scripts.
 */

const path = require('path');
const fs = require('fs');

async function main() {
  const snarkjs = require('snarkjs');

  const circuitsDir = path.join(__dirname, '..', 'cti-frontend', 'public', 'circuits');
  const wasmPath = path.join(circuitsDir, 'contributor-proof.wasm');
  const zkeyPath = path.join(circuitsDir, 'contributor-proof_final.zkey');

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error(`Missing circuit artifacts in ${circuitsDir}`);
  }

  // Uses the same JSON produced by scripts/build-contributor-tree.js (repo root).
  const treePath = path.join(__dirname, '..', 'contributor-merkle-tree.json');
  const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));

  const address = tree?.contributors?.[0]?.address;
  if (!address) throw new Error('contributor-merkle-tree.json missing contributors[0].address');

  const proofEntry = (tree.proofs || []).find(
    (p) => (p.address || '').toLowerCase() === address.toLowerCase()
  );
  if (!proofEntry) throw new Error(`No proof entry found for ${address}`);

  const nonce = BigInt(Date.now());
  const { buildPoseidon } = require('circomlibjs');
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const addrBig = BigInt(address);
  const commitment = F.toObject(poseidon([addrBig, nonce]));

  const input = {
    // public
    commitment: commitment.toString(),
    merkleRoot: BigInt(tree.root).toString(),

    // private
    address: addrBig.toString(),
    nonce: nonce.toString(),
    merkleProof: proofEntry.proof.map((x) => BigInt(x).toString()),
    merklePathIndices: proofEntry.pathIndices
  };

  console.log('[frontend-prover-check] input summary', {
    addr: address,
    nonce: input.nonce,
    merkleRoot: tree.root,
    proofLen: input.merkleProof.length,
    pathLen: input.merklePathIndices.length
  });

  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
  const dt = ((Date.now() - t0) / 1000).toFixed(2);

  console.log('[frontend-prover-check] ok', {
    seconds: dt,
    publicSignalsLen: publicSignals.length,
    publicSignals
  });
}

main().catch((err) => {
  console.error('[frontend-prover-check] FAIL', err);
  process.exit(1);
});
