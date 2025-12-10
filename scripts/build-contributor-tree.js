/**
 * Build Merkle tree of registered contributors
 * This tree is used to generate zkSNARK proofs
 */

const fs = require('fs');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');

async function main() {
    console.log("🌲 Building Contributor Merkle Tree\n");

    const [deployer] = await ethers.getSigners();
    
    // Use actual deployer address (you can add more contributors here)
    const contributors = [
        deployer.address,  // Your actual deployer address
        // Add more contributor addresses as needed
    ];

    console.log("📋 Contributors:");
    contributors.forEach((addr, i) => {
        console.log(`   ${i}: ${addr}`);
    });
    console.log();

    // Build Merkle tree
    const leaves = contributors.map(addr => 
        keccak256(ethers.toUtf8Bytes(addr.toLowerCase()))
    );
    
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    console.log(`✅ Merkle Root: ${root}\n`);

    // Generate proof data for each contributor
    const treeData = {
        root: root,
        leaves: contributors.map((addr, index) => {
            const leaf = leaves[index];
            const proof = tree.getProof(leaf);
            
            // Convert proof to format needed by circuit
            const pathIndices = proof.map(p => p.position === 'right' ? 1 : 0);
            const siblings = proof.map(p => BigInt('0x' + p.data.toString('hex')).toString());

            return {
                index,
                address: addr,
                leaf: leaf,
                pathIndices,
                siblings
            };
        })
    };

    // Save to file
    fs.writeFileSync(
        'contributor-merkle-tree.json',
        JSON.stringify(treeData, null, 2)
    );

    console.log("💾 Saved to contributor-merkle-tree.json\n");
    
    // Print example proof for first contributor
    console.log("📊 Example proof (Contributor 0):");
    console.log(`   Address: ${treeData.leaves[0].address}`);
    console.log(`   Path indices: [${treeData.leaves[0].pathIndices}]`);
    console.log(`   Siblings: ${treeData.leaves[0].siblings.length} nodes`);
    console.log();

    console.log("✅ Done! Use this tree for zkSNARK proof generation.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
