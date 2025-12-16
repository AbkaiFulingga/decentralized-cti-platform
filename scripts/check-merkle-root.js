/**
 * Check current Merkle root in MerkleZKRegistry contract
 */

async function main() {
    console.log("🔍 Checking Merkle Root in Contract\n");

    // Load deployment addresses
    const addresses = require('../test-addresses-arbitrum.json');
    const deployments = require('../deployments/merkle-zk-arbitrum.json');
    
    const merkleZKAddress = deployments.merkleZKRegistry; // ✅ FIX: Use lowercase key
    console.log(`📍 MerkleZKRegistry: ${merkleZKAddress}\n`);

    // Get contract
    const MerkleZKRegistry = await ethers.getContractFactory("MerkleZKRegistry");
    const merkleZK = MerkleZKRegistry.attach(merkleZKAddress);

    // Get current root
    const currentRoot = await merkleZK.contributorMerkleRoot(); // ✅ FIX: Correct function name
    console.log(`🌳 Current Merkle Root in contract:`);
    console.log(`   ${currentRoot}\n`);

    // Load local tree file
    const fs = require('fs');
    const localTree = JSON.parse(fs.readFileSync('./contributor-merkle-tree.json', 'utf8'));
    
    console.log(`📄 Local tree file:`);
    console.log(`   Root: ${localTree.root}`);
    console.log(`   Contributors: ${localTree.contributorCount}`);
    console.log(`   Addresses:`, localTree.contributors);
    console.log(`   Last update: ${localTree.lastUpdate}\n`);

    // Compare
    if (currentRoot.toLowerCase() === localTree.root.toLowerCase()) {
        console.log("✅ Roots MATCH! Tree is in sync.");
    } else {
        console.log("❌ Roots DON'T MATCH! Tree needs to be updated in contract.");
        console.log(`\n📝 To fix, run:`);
        console.log(`   npx hardhat run scripts/update-merkle-root-onchain.js --network arbitrumSepolia`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
