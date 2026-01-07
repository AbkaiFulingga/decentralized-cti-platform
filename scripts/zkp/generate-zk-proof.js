/**
 * 🔐 ZK Proof Generation Script
 * 
 * Generates a zkSNARK proof for anonymous IOC submission without revealing contributor identity.
 * 
 * Usage:
 *   npx hardhat run scripts/zkp/generate-zk-proof.js --network arbitrumSepolia -- <contributorAddress> <nonce>
 *
 * Alternative (env vars):
 *   ZKP_CONTRIBUTOR=0x... ZKP_NONCE=123 npx hardhat run scripts/zkp/generate-zk-proof.js --network arbitrumSepolia
 * 
 * Example:
 *   node scripts/zkp/generate-zk-proof.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 12345
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const snarkjs = require('snarkjs');
const { MerkleTree } = require('merkletreejs');
const { buildPoseidon } = require('circomlibjs');

// Paths to circuit artifacts
const WASM_PATH = path.join(__dirname, '../../circuits/contributor-proof_js/contributor-proof.wasm');
const ZKEY_PATH = path.join(__dirname, '../../circuits/contributor-proof_final.zkey');
const VKEY_PATH = path.join(__dirname, '../../circuits/verification_key.json');

// Contract addresses
const ADDRESSES_PATH = path.join(__dirname, '../../test-addresses-arbitrum.json');

/**
 * Load registered contributors from on-chain registry
 */
async function loadContributors(registryAddress) {
  console.log('\n📋 Loading registered contributors...');
  
  const Registry = await ethers.getContractAt('PrivacyPreservingRegistry', registryAddress);
  
  // Get contributor registered events
  const filter = Registry.filters.ContributorRegistered();
  const events = await Registry.queryFilter(filter);
  
  const contributors = events.map(event => event.args.contributor);
  
  console.log(`   Found ${contributors.length} registered contributors`);
  return contributors;
}

/**
 * Build Merkle tree from contributors list
 */
async function buildMerkleTree(contributors, treeDepth = 20) {
  console.log('\n🌳 Building Merkle tree...');
  
  const poseidon = await buildPoseidon();
  
  // Hash each contributor address using Poseidon
  const leaves = contributors.map(addr => {
    const addrBigInt = BigInt(addr);
    const hash = poseidon.F.toString(poseidon([addrBigInt]));
    return hash;
  });
  
  // Build a fixed-depth tree (depth=20) to match the circuit.
  // We can't use merkletreejs's variable-depth root here because the circuit
  // always performs exactly 20 Poseidon(2) hashing rounds.
  const hash2 = (left, right) => poseidon.F.toString(poseidon([BigInt(left), BigInt(right)]));
  const zero = '0';

  // For this demo, the on-chain contributor set is tiny (often just 1 address).
  // We only need a *circuit-consistent* root and a path of length `treeDepth`.
  // If the contributor is the left-most leaf (index 0), the path siblings are
  // all zeros and the root is computed by repeatedly hashing (cur, 0).
  // This matches the circuit's fixed 20 hashing rounds.
  //
  // If more leaves exist, we can extend this to a full fixed-depth tree later.
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < 1) paddedLeaves.push(zero);

  let cur = paddedLeaves[0];
  for (let level = 0; level < treeDepth; level++) {
    cur = hash2(cur, zero);
  }

  const root = cur;
  console.log(`   Merkle root: 0x${BigInt(root).toString(16)}`);
  console.log(`   Tree depth: ${treeDepth}`);

  return { poseidon, leaves: paddedLeaves, root, treeDepth, hash2, zero };
}

/**
 * Generate Merkle proof for a specific contributor
 */
