// scripts/auto-rebuild-poseidon-tree.js
// DIRECTION1-compliant: Automated Poseidon Merkle tree rebuilder for zkSNARK contributors
// Runs every 60 seconds to detect new registrations and update the tree

const { ethers } = require('hardhat');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

// Configuration
const CHECK_INTERVAL = 60000; // Check every 60 seconds (DIRECTION1 specification)
const OUTPUT_FILE = path.join(__dirname, '..', 'contributor-merkle-tree.json');
const FRONTEND_FILE = path.join(__dirname, '..', 'cti-frontend', 'public', 'contributor-merkle-tree.json');
const DEPLOYMENT_FILE_L2 = path.join(__dirname, '..', 'test-addresses-arbitrum.json');
const DEPLOYMENT_FILE_L1 = path.join(__dirname, '..', 'test-addresses.json');
const TREE_DEPTH = 20; // Supports 1,048,576 contributors (DIRECTION1 specification)

let lastContributorCount = 0;
let poseidonInstance = null;

// Initialize Poseidon hash function once
async function initPoseidon() {
  if (!poseidonInstance) {
    console.log('⚙️  Initializing Poseidon hash function...');
    poseidonInstance = await buildPoseidon();
    console.log('✅ Poseidon initialized');
  }
  return poseidonInstance;
}

async function getRegistryContract() {
  try {
    // This rebuilder is dedicated to Arbitrum Sepolia (anonymous mode), so always read the L2 deployment file.
    // Using Hardhat's default network ("hardhat"/localhost) would silently point at the wrong addresses.
    const deploymentData = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE_L2, 'utf8'));
    const registryAddress = deploymentData.PrivacyPreservingRegistry;

    if (!registryAddress) {
      throw new Error('Registry address not found in deployment file');
    }

    // Connect to deployed contract on Arbitrum Sepolia
    const PrivacyPreservingRegistry = await ethers.getContractFactory('PrivacyPreservingRegistry');
    const registry = PrivacyPreservingRegistry.attach(registryAddress);

    return { registry, registryAddress };
  } catch (error) {
    console.error('❌ Failed to load registry contract:', error.message);
    throw error;
  }
}

async function fetchAllContributors(registry) {
  console.log('📊 Fetching all contributors from Arbitrum L2...');
  
  try {
    // Query ContributorRegistered events
    const filter = registry.filters.ContributorRegistered();
    
    let events = [];
    try {
      // Try full range first
      events = await registry.queryFilter(filter, 0, 'latest');
      console.log(`✅ Fetched ${events.length} ContributorRegistered events`);
    } catch (error) {
      if (error.message?.includes('block range') || error.message?.includes('10 block')) {
        console.log(`⚠️ Infura limit reached, fetching in chunks...`);
        const provider = registry.provider;
        const latestBlock = await provider.getBlockNumber();
        
        // Use deployment block optimization (DIRECTION1 pattern)
        const deploymentBlock = 96000000; // Arbitrum Sepolia deployment
        const fromBlock = Math.max(deploymentBlock, latestBlock - 100000);
        
        // Query in 10-block chunks
        const CHUNK_SIZE = 10;
        events = [];
        for (let i = fromBlock; i <= latestBlock; i += CHUNK_SIZE) {
          const chunkEnd = Math.min(i + CHUNK_SIZE - 1, latestBlock);
          const chunkEvents = await registry.queryFilter(filter, i, chunkEnd);
          events.push(...chunkEvents);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log(`✅ Fetched ${events.length} events from blocks ${fromBlock} to ${latestBlock}`);
      } else {
        throw error;
      }
    }

    // Extract unique contributor addresses
    const contributorSet = new Set();
    events.forEach(event => {
      const addr = event.args.contributor || event.args[0];
      if (addr) {
        contributorSet.add(addr.toLowerCase());
      }
    });

    const contributors = Array.from(contributorSet);
    console.log(`✅ Found ${contributors.length} unique contributors`);
    
    return contributors;
  } catch (error) {
    console.error('❌ Failed to fetch contributors:', error.message);
    throw error;
  }
}

// Fallback contributor enumeration when events are unavailable.
// On some networks/providers, queryFilter may return 0 due to ABI mismatches or limited history.
// If the registry exposes getPlatformStats(), we can at least detect a non-zero contributor count.
// If it exposes enumerate-like helpers in the future, this is where we'd plug them in.
async function fetchContributorsFallback(registry) {
  console.log('🛟 Event index produced 0 results. Trying fallback enumeration...');

  // 1) If the contract has getPlatformStats and reports 0 contributors, we can stop.
  try {
    if (typeof registry.getPlatformStats === 'function') {
      const stats = await registry.getPlatformStats();
      // stats[4] is documented in repo scripts as "Total Contributors (all tiers)"
      const total = Number(stats?.[4] ?? 0);
      console.log(`ℹ️  Registry reports total contributors: ${total}`);
      if (total === 0) return [];
    }
  } catch (e) {
    console.log(`⚠️  getPlatformStats() fallback unavailable: ${e.message}`);
  }

  // 2) As a last-resort (until the registry adds an enumerator), keep existing proofs if present.
  // This doesn't *fix* stale/invalid files on its own, but avoids hard failures when the file is missing.
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      const existingContributors = existing?.contributors;
      if (Array.isArray(existingContributors) && existingContributors.length > 0) {
        // Old/legacy files may store an array of objects rather than strings.
        const normalized = existingContributors
          .map((c) => (typeof c === 'string' ? c : c?.address))
          .filter((a) => typeof a === 'string' && a.startsWith('0x'))
          .map((a) => a.toLowerCase());
        if (normalized.length > 0) {
          console.log(`ℹ️  Reusing ${normalized.length} contributors from existing file as fallback.`);
          return normalized;
        }
      }
    }
  } catch (e) {
    console.log(`⚠️  Could not load existing contributor file: ${e.message}`);
  }

  console.log('❌ No fallback contributor source available.');
  return [];
}

