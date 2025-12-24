/**
 * Build Merkle tree of registered contributors
 * This tree is used to generate zkSNARK proofs
 */

const fs = require('fs');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');

async function main() {
    console.log("🌲 Building Contributor Merkle Tree\n");

    // Get the actual signer from private key (not Hardhat default accounts)
    const provider = ethers.provider;
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_ADMIN1 || process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Using address: ${wallet.address}\n`);
    
    // Use actual deployer address (you can add more contributors here)
    const contributors = [
        wallet.address,  // Your actual deployer address from .env
        // Add more contributor addresses as needed
    ];

    console.log("📋 Contributors:");
    contributors.forEach((addr, i) => {
        console.log(`   ${i}: ${addr}`);
    });
    console.log();

    // Build Merkle tree - use keccak256 of the address directly (not as UTF-8 string)
    // This matches OpenZeppelin's MerkleProof.verify expectations
    const leaves = contributors.map(addr => 
        keccak256(addr.toLowerCase())
    );
    
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    console.log(`✅ Merkle Root: ${root}\n`);

    // Generate proof data for each contributor (for keccak256-based MerkleZKRegistry)
    const proofs = contributors.map((addr, index) => {
        const leaf = leaves[index];
        const proof = tree.getProof(leaf);
        
        // Convert proof to hex array format
        const hexProof = proof.map(p => '0x' + p.data.toString('hex'));

        return {
            leafIndex: index,
            address: addr,
            leaf: '0x' + leaf.toString('hex'),
            proof: hexProof
        };
    });

    // Save tree data in format compatible with both MerkleZKRegistry and frontend
    const treeData = {
        root: root,
        contributorCount: contributors.length,
        treeDepth: tree.getDepth(),
        hashFunction: 'keccak256',
        timestamp: new Date().toISOString(),
        leaves: leaves.map(l => '0x' + l.toString('hex')),
        contributors: contributors.map((addr, index) => ({
            address: addr,
            leafIndex: index,
            isRealContributor: index === 0  // First one is real, others are dummy
        })),
        proofs: proofs
    };

    // Save to file
    fs.writeFileSync(
        'contributor-merkle-tree.json',
        JSON.stringify(treeData, null, 2)
    );

    console.log("💾 Saved to contributor-merkle-tree.json\n");
    
    // Print example proof for first contributor
    console.log("📊 Example proof (Contributor 0):");
    console.log(`   Address: ${proofs[0].address}`);
    console.log(`   Leaf: ${proofs[0].leaf}`);
    console.log(`   Proof elements: ${proofs[0].proof.length} hashes`);
    console.log();

    console.log("✅ Done! Use this tree for Merkle proof verification.");
    console.log("   Hash function: keccak256 (compatible with OpenZeppelin MerkleProof)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