function generateMerkleProof(_ignored, leaves, contributorAddress, poseidon, treeDepth = 20) {
  console.log('\n🔍 Generating Merkle proof...');
  
  const addrBigInt = BigInt(contributorAddress);
  const leaf = poseidon.F.toString(poseidon([addrBigInt]));
  const leafIndex = leaves.indexOf(leaf);
  
  if (leafIndex === -1) {
    throw new Error(`❌ Contributor ${contributorAddress} not found in tree!`);
  }
  
  if (leafIndex !== 0) {
    throw new Error(
      `❌ Demo prover currently supports only leafIndex=0, got ${leafIndex}. ` +
      `Register order or tree construction needs extending for multi-leaf proofs.`
    );
  }

  // Siblings are all zeros; indices all 0 (leaf always on the left)
  const pathElements = Array(treeDepth).fill('0');
  const pathIndices = Array(treeDepth).fill(0);
  
  console.log(`   Leaf index: ${leafIndex}`);
  console.log(`   Proof length: ${pathElements.length}`);
  
  return { pathElements, pathIndices };
}

/**
 * Generate commitment hash
 */
async function generateCommitment(contributorAddress, nonce, poseidon) {
  const addrBigInt = BigInt(contributorAddress);
  const nonceBigInt = BigInt(nonce);
  
  // commitment = poseidon(address, nonce)
  const commitment = poseidon.F.toString(poseidon([addrBigInt, nonceBigInt]));
  
  return commitment;
}

/**
 * Generate witness and zkSNARK proof
 */
async function generateProof(input) {
  console.log('\n⚙️  Generating witness...');
  
  // Generate witness
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );
  
  console.log('✅ Witness generated');
  console.log('\n🔐 Generating zkSNARK proof...');
  console.log('   (This may take 10-30 seconds...)');
  
  // Verify proof locally before returning
  const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  
  if (!verified) {
    throw new Error('❌ Proof verification failed!');
  }
  
  console.log('✅ Proof generated and verified locally');
  
  return { proof, publicSignals };
}

/**
 * Convert proof to Solidity-compatible format
 */
function formatProofForSolidity(proof, publicSignals) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
    input: publicSignals
  };
}

/**
 * Pad array to specified length
 */
function padArray(arr, length, fillValue = '0') {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push(fillValue);
  }
  return padded;
}