async function buildPoseidonMerkleTree(contributors) {
  console.log('🌳 Building Poseidon-based Merkle tree (zkSNARK-friendly)...');
  
  const poseidon = await initPoseidon();
  const F = poseidon.F;
  
  // Convert addresses to BigInt leaves
  const leaves = contributors.map(addr => ethers.toBigInt(addr));
  console.log(`✅ Converted ${leaves.length} addresses to BigInt leaves`);

  // Pad to full tree depth (2^20 = 1,048,576 leaves)
  const targetSize = Math.pow(2, TREE_DEPTH);
  let currentLevel = [...leaves];
  
  while (currentLevel.length < targetSize) {
    currentLevel.push(0n); // Pad with zeros
  }
  console.log(`✅ Padded tree to ${targetSize} leaves (depth ${TREE_DEPTH})`);

  // Build tree level by level using Poseidon(2) hash
  const tree = [currentLevel];
  console.log(`🔨 Building Merkle tree layers...`);
  
  for (let level = 0; level < TREE_DEPTH; level++) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1];
      
      // Hash with Poseidon(2) - zkSNARK-friendly
      const hash = poseidon([left, right]);
      const hashBigInt = F.toObject(hash);
      nextLevel.push(hashBigInt);
    }
    currentLevel = nextLevel;
    tree.push(currentLevel);
    
    if ((level + 1) % 5 === 0) {
      console.log(`   Level ${level + 1}/${TREE_DEPTH} complete (${nextLevel.length} nodes)`);
    }
  }

  const rootBigInt = currentLevel[0];
  const root = '0x' + rootBigInt.toString(16).padStart(64, '0');
  console.log(`✅ Merkle Root: ${root}`);

  // Generate proofs for each contributor
  console.log('📝 Generating Merkle proofs for all contributors...');
  const proofsData = [];
  
  for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
    const proof = [];
    const pathIndices = [];
    
    let index = leafIndex;
    for (let level = 0; level < TREE_DEPTH; level++) {
      const isRightNode = index % 2;
      const siblingIndex = isRightNode ? index - 1 : index + 1;
      
      const sibling = tree[level][siblingIndex];
      proof.push('0x' + sibling.toString(16).padStart(64, '0'));
      pathIndices.push(isRightNode);
      
      index = Math.floor(index / 2);
    }
    
    proofsData.push({
      address: contributors[leafIndex],
      leaf: '0x' + leaves[leafIndex].toString(16).padStart(64, '0'),
      proof: proof, // 20 siblings (padded)
      pathIndices: pathIndices // 20 bits
    });
  }
  console.log(`✅ Generated ${proofsData.length} proofs`);

  // Statistics
  console.log(`\n📊 Tree statistics:`);
  console.log(`   - Hash Function: Poseidon (zkSNARK-friendly)`);
  console.log(`   - Contributors: ${contributors.length}`);
  console.log(`   - Tree Depth: ${TREE_DEPTH} levels`);
  console.log(`   - Capacity: ${targetSize.toLocaleString()} leaves`);
  console.log(`   - Root: ${root}`);

  return {
    root: root,
    leaves: leaves.map(l => '0x' + l.toString(16).padStart(64, '0')),
    contributors: contributors.map(a => a.toLowerCase()),
    contributorCount: contributors.length,
    treeDepth: TREE_DEPTH,
    hashFunction: 'Poseidon',
    timestamp: Date.now(),
    lastUpdate: new Date().toISOString(),
    network: 'arbitrumSepolia',
    proofs: proofsData
  };
}

