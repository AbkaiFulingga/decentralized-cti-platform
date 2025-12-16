/**
 * Build Contributor Merkle Tree using Poseidon Hash
 * This matches the circuit's MerkleTreeInclusionProof which uses Poseidon(2)
 */

const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');

async function main() {
    console.log("🌲 Building Poseidon-based Contributor Merkle Tree\n");

    // Get signer from Hardhat
    const [signer] = await ethers.getSigners();
    const wallet = signer;
    
    // List of contributor addresses (add more as needed)
    const contributors = [
        wallet.address  // Your wallet address
    ];

    console.log("📋 Contributors:");
    contributors.forEach((addr, i) => {
        console.log(`   ${i + 1}: ${addr}`);
    });
    console.log();

    // Build Poseidon hash function
    console.log("⚙️  Initializing Poseidon hash...");
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    // Convert addresses to BigInt leaves
    const leaves = contributors.map(addr => ethers.toBigInt(addr));
    console.log("✅ Converted addresses to BigInt leaves\n");

    // Build Merkle tree manually using Poseidon
    // Tree depth = 20 (same as circuit)
    const depth = 20;
    let currentLevel = [...leaves];
    
    console.log(`🔨 Building Merkle tree (depth ${depth})...`);
    console.log(`   Level 0: ${currentLevel.length} leaves`);

    // Pad to power of 2
    const targetSize = Math.pow(2, depth);
    while (currentLevel.length < targetSize) {
        currentLevel.push(0n);  // Pad with zeros
    }

    // Build tree level by level
    const tree = [currentLevel];
    for (let level = 0; level < depth; level++) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1];
            
            // Hash with Poseidon(2)
            const hash = poseidon([left, right]);
            const hashBigInt = F.toObject(hash);
            nextLevel.push(hashBigInt);
        }
        currentLevel = nextLevel;
        tree.push(currentLevel);
    }

    const root = '0x' + currentLevel[0].toString(16).padStart(64, '0');
    console.log(`✅ Merkle Root: ${root}\n`);

    // Generate proofs for each contributor
    console.log("📝 Generating Merkle proofs...");
    const proofsData = [];
    
    for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
        const proof = [];
        const pathIndices = [];
        
        let index = leafIndex;
        for (let level = 0; level < depth; level++) {
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
            proof: proof,
            pathIndices: pathIndices
        });
        
        console.log(`   ✅ Generated proof for ${contributors[leafIndex]}`);
    }
    console.log();

    // Save tree data
    const treeData = {
        root: root,
        leaves: leaves.map(l => '0x' + l.toString(16).padStart(64, '0')),
        contributors: contributors,
        contributorCount: contributors.length,
        treeDepth: depth,
        hashFunction: 'Poseidon',
        timestamp: Date.now(),
        lastUpdate: new Date().toISOString(),
        network: 'arbitrumSepolia',
        proofs: proofsData
    };

    const outputPath = './contributor-merkle-tree.json';
    fs.writeFileSync(outputPath, JSON.stringify(treeData, null, 2));
    
    console.log(`💾 Saved to: ${outputPath}`);
    console.log(`\n✨ Poseidon-based tree built successfully!`);
    console.log(`\nNext steps:`);
    console.log(`1. Copy to server: scp contributor-merkle-tree.json sc@192.168.1.11:~/blockchain-dev/`);
    console.log(`2. Update contract: npx hardhat run scripts/update-merkle-root-onchain.js --network arbitrumSepolia`);
    console.log(`3. Copy to frontend: cp contributor-merkle-tree.json cti-frontend/public/`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
