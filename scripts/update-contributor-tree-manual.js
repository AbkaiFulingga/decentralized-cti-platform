/**
 * Manually update contributor Merkle tree with specific addresses
 */

const fs = require('fs');
const { MerkleTree } = require('merkletreejs');
const { keccak256, Wallet } = require('ethers');

async function main() {
    console.log("🌲 Manually Updating Contributor Merkle Tree\n");

    // Derive address from private key
    const privateKey = '0x6aeb8c31ce33832acd4ffdc415f375424cf9e3026744ee38694d91464118d3ff';
    const wallet = new Wallet(privateKey);
    const newAddress = wallet.address;

    console.log(`📍 New address from private key: ${newAddress}\n`);
    
    // Add both old and new addresses
    const contributors = [
        '0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82', // Existing
        newAddress  // New address
    ];

    console.log("📋 Contributors in tree:");
    contributors.forEach((addr, i) => {
        console.log(`   ${i + 1}: ${addr}`);
    });
    console.log();

    // Build Merkle tree using RAW ADDRESSES as leaves (circuit will hash them)
    // The circuit expects: merkleChecker.leaf <== address (as BigInt)
    // MerkleTreeInclusionProof will internally hash with Poseidon
    const { ethers } = require('ethers');
    const leaves = contributors.map(addr => ethers.toBigInt(addr));
    
    // For JS MerkleTree library, we need to convert to Buffer
    // But we'll store the BigInt values in JSON
    const leafBuffers = leaves.map(l => {
        const hex = l.toString(16).padStart(64, '0');
        return Buffer.from(hex, 'hex');
    });
    
    const tree = new MerkleTree(leafBuffers, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    console.log(`✅ New Merkle Root: ${root}\n`);

    // Save to file - store leaves as hex strings of BigInt values
    const treeData = {
        root: root,
        leaves: leaves.map(l => '0x' + l.toString(16).padStart(64, '0')),
        contributors: contributors,
        contributorCount: contributors.length,
        treeDepth: Math.ceil(Math.log2(contributors.length)),
        timestamp: Date.now(),
        lastUpdate: new Date().toISOString(),
        network: 'arbitrumSepolia',
        note: 'Manually updated to include both admin and test addresses'
    };

    const outputPath = './contributor-merkle-tree.json';
    fs.writeFileSync(outputPath, JSON.stringify(treeData, null, 2));
    
    console.log(`💾 Saved to: ${outputPath}`);
    console.log(`\n✨ Tree updated successfully!`);
    console.log(`\nNext steps:`);
    console.log(`1. Copy this file to server: scp contributor-merkle-tree.json sc@192.168.1.11:~/blockchain-dev/`);
    console.log(`2. On server: cp ~/blockchain-dev/contributor-merkle-tree.json ~/blockchain-dev/cti-frontend/public/`);
    console.log(`3. Retry zkSNARK submission with address: ${newAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
