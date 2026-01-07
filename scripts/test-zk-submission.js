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

// When executed via `node`, Hardhat globals like `ethers` and `network` are not defined.
// We load the Hardhat Runtime Environment (HRE) so this script can be run either way.
const hre = require('hardhat');
const { ethers, network } = hre;

const execAsync = promisify(exec);

async function generateProof(contributorAddress, contributorTreeData) {
    console.log("🔐 Generating zkSNARK proof...");
    const startTime = Date.now();

    // Circuit expects Poseidon-based proof inputs:
    //   private: address, nonce, merkleProof[20], merklePathIndices[20]
    //   public:  commitment, merkleRoot
    // Random-ish nonce is fine for a demo script; must be < field.
    const nonce = BigInt(Date.now());

    // Compute Poseidon(address, nonce) commitment exactly as the circuit does.
    // We use circomlibjs here to avoid keccak-based helpers that don't match the circuit.
    const { buildPoseidon } = require('circomlibjs');
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    const addrBig = BigInt(contributorAddress);
    const commitment = F.toObject(poseidon([addrBig, nonce]));

    // Create input.json for circuit
    const merkleProofRaw =
        contributorTreeData.proof ??
        contributorTreeData.merkleProof ??
        contributorTreeData.siblings;
    const merklePathRaw =
        contributorTreeData.pathIndices ??
        contributorTreeData.merklePathIndices ??
        contributorTreeData.path;

    const rootHex = contributorTreeData.root || contributorTreeData.merkleRoot;
    if (!rootHex) {
        throw new Error('Missing contributor Merkle root (expected contributorTreeData.root)');
    }

    const input = {
        // public
        commitment: commitment.toString(),
        merkleRoot: BigInt(rootHex).toString(),

        // private
        address: BigInt(contributorAddress).toString(),
        nonce: nonce.toString(),
        merkleProof: (merkleProofRaw || []).map((x) => BigInt(x).toString()),
        merklePathIndices: merklePathRaw
    };

    // Use the same artifacts/schema as the frontend prover (known-good).
    console.log("   ⏳ Computing zkSNARK proof via snarkjs.groth16.fullProve...");
    const snarkjs = require('snarkjs');
    const wasmPath = path.join(__dirname, '../cti-frontend/public/circuits/contributor-proof.wasm');
    const zkeyPath = path.join(__dirname, '../cti-frontend/public/circuits/contributor-proof_final.zkey');
    if (!fs.existsSync(wasmPath)) throw new Error(`Missing WASM: ${wasmPath}`);
    if (!fs.existsSync(zkeyPath)) throw new Error(`Missing zkey: ${zkeyPath}`);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    console.log("   ✅ Proof generated");

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

function uintToBytes32(u) {
    const hex = BigInt(u).toString(16).padStart(64, '0');
    return `0x${hex}`;
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
    const leaves = iocs.map((ioc) => ethers.keccak256(ethers.toUtf8Bytes(ioc)));
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    console.log(`   ✅ Merkle root: ${root}\n`);
    return { tree, root };
}

async function main() {
    console.log("=" .repeat(60));
    console.log("🧪 zkSNARK Anonymous IOC Submission Test");
    console.log("=" .repeat(60) + "\n");

    // This script is meant to hit the *live* Arbitrum Sepolia deployment.
    // When executed via `node`, HRE's default network is `hardhat`, so we explicitly
    // create a provider+signer from env vars.
    const rpcUrl = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL;
    const pk = process.env.PRIVATE_KEY_ADMIN1 || process.env.ORACLE_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!rpcUrl) throw new Error('Missing ARBITRUM_RPC (or ARBITRUM_RPC_URL) in .env');
    if (!pk) throw new Error('Missing PRIVATE_KEY_ADMIN1 (or ORACLE_PRIVATE_KEY / PRIVATE_KEY) in .env');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(pk, provider);

    // Load deployment addresses (single source of truth for the app/scripts)
    const addresses = JSON.parse(fs.readFileSync('test-addresses-arbitrum.json', 'utf8'));
    const registryAddress =
        addresses.PrivacyPreservingRegistry ||
        addresses.privacyPreservingRegistry ||
        addresses.registry;
    if (!registryAddress) throw new Error('Could not find privacyPreservingRegistry in test-addresses-arbitrum.json');
    
    console.log("📋 Test Configuration:");
    console.log(`Network: arbitrumSepolia`);
    console.log(`Registry: ${registryAddress}\n`);

    console.log(`Submitter: ${signer.address}\n`);

    // Load contributor Merkle tree data
    const contributorTree = JSON.parse(fs.readFileSync('contributor-merkle-tree.json', 'utf8'));
    
    // Find contributor's path/proof in tree (current schema uses `proofs[]`)
    const contributorLeaf = (contributorTree.proofs || []).find(
        (p) => (p.address || '').toLowerCase() === signer.address.toLowerCase()
    );
    
    if (!contributorLeaf) {
        console.error("❌ Contributor not found in Merkle tree!");
        console.log("Run: npx hardhat run scripts/build-contributor-tree.js --network arbitrumSepolia");
        process.exit(1);
    }

    console.log("✅ Contributor found in tree");
    console.log(`   Leaf index: ${contributorLeaf.leafIndex}`);
    console.log(`   Path indices: [${contributorLeaf.pathIndices}]`);
    console.log(`   Siblings: ${contributorLeaf.proof.length} nodes\n`);

    // ============ STEP 1: Generate zkSNARK Proof ============
    
    const { proof, publicSignals, generationTime } = await generateProof(
        signer.address,
        { ...contributorLeaf, root: contributorTree.root }
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
    
    // Attach to live registry.
    // IMPORTANT: If the Hardhat artifact ABI is stale/mismatched, it can lead to empty calldata.
    // We'll verify the ABI contains the ZK method and fall back to the frontend ABI if needed.
    let registry;
    {
        const Registry = await hre.ethers.getContractFactory("PrivacyPreservingRegistry", signer);
        registry = Registry.attach(registryAddress);
    }

    // Use the Hardhat artifact ABI, which matches the deployed PrivacyPreservingRegistry
    // signature in contracts/PrivacyPreservingRegistry.sol.
    const zkFn = "addBatchWithZKProof";
    const hardhatAbiHasZk = typeof registry[zkFn] === 'function';
    console.log(`   ABI check (Hardhat artifact) has ${zkFn}:`, hardhatAbiHasZk);
    if (!hardhatAbiHasZk) {
        throw new Error('Hardhat artifact ABI is missing addBatchWithZKProof; recompile or check artifact mismatch');
    }

    // Format proof for Solidity (arrays expected by on-chain function)
    const formattedProof = formatProofForSolidity(proof);

    // Calculate submission fee (1%)
    const gasPrice = (await provider.getFeeData()).gasPrice;
    const estimatedGas = 200000n;
    const submissionFee = (estimatedGas * gasPrice) / 100n;

    console.log(`   Submission fee: ${ethers.formatEther(submissionFee)} ETH`);

    // Build calldata explicitly and assert it's non-empty before sending
    // On-chain signature (see contracts/PrivacyPreservingRegistry.sol):
    // addBatchWithZKProof(string cid, bytes32 iocMerkleRoot, uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[2] pubSignals)
    const pubSignals = publicSignals.map((s) => BigInt(s));
    const args = [ipfsCid, iocMerkleRoot, formattedProof.pA, formattedProof.pB, formattedProof.pC, pubSignals];

    const data = registry.interface.encodeFunctionData(zkFn, args);
    if (!data || data === '0x') {
        throw new Error('Encoded calldata is empty; ABI mismatch persists');
    }
    console.log('   Encoded calldata bytes:', (data.length - 2) / 2);

    // Preflight to catch revert reasons before spending gas
    try {
        await registry.addBatchWithZKProof.staticCall(...args, { value: submissionFee });
        console.log('   ✅ staticCall preflight passed');
    } catch (e) {
        console.log('   ❌ staticCall preflight reverted:', e.shortMessage || e.message);
        throw e;
    }

    // Estimate gas once and pass an explicit gasLimit so the send uses the same execution path.
    const est = await registry.addBatchWithZKProof.estimateGas(...args, { value: submissionFee });
    const gasLimit = (est * 12n) / 10n; // +20%
    console.log('   Estimated gas:', est.toString(), '-> using gasLimit', gasLimit.toString());

    // Submit with proof
    const tx = await registry.addBatchWithZKProof(...args, { value: submissionFee, gasLimit });

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
