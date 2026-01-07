/**
 * Build a Poseidon Merkle tree of contributors (depth 20) for zkSNARK proving.
 *
 * This script is intended for local/dev environments where you want
 * /api/contributor-tree to work without depending on server-side daemons.
 *
 * IMPORTANT:
 * - Circuit leaf: Poseidon(address)
 * - Internal nodes: Poseidon(left, right)
 * - Fixed depth: 20
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require('circomlibjs');
const { ethers } = require('ethers');

async function main() {
        console.log('🌲 Building Contributor Poseidon Merkle Tree (depth 20)\n');

        const depth = 20;
        const poseidon = await buildPoseidon();
        const F = poseidon.F;

        // Prefer explicit test contributor addresses from .env.
        const envContributors = [
            process.env.TEST_CONTRIBUTOR_1,
            process.env.TEST_CONTRIBUTOR_2,
            process.env.TEST_CONTRIBUTOR_3,
        ].filter((a) => typeof a === 'string' && a.trim().length > 0);

        // Fallback: if env doesn't specify contributors, use a deterministic dummy set.
        // NOTE: This won't match on-chain registrations; it's only to make local proving flow runnable.
        const fallback = [
            '0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82',
            '0x0000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000002',
        ];

        const contributors = (envContributors.length ? envContributors : fallback)
            .map((a) => a.trim())
            .map((a) => ethers.getAddress(a));

        console.log('📋 Contributors:');
    contributors.forEach((addr, i) => {
        console.log(`   ${i}: ${addr}`);
    });
    console.log();

        // Poseidon leaf = Poseidon(address)
        const leafForAddress = (addr) => {
            const x = ethers.toBigInt(addr);
            const out = poseidon([x]);
            return BigInt(F.toString(out));
        };

        // Build zero-subtree roots for padding
        const zeros = [0n];
        for (let i = 0; i < depth; i++) {
            const prev = zeros[i];
            const out = poseidon([prev, prev]);
            zeros.push(BigInt(F.toString(out)));
        }

        // Fill leaves to full tree size (2^depth) is too big; instead we build proofs
        // via incremental hashing with zero padding.
        // We'll compute the root by hashing pairs level-by-level on a sparse set.
        // For a small contributor list, this is fast.

        // Start with actual leaves then pad the remainder with 0-leaf.
        let levelNodes = contributors.map(leafForAddress);
        const leafCount = levelNodes.length;
        const fullLeavesAtLevel0 = 1 << Math.min(depth, 20); // depth=20 safe in JS bit ops? nope.
        // Avoid bit ops overflow; we only need to pad to next power of two at each step.
        const nextPow2 = (n) => {
            let p = 1;
            while (p < n) p <<= 1;
            return p;
        };
        const baseWidth = nextPow2(levelNodes.length);
        while (levelNodes.length < baseWidth) levelNodes.push(0n);

        // Build internal levels up to depth using zeros for missing subtrees beyond baseWidth.
        // At each level, if we run out of real nodes, we pad with the correct zero-subtree root.
        const levels = [levelNodes];
        for (let lvl = 0; lvl < depth; lvl++) {
            const cur = levels[lvl];
            const next = [];
            for (let i = 0; i < cur.length; i += 2) {
                const left = cur[i];
                const right = cur[i + 1] ?? 0n;
                const out = poseidon([left, right]);
                next.push(BigInt(F.toString(out)));
            }
            // If the tree is smaller than 2^depth, pad the remaining nodes at this level with the
            // appropriate zero-subtree root so the final root matches the fixed-depth circuit.
            const expectedWidth = Math.max(1, baseWidth >> (lvl + 1));
            while (next.length < expectedWidth) next.push(zeros[lvl + 1]);
            levels.push(next);
            if (next.length === 1) break;
        }

        // If we terminated early because baseWidth << 2^depth, continue hashing zero-subtree roots.
        let root = levels[levels.length - 1][0];
        for (let lvl = levels.length - 1; lvl < depth; lvl++) {
            const out = poseidon([root, zeros[lvl]]);
            root = BigInt(F.toString(out));
        }

        const rootHex = ethers.toBeHex(root, 32);
        console.log(`✅ Merkle Root (Poseidon, depth ${depth}): ${rootHex}\n`);

        // Build proofs for each contributor by walking up the precomputed levels.
        const proofs = contributors.map((addr, index) => {
            const pathIndices = [];
            const proof = [];
            let idx = index;
            for (let lvl = 0; lvl < depth; lvl++) {
                const isRight = idx & 1;
                pathIndices.push(isRight ? 1 : 0);
                const sibIdx = isRight ? idx - 1 : idx + 1;
                const sib = levels[lvl]?.[sibIdx] ?? zeros[lvl];
                proof.push(ethers.toBeHex(sib, 32));
                idx = Math.floor(idx / 2);
            }
            return {
                leafIndex: index,
                address: addr,
                leaf: ethers.toBeHex(leafForAddress(addr), 32),
                proof,
                pathIndices,
            };
        });

    // Save tree data in format compatible with both MerkleZKRegistry and frontend
        const treeData = {
            root: rootHex,
            contributorCount: contributors.length,
            treeDepth: depth,
            hashFunction: 'poseidon',
            timestamp: Date.now(),
            lastUpdate: new Date().toISOString(),
            contributors: contributors.map((addr, index) => ({
                address: addr,
                leafIndex: index,
                isRealContributor: index === 0,
            })),
            proofs,
        };

    // Save to file
    const outPath = path.join(__dirname, '..', 'contributor-merkle-tree.json');
    fs.writeFileSync(outPath, JSON.stringify(treeData, null, 2));
    console.log(`💾 Saved to ${outPath}\n`);
    
    // Print example proof for first contributor
    console.log("📊 Example proof (Contributor 0):");
    console.log(`   Address: ${proofs[0].address}`);
    console.log(`   Leaf: ${proofs[0].leaf}`);
    console.log(`   Proof elements: ${proofs[0].proof.length} hashes`);
    console.log();

    console.log('✅ Done! Use this tree for zkSNARK contributor proving.');
    console.log('   Hash function: poseidon');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