function padArrayNumbers(arr, length, fillValue = 0) {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push(fillValue);
  }
  return padded;
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔐 zkSNARK PROOF GENERATION');
  console.log('═══════════════════════════════════════════════════════');
  
  // Parse arguments.
  // When run via Hardhat, positional args must come after `--`, e.g.:
  //   npx hardhat run ... -- <address> <nonce>
  const rawArgs = process.argv.slice(2);
  const ddIndex = rawArgs.indexOf('--');
  const args = ddIndex >= 0 ? rawArgs.slice(ddIndex + 1) : rawArgs;

  const contributorAddress = process.env.ZKP_CONTRIBUTOR || args[0];
  const nonce = process.env.ZKP_NONCE || args[1] || Math.floor(Math.random() * 1000000);
  
  if (!contributorAddress) {
    console.error('\n❌ Error: Contributor address required');
    console.log('\nUsage: npx hardhat run scripts/zkp/generate-zk-proof.js --network arbitrumSepolia -- <address> [nonce]');
    console.log('Example: node generate-zk-proof.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 12345');
    process.exit(1);
  }
  
  // Validate address
  if (!ethers.isAddress(contributorAddress)) {
    console.error(`\n❌ Error: Invalid Ethereum address: ${contributorAddress}`);
    process.exit(1);
  }
  
  console.log(`\n📝 Input Parameters:`);
  console.log(`   Contributor: ${contributorAddress}`);
  console.log(`   Nonce: ${nonce}`);
  
  // Check circuit artifacts exist
  if (!fs.existsSync(WASM_PATH)) {
    console.error(`\n❌ Error: Circuit WASM not found at ${WASM_PATH}`);
    console.log('Run: cd circuits && ./setup-circuit.sh');
    process.exit(1);
  }
  
  if (!fs.existsSync(ZKEY_PATH)) {
    console.error(`\n❌ Error: Proving key not found at ${ZKEY_PATH}`);
    console.log('Run: cd circuits && ./setup-circuit.sh');
    process.exit(1);
  }
  
  // Load contract addresses
  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error(`\n❌ Error: Addresses file not found at ${ADDRESSES_PATH}`);
    process.exit(1);
  }
  
  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  const registryAddress = addresses.PrivacyPreservingRegistry;
  
  console.log(`\n🌐 Registry: ${registryAddress}`);

  // Fail-fast if we're accidentally connected to the local Hardhat network.
  const net = await ethers.provider.getNetwork();
  const expectedChainId = BigInt(addresses.chainId || 421614);
  if (net.chainId !== expectedChainId) {
    console.error(`\n❌ Connected to wrong chainId ${net.chainId.toString()} (expected ${expectedChainId.toString()}).`);
    console.error('   This usually means the RPC is not being used and Hardhat fell back to its in-memory network.');
    process.exit(1);
  }
  
  try {
    // Step 1: Load contributors
    const contributors = await loadContributors(registryAddress);
    
    // Step 2: Build Merkle tree
  const TREE_DEPTH = 20; // Must match the circuit (ContributorProof(20))
  const { leaves, poseidon, root } = await buildMerkleTree(contributors, TREE_DEPTH);
  const merkleRoot = BigInt(root).toString(16);
    
    // Step 3: Generate Merkle proof
    const { pathElements, pathIndices } = generateMerkleProof(
      null,
      leaves,
      contributorAddress,
      poseidon,
      TREE_DEPTH
    );
    
    // Step 4: Generate commitment
    const commitment = await generateCommitment(contributorAddress, nonce, poseidon);
    console.log(`\n🔒 Commitment: ${commitment}`);
    
    // Step 5: Prepare circuit input
    const circuitInput = {
      commitment: BigInt(commitment).toString(),
      address: BigInt(contributorAddress).toString(),
      nonce: nonce.toString(),
      merkleRoot: BigInt('0x' + merkleRoot).toString(),
      // Field names must match circuits/contributor-proof.circom:
      merkleProof: padArray(pathElements, TREE_DEPTH, '0'),
      merklePathIndices: padArrayNumbers(pathIndices, TREE_DEPTH, 0)
    };
    
    console.log('\n📊 Circuit Input Summary:');
    console.log(`   Address: ${circuitInput.address}`);
    console.log(`   Nonce: ${circuitInput.nonce}`);
    console.log(`   Merkle root: ${circuitInput.merkleRoot}`);
  console.log(`   Merkle proof elements: ${pathElements.length} (padded to ${TREE_DEPTH})`);
    
    // Step 6: Generate zkSNARK proof
    const startTime = Date.now();
    const { proof, publicSignals } = await generateProof(circuitInput);
    const endTime = Date.now();
    
    console.log(`\n⏱️  Proof generation time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    
    // Step 7: Format for Solidity
    const solidityProof = formatProofForSolidity(proof, publicSignals);
    
    // Step 8: Save to file
    const outputDir = path.join(__dirname, '../../zkp-proofs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `proof-${timestamp}.json`);
    
    const output = {
      timestamp: new Date().toISOString(),
      contributor: contributorAddress,
      nonce: nonce.toString(),
      commitment: commitment,
      merkleRoot: '0x' + merkleRoot,
      proof: solidityProof,
      generationTimeMs: endTime - startTime,
      circuitStats: {
        constraints: 10918,
        wires: 10941,
        privateInputs: 42,
        publicInputs: 2
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ SUCCESS - Proof Generated');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`\n📄 Proof saved to: ${outputFile}`);
    console.log(`\n📊 Public Signals:`);
    console.log(`   Commitment: ${publicSignals[0]}`);
    console.log(`   Merkle Root: ${publicSignals[1]}`);
    
    console.log('\n🔐 Proof Components:');
    console.log(`   a: [${solidityProof.a[0].substring(0, 20)}..., ${solidityProof.a[1].substring(0, 20)}...]`);
    console.log(`   b: [[...], [...]]`);
    console.log(`   c: [${solidityProof.c[0].substring(0, 20)}..., ${solidityProof.c[1].substring(0, 20)}...]`);
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Use this proof to submit anonymous batch');
    console.log('   2. Call: registry.addBatchWithZKProof(ipfsHash, commitment, proof)');
    console.log(`   3. Or run: node scripts/zkp/submit-with-proof.js ${outputFile.split('/').pop()}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateProof, generateCommitment, buildMerkleTree };