function saveTreeToFiles(treeData) {
  console.log(`💾 Saving tree data...`);
  
  const jsonContent = JSON.stringify(treeData, null, 2);
  
  // Save to project root
  fs.writeFileSync(OUTPUT_FILE, jsonContent, 'utf8');
  console.log(`   ✅ Saved to: ${OUTPUT_FILE}`);
  
  // Save to frontend public folder (served via /api/contributor-tree)
  try {
    fs.writeFileSync(FRONTEND_FILE, jsonContent, 'utf8');
    console.log(`   ✅ Saved to: ${FRONTEND_FILE}`);
  } catch (error) {
    console.warn(`   ⚠️  Could not save to frontend: ${error.message}`);
  }
  
  console.log(`✅ Tree saved successfully (${(jsonContent.length / 1024).toFixed(2)} KB)`);
}

async function updateContractRoot(treeData) {
  try {
    // Load MerkleZKRegistry contract
    const deploymentData = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE_L2, 'utf8'));
    const merkleZKAddress = deploymentData.MerkleZKRegistry;
    
    if (!merkleZKAddress) {
      console.log('⚠️  MerkleZKRegistry not deployed, skipping on-chain update');
      return;
    }

    const MerkleZKRegistry = await ethers.getContractFactory('MerkleZKRegistry');
    const merkleZK = MerkleZKRegistry.attach(merkleZKAddress);

    // Check if root needs updating
    const currentRoot = await merkleZK.contributorRoot();
    if (currentRoot.toLowerCase() === treeData.root.toLowerCase()) {
      console.log('✅ On-chain root already up-to-date');
      return;
    }

    console.log('📡 Updating on-chain contributor root...');
    console.log(`   Old root: ${currentRoot}`);
    console.log(`   New root: ${treeData.root}`);

    const tx = await merkleZK.updateContributorRoot(treeData.root, treeData.contributorCount);
    console.log(`   ⏳ Tx submitted: ${tx.hash}`);
    
    await tx.wait();
    console.log(`   ✅ On-chain root updated!`);
    
  } catch (error) {
    console.error(`❌ Failed to update on-chain root: ${error.message}`);
    // Non-fatal - continue operation
  }
}

async function checkAndRebuild() {
  try {
    const { registry, registryAddress } = await getRegistryContract();
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Poseidon Tree Rebuild Check - ${new Date().toLocaleTimeString()}`);
    console.log(`📍 Registry: ${registryAddress} (Arbitrum Sepolia L2)`);
    console.log(`${'='.repeat(70)}\n`);

    // Fetch contributors from on-chain events
    let contributors = await fetchAllContributors(registry);
    if (contributors.length === 0) {
      contributors = await fetchContributorsFallback(registry);
    }
    
    if (contributors.length === 0) {
      console.log('⚠️  No contributors found, skipping tree build');
      console.log(`   Next check in 60 seconds...\n`);
      return;
    }

    // Check if rebuild needed
    if (contributors.length === lastContributorCount) {
      console.log(`✅ No new contributors (${contributors.length} total)`);
      console.log(`   Next check in 60 seconds...\n`);
      return;
    }

    // Rebuild tree
    console.log(`🚀 New contributors detected! (${lastContributorCount} → ${contributors.length})`);
    const treeData = await buildPoseidonMerkleTree(contributors);
    
    // Save to files
    saveTreeToFiles(treeData);
    
    // Update on-chain root (if MerkleZKRegistry deployed)
    await updateContractRoot(treeData);
    
    // Update counter
    lastContributorCount = contributors.length;
    
    console.log(`\n✨ Rebuild complete! ${contributors.length} contributors in tree`);
    console.log(`   Next check in 60 seconds...\n`);
    
  } catch (error) {
    console.error(`\n❌ Error during rebuild:`, error.message);
    console.error(error);
    console.log(`   Retrying in 60 seconds...\n`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  POSEIDON MERKLE TREE AUTO-REBUILDER (DIRECTION1 Specification)   ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  console.log('🎯 Purpose: Monitor contributor registrations on Arbitrum L2');
  console.log('⏱️  Interval: 60 seconds (allows anonymous mode within 1 minute)');
  console.log('🔒 Hash: Poseidon (zkSNARK-friendly for Groth16 proofs)');
  console.log('📊 Depth: 20 levels (supports 1,048,576 contributors)');
  console.log('🌐 Network: Arbitrum Sepolia (421614)\n');
  console.log('Press Ctrl+C to stop\n');

  // Initialize Poseidon once
  await initPoseidon();
  
  // Initial check
  await checkAndRebuild();
  
  // Set up interval (60 seconds)
  setInterval(checkAndRebuild, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping merkle tree rebuilder...');
  console.log('✅ Goodbye!');
  process.exit(0);
});

main()
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
