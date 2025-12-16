/**
 * Update Merkle root in MerkleZKRegistry contract
 * Run this after updating contributor-merkle-tree.json
 */

async function main() {
    console.log("🔄 Updating Merkle Root in Contract\n");

    // Load deployment addresses
    const deployments = require('../deployments/merkle-zk-arbitrum.json');
    const merkleZKAddress = deployments.MerkleZKRegistry;
    
    console.log(`📍 MerkleZKRegistry: ${merkleZKAddress}\n`);

    // Load local tree file
    const fs = require('fs');
    const localTree = JSON.parse(fs.readFileSync('./contributor-merkle-tree.json', 'utf8'));
    
    console.log(`📄 New Merkle root from local tree:`);
    console.log(`   Root: ${localTree.root}`);
    console.log(`   Contributors: ${localTree.contributorCount}`);
    console.log(`   Addresses:`, localTree.contributors);
    console.log(`   Last update: ${localTree.lastUpdate}\n`);

    // Get contract
    const MerkleZKRegistry = await ethers.getContractFactory("MerkleZKRegistry");
    const merkleZK = MerkleZKRegistry.attach(merkleZKAddress);

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(`🔑 Updating with account: ${signer.address}\n`);

    // Update root
    console.log("📤 Sending transaction to update Merkle root...");
    const tx = await merkleZK.updateMerkleRoot(localTree.root);
    console.log(`   TX hash: ${tx.hash}`);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`✅ Root updated! Block: ${receipt.blockNumber}\n`);

    // Verify
    const newRoot = await merkleZK.merkleRoot();
    console.log(`🔍 Verification:`);
    console.log(`   Contract root: ${newRoot}`);
    console.log(`   Expected root: ${localTree.root}`);
    
    if (newRoot.toLowerCase() === localTree.root.toLowerCase()) {
        console.log("\n✅ SUCCESS! Merkle root updated successfully.");
    } else {
        console.log("\n❌ ERROR! Root mismatch after update.");
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
