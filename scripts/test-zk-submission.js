/**
 * Test zkSNARK-based anonymous IOC submission
 * 
 * This script demonstrates the complete workflow:
 * 1. Generate zkSNARK proof (proving contributor is registered)
 * 2. Upload IOC batch to IPFS via Pinata
 * 3. Submit batch on-chain with proof (anonymous)
 * 4. Verify submission was successful
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');

const execAsync = promisify(exec);

async function generateProof(contributorAddress, contributorTreeData) {
    console.log("🔐 Generating zkSNARK proof...");
    const startTime = Date.now();

    // Create input.json for circuit
    const input = {
        address: BigInt(contributorAddress).toString(),
        pathIndices: contributorTreeData.pathIndices,
        siblings: contributorTreeData.siblings
    };

    // Write input file
    const inputPath = path.join(__dirname, '../circuits/input.json');
    fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
    console.log("   ✅ Input file created");

    // Generate witness
    console.log("   ⏳ Generating witness...");
    const witnessCmd = `cd circuits && node contributor-proof_js/generate_witness.js contributor-proof_js/contributor-proof.wasm input.json witness.wtns`;
    await execAsync(witnessCmd);
    console.log("   ✅ Witness generated");

    // Generate proof
    console.log("   ⏳ Computing zkSNARK proof (this takes 10-30 seconds)...");
    const proofCmd = `cd circuits && snarkjs groth16 prove contributor-proof_final.zkey witness.wtns proof.json public.json`;
    await execAsync(proofCmd);
    console.log("   ✅ Proof generated");

    // Read proof and public signals
    const proof = JSON.parse(fs.readFileSync(path.join(__dirname, '../circuits/proof.json')));
    const publicSignals = JSON.parse(fs.readFileSync(path.join(__dirname, '../circuits/public.json')));

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ⏱️  Proof generation time: ${elapsedTime}s\n`);

    return { proof, publicSignals, generationTime: elapsedTime };
}

function formatProofForSolidity(proof) {
    // Convert SnarkJS proof format to Solidity function parameters
    return {
        pA: [proof.pi_a[0], proof.pi_a[1]],
        pB: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        pC: [proof.pi_c[0], proof.pi_c[1]]
    };
}

async function uploadToIPFS(iocs) {
    console.log("📤 Uploading IOCs to IPFS via Pinata...");
    
    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
        throw new Error("PINATA_JWT not found in .env");
    }

    const data = {
        pinataContent: { iocs },
        pinataMetadata: {
            name: `batch-zk-${Date.now()}.json`
        }
    };

    const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        data,
        {
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
                'Content-Type': 'application/json'
            }
        }
    );

    console.log(`   ✅ Uploaded to IPFS: ${response.data.IpfsHash}\n`);
    return response.data.IpfsHash;
}

function buildMerkleTree(iocs) {
    console.log("🌲 Building Merkle tree from IOCs...");
    const leaves = iocs.map(ioc => keccak256(ethers.toUtf8Bytes(ioc)));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    console.log(`   ✅ Merkle root: ${root}\n`);
    return { tree, root };
}

async function main() {
    console.log("=" .repeat(60));
    console.log("🧪 zkSNARK Anonymous IOC Submission Test");
    console.log("=" .repeat(60) + "\n");

    // Load deployment addresses
    const addresses = JSON.parse(fs.readFileSync('deployment-complete-zk.json', 'utf8'));
    const registryAddress = addresses.contracts.privacyPreservingRegistry;
    
    console.log("📋 Test Configuration:");
    console.log(`Network: ${network.name}`);
    console.log(`Registry: ${registryAddress}\n`);

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(`Submitter: ${signer.address}\n`);

    // Load contributor Merkle tree data
    const contributorTree = JSON.parse(fs.readFileSync('contributor-merkle-tree.json', 'utf8'));
    
    // Find contributor's path in tree
    const contributorLeaf = contributorTree.leaves.find(
        leaf => leaf.address.toLowerCase() === signer.address.toLowerCase()
    );
    
    if (!contributorLeaf) {
        console.error("❌ Contributor not found in Merkle tree!");
        console.log("Run: npx hardhat run scripts/build-contributor-tree.js --network arbitrumSepolia");
        process.exit(1);
    }

    console.log("✅ Contributor found in tree");
    console.log(`   Index: ${contributorLeaf.index}`);
    console.log(`   Path indices: [${contributorLeaf.pathIndices}]`);
    console.log(`   Siblings: ${contributorLeaf.siblings.length} nodes\n`);

    // ============ STEP 1: Generate zkSNARK Proof ============
    
    const { proof, publicSignals, generationTime } = await generateProof(
        signer.address,
        contributorLeaf
    );

    console.log("📊 Proof Statistics:");
    console.log(`   Generation time: ${generationTime}s`);
    console.log(`   Commitment: 0x${BigInt(publicSignals[0]).toString(16)}`);
    console.log(`   Merkle root: 0x${BigInt(publicSignals[1]).toString(16)}`);
    console.log(`   Proof size: ${JSON.stringify(proof).length} bytes\n`);

    // ============ STEP 2: Prepare IOC Batch ============
    
    const sampleIOCs = [
        "192.168.1.100",
        "malicious-domain.com",
        "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",  // SHA-256
        "10.0.0.50",
        "evil-site.org"
    ];

    console.log("📦 Sample IOC Batch:");
    sampleIOCs.forEach((ioc, i) => console.log(`   ${i + 1}. ${ioc}`));
    console.log();

    // ============ STEP 3: Upload to IPFS ============
    
    const ipfsCid = await uploadToIPFS(sampleIOCs);

    // ============ STEP 4: Build IOC Merkle Tree ============
    
    const { root: iocMerkleRoot } = buildMerkleTree(sampleIOCs);

    // ============ STEP 5: Submit to Registry ============
    
    console.log("📝 Submitting batch with zkSNARK proof...");
    
    const Registry = await ethers.getContractFactory("PrivacyPreservingRegistry");
    const registry = Registry.attach(registryAddress);

    // Format proof for Solidity
    const formattedProof = formatProofForSolidity(proof);

    // Calculate submission fee (1%)
    const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
    const estimatedGas = 200000n;
    const submissionFee = (estimatedGas * gasPrice) / 100n;

    console.log(`   Submission fee: ${ethers.formatEther(submissionFee)} ETH`);

    // Submit with proof
    const tx = await registry.addBatchWithZKProof(
        ipfsCid,
        iocMerkleRoot,
        formattedProof.pA,
        formattedProof.pB,
        formattedProof.pC,
        publicSignals.map(s => BigInt(s)),
        { value: submissionFee }
    );

    console.log(`   ⏳ Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Batch submitted! Gas used: ${receipt.gasUsed.toString()}\n`);

    // ============ STEP 6: Verify Submission ============
    
    console.log("🔍 Verifying submission...");
    const batchCount = await registry.getBatchCount();
    const latestBatchIndex = batchCount - 1n;
    
    const batch = await registry.getBatch(latestBatchIndex);
    console.log(`   Batch index: ${latestBatchIndex}`);
    console.log(`   IPFS CID: ${batch.cid}`);
    console.log(`   Merkle root: ${batch.merkleRoot}`);
    console.log(`   Is public: ${batch.isPublic}`);
    console.log(`   Contributor hash: ${batch.contributorHash}`);
    console.log(`   Timestamp: ${new Date(Number(batch.timestamp) * 1000).toISOString()}\n`);

    // ============ SUMMARY ============
    
    console.log("=" .repeat(60));
    console.log("✅ TEST COMPLETE!\n");
    console.log("📊 Performance Metrics:");
    console.log(`   Proof generation: ${generationTime}s`);
    console.log(`   On-chain gas: ${receipt.gasUsed.toString()}`);
    console.log(`   Proof size: ${JSON.stringify(proof).length} bytes`);
    console.log(`   IPFS upload: Success`);
    console.log("\n🎉 Anonymous submission successful!");
    console.log(`   Your identity is hidden by commitment: ${batch.contributorHash}`);
    console.log(`   Transaction: https://sepolia.arbiscan.io/tx/${tx.hash}`);
    console.log("=" .repeat(60) + "\n");

    // Save test results
    const testResults = {
        timestamp: new Date().toISOString(),
        network: network.name,
        batchIndex: latestBatchIndex.toString(),
        commitment: batch.contributorHash,
        ipfsCid: ipfsCid,
        metrics: {
            proofGenerationTime: generationTime,
            gasUsed: receipt.gasUsed.toString(),
            proofSize: JSON.stringify(proof).length,
            transactionHash: tx.hash
        }
    };

    fs.writeFileSync('zk-test-results.json', JSON.stringify(testResults, null, 2));
    console.log("💾 Test results saved to zk-test-results.json\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });
