// scripts/auto-rebuild-merkle-tree.js
// Automated Merkle tree rebuilder that monitors on-chain registrations

const { ethers } = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const fs = require('fs');
const path = require('path');

// Configuration
const CHECK_INTERVAL = 60000; // Check every 60 seconds
const OUTPUT_FILE = path.join(__dirname, '..', 'contributor-merkle-tree.json');
const DEPLOYMENT_FILE = path.join(__dirname, '..', 'test-addresses.json');

let lastContributorCount = 0;

async function getRegistryContract() {
  try {
    // Load deployment addresses
    const deploymentData = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    const registryAddress = deploymentData.registryAddress || deploymentData.PrivacyPreservingRegistry;

    if (!registryAddress) {
      throw new Error('Registry address not found in deployment file');
    }

    // Connect to deployed contract
    const PrivacyPreservingRegistry = await ethers.getContractFactory('PrivacyPreservingRegistry');
    const registry = PrivacyPreservingRegistry.attach(registryAddress);

    return { registry, registryAddress };
  } catch (error) {
    console.error('❌ Failed to load registry contract:', error.message);
    throw error;
  }
}

async function fetchAllContributors(registry) {
  console.log('📊 Fetching all contributors from on-chain...');
  
  try {
    // Query ContributorRegistered events
    const filter = registry.filters.ContributorRegistered();
    
    let events = [];
    try {
      events = await registry.queryFilter(filter, 0, 'latest');
      console.log(`✅ Fetched ${events.length} ContributorRegistered events`);
    } catch (error) {
      if (error.message?.includes('block range') || error.message?.includes('10 block')) {
        console.log(`⚠️ Infura limit reached, fetching recent blocks...`);
        const provider = registry.provider;
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 10000); // Last ~10k blocks
        events = await registry.queryFilter(filter, fromBlock, 'latest');
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

function buildMerkleTree(contributors) {
  console.log('🌳 Building Merkle tree...');
  
  // Hash each address using keccak256(address) - matching OpenZeppelin MerkleProof
  const leaves = contributors.map(addr => {
    const normalized = addr.toLowerCase();
    return keccak256(Buffer.from(normalized.slice(2), 'hex'));
  });

  // Build tree with sorted pairs (standard practice)
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  // Generate proofs for each contributor
  const proofs = {};
  contributors.forEach((addr, idx) => {
    const normalized = addr.toLowerCase();
    const leaf = keccak256(Buffer.from(normalized.slice(2), 'hex'));
    const proof = tree.getHexProof(leaf);
    proofs[normalized] = proof;
  });

  console.log(`✅ Merkle tree built with root: ${root}`);
  console.log(`📊 Tree statistics:`);
  console.log(`   - ${contributors.length} contributors`);
  console.log(`   - ${leaves.length} leaves`);
  console.log(`   - ${tree.getDepth()} depth`);

  return {
    root,
    contributorCount: contributors.length,
    leaves: leaves.map(l => '0x' + l.toString('hex')),
    contributors: contributors.map(a => a.toLowerCase()),
    proofs,
    hashFunction: 'keccak256',
    buildTimestamp: new Date().toISOString()
  };
}

function saveTreeToFile(treeData) {
  console.log(`💾 Saving tree to ${OUTPUT_FILE}...`);
  
  const jsonContent = JSON.stringify(treeData, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonContent, 'utf8');
  
  console.log(`✅ Merkle tree saved successfully (${(jsonContent.length / 1024).toFixed(2)} KB)`);
}

async function checkAndRebuild() {
  try {
    const { registry, registryAddress } = await getRegistryContract();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Check at ${new Date().toLocaleTimeString()}`);
    console.log(`� Registry address: ${registryAddress}`);
    console.log(`${'='.repeat(60)}\n`);

    // Always fetch from events (no getContributorCount function exists)
    const contributors = await fetchAllContributors(registry);
    
    if (contributors.length !== lastContributorCount) {
      console.log(`🆕 Detected ${contributors.length - lastContributorCount} new contributor(s)!`);
      console.log(`📊 Current contributor count: ${contributors.length}`);
      console.log(`� Last known count: ${lastContributorCount}`);
      console.log(`�🔄 Rebuilding Merkle tree...\n`);
      
      const treeData = buildMerkleTree(contributors);
      saveTreeToFile(treeData);
      
      lastContributorCount = contributors.length;
      console.log(`✅ Merkle tree updated successfully!\n`);
      
      // Display first few contributors for verification
      console.log(`📋 Sample contributors (first 3):`);
      contributors.slice(0, 3).forEach((addr, idx) => {
        console.log(`   ${idx}: ${addr}`);
        console.log(`      Proof: [${treeData.proofs[addr].length} elements]`);
      });
      console.log('');
      
      return true;
    } else {
      console.log(`📊 Current contributor count: ${contributors.length}`);
      console.log(`✓ No new contributors detected\n`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error during check:', error.message);
    return false;
  }
}

async function initialize() {
  console.log('🚀 Starting Auto Merkle Tree Rebuilder');
  console.log(`📁 Output file: ${OUTPUT_FILE}`);
  console.log(`⏱️  Check interval: ${CHECK_INTERVAL / 1000} seconds\n`);

  // Do initial build
  console.log('🔨 Performing initial tree build...');
  await checkAndRebuild();

  // Schedule periodic checks
  setInterval(async () => {
    await checkAndRebuild();
  }, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down Auto Merkle Tree Rebuilder...');
  console.log(`📊 Final contributor count: ${lastContributorCount}`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the service
if (require.main === module) {
  initialize().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { checkAndRebuild, buildMerkleTree, fetchAllContributors };
