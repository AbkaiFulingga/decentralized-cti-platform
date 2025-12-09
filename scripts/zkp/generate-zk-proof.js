/**
 * 🔐 ZK Proof Generation Script
 * 
 * Generates a zkSNARK proof for anonymous IOC submission without revealing contributor identity.
 * 
 * Usage:
 *   node scripts/zkp/generate-zk-proof.js <contributorAddress> <nonce>
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
async function buildMerkleTree(contributors) {
  console.log('\n🌳 Building Merkle tree...');
  
  const poseidon = await buildPoseidon();
  
  // Hash each contributor address using Poseidon
  const leaves = contributors.map(addr => {
    const addrBigInt = BigInt(addr);
    const hash = poseidon.F.toString(poseidon([addrBigInt]));
    return hash;
  });
  
  // Build tree with Poseidon hash function
  const tree = new MerkleTree(leaves, (data) => {
    const input = Array.isArray(data) ? data : [data];
    const hash = poseidon(input.map(x => BigInt(x)));
    return poseidon.F.toString(hash);
  }, { sortPairs: true });
  
  const root = tree.getRoot().toString('hex');
  console.log(`   Merkle root: 0x${root}`);
  console.log(`   Tree depth: ${tree.getDepth()}`);
  
  return { tree, leaves, poseidon };
}

/**
 * Generate Merkle proof for a specific contributor
 */
function generateMerkleProof(tree, leaves, contributorAddress, poseidon) {
  console.log('\n🔍 Generating Merkle proof...');
  
  const addrBigInt = BigInt(contributorAddress);
  const leaf = poseidon.F.toString(poseidon([addrBigInt]));
  const leafIndex = leaves.indexOf(leaf);
  
  if (leafIndex === -1) {
    throw new Error(`❌ Contributor ${contributorAddress} not found in tree!`);
  }
  
  const proof = tree.getProof(leafIndex);
  
  // Convert proof to format expected by circuit
  const pathElements = proof.map(p => p.data.toString());
  const pathIndices = proof.map(p => p.position === 'right' ? 1 : 0);
  
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

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔐 zkSNARK PROOF GENERATION');
  console.log('═══════════════════════════════════════════════════════');
  
  // Parse arguments
  const contributorAddress = process.argv[2];
  const nonce = process.argv[3] || Math.floor(Math.random() * 1000000);
  
  if (!contributorAddress) {
    console.error('\n❌ Error: Contributor address required');
    console.log('\nUsage: node generate-zk-proof.js <address> [nonce]');
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
  
  try {
    // Step 1: Load contributors
    const contributors = await loadContributors(registryAddress);
    
    // Step 2: Build Merkle tree
    const { tree, leaves, poseidon } = await buildMerkleTree(contributors);
    const merkleRoot = tree.getRoot().toString('hex');
    
    // Step 3: Generate Merkle proof
    const { pathElements, pathIndices } = generateMerkleProof(
      tree,
      leaves,
      contributorAddress,
      poseidon
    );
    
    // Step 4: Generate commitment
    const commitment = await generateCommitment(contributorAddress, nonce, poseidon);
    console.log(`\n🔒 Commitment: ${commitment}`);
    
    // Step 5: Prepare circuit input
    const TREE_DEPTH = 20; // From circuit definition
    
    const circuitInput = {
      address: BigInt(contributorAddress).toString(),
      nonce: nonce.toString(),
      merkleRoot: BigInt('0x' + merkleRoot).toString(),
      pathElements: padArray(pathElements, TREE_DEPTH, '0'),
      pathIndices: padArray(pathIndices, TREE_DEPTH, 0)
    };
    
    console.log('\n📊 Circuit Input Summary:');
    console.log(`   Address: ${circuitInput.address}`);
    console.log(`   Nonce: ${circuitInput.nonce}`);
    console.log(`   Merkle root: ${circuitInput.merkleRoot}`);
    console.log(`   Path elements: ${pathElements.length} (padded to ${TREE_DEPTH})`);
    
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
