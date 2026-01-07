/**
 * Complete deployment script with zkSNARK integration
 * Deploys all contracts and links them together:
 * 1. PrivacyPreservingRegistry (updated with ZK support)
 * 2. ThresholdGovernance
 * 3. StorageContribution
 * 4. Links ZKVerifier (already deployed)
 */

const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Starting complete deployment with zkSNARK integration...\n");

    // Allow running with only a single configured private key.
    // If admin2/admin3 are missing, reuse admin1 so deployment can proceed.
    const signers = await ethers.getSigners();
    const admin1 = signers[0];
    const admin2 = signers[1] || admin1;
    const admin3 = signers[2] || admin1;
    console.log("📋 Deployment Details:");
    console.log(`Network: ${network.name}`);
    console.log(`Admin 1 (Deployer): ${admin1.address}`);
    console.log(`Admin 2: ${admin2.address}`);
    console.log(`Admin 3: ${admin3.address}\n`);

    // Load existing ZKVerifier address (supports multiple JSON formats)
    // Preferred: deployments/zkverifier-arbitrum.json (top-level `zkVerifier`)
    // Fallback: deployment-complete-zk.json / other files with `contracts.zkVerifier`.
    let zkVerifierAddress;
    const zkVerifierCandidates = [
        'deployments/zkverifier-arbitrum.json',
        'deployment-complete-zk.json',
        'test-addresses-arbitrum.json'
    ];
    for (const filename of zkVerifierCandidates) {
        try {
            const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'));
            zkVerifierAddress = parsed?.zkVerifier || parsed?.contracts?.zkVerifier;
            if (zkVerifierAddress) {
                console.log(`✅ Found existing ZKVerifier (${filename}): ${zkVerifierAddress}\n`);
                break;
            }
        } catch (_) {
            // ignore
        }
    }
    if (!zkVerifierAddress) {
        console.log("⚠️  ZKVerifier address not found. Deploy it first with scripts/deploy-zkverifier.js");
        process.exit(1);
    }

    // ============ DEPLOY CONTRACTS ============
    
    console.log("📦 Step 1: Deploying PrivacyPreservingRegistry...");
    const Registry = await ethers.getContractFactory("PrivacyPreservingRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`✅ PrivacyPreservingRegistry deployed: ${registryAddress}`);
    
    // Get deployment transaction for gas cost
    const registryTx = registry.deploymentTransaction();
    const registryReceipt = await registryTx.wait();
    console.log(`   Gas used: ${registryReceipt.gasUsed.toString()}\n`);

    console.log("📦 Step 2: Deploying ThresholdGovernance...");
    const Governance = await ethers.getContractFactory("ThresholdGovernance");
    const governance = await Governance.deploy(
        [admin1.address, admin2.address, admin3.address],
        3, // 3-of-3 threshold (matches platform design)
        registryAddress
    );
    await governance.waitForDeployment();
    const governanceAddress = await governance.getAddress();
    console.log(`✅ ThresholdGovernance deployed: ${governanceAddress}`);
    
    const govTx = governance.deploymentTransaction();
    const govReceipt = await govTx.wait();
    console.log(`   Gas used: ${govReceipt.gasUsed.toString()}\n`);

    console.log("📦 Step 3: Deploying StorageContribution...");
    const Storage = await ethers.getContractFactory("StorageContribution");
    const storage = await Storage.deploy(registryAddress, governanceAddress);
    await storage.waitForDeployment();
    const storageAddress = await storage.getAddress();
    console.log(`✅ StorageContribution deployed: ${storageAddress}`);
    
    const storageTx = storage.deploymentTransaction();
    const storageReceipt = await storageTx.wait();
    console.log(`   Gas used: ${storageReceipt.gasUsed.toString()}\n`);

    // ============ LINK CONTRACTS ============
    
    console.log("🔗 Step 4: Linking contracts...\n");
    
    console.log("   Setting governance in registry...");
    const tx1 = await registry.setGovernance(governanceAddress);
    await tx1.wait();
    console.log("   ✅ Governance linked to registry");
    
    console.log("   Setting ZKVerifier in registry...");
    const tx2 = await registry.setZKVerifier(zkVerifierAddress);
    await tx2.wait();
    console.log("   ✅ ZKVerifier linked to registry");

    // Update ZKVerifier to know about registry
    console.log("   Setting registry in ZKVerifier...");
    const ZKVerifier = await ethers.getContractAt("ZKVerifier", zkVerifierAddress);
    const tx3 = await ZKVerifier.setRegistry(registryAddress);
    await tx3.wait();
    console.log("   ✅ Registry linked to ZKVerifier\n");

    // ============ SAVE ADDRESSES ============
    
    const addresses = {
        network: network.name,
        deployedAt: new Date().toISOString(),
        contracts: {
            privacyPreservingRegistry: registryAddress,
            thresholdGovernance: governanceAddress,
            storageContribution: storageAddress,
            zkVerifier: zkVerifierAddress,
            groth16Verifier: (await ZKVerifier.groth16Verifier())
        },
        admins: {
            admin1: admin1.address,
            admin2: admin2.address,
            admin3: admin3.address
        },
        gasUsed: {
            registry: registryReceipt.gasUsed.toString(),
            governance: govReceipt.gasUsed.toString(),
            storage: storageReceipt.gasUsed.toString(),
            total: (registryReceipt.gasUsed + govReceipt.gasUsed + storageReceipt.gasUsed).toString()
        }
    };

    const filename = 'deployment-complete-zk.json';
    fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
    console.log(`💾 Deployment info saved to ${filename}\n`);

    // ============ SUMMARY ============
    
    console.log("=" .repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!\n");
    console.log("📋 Contract Addresses:");
    console.log(`   PrivacyPreservingRegistry: ${registryAddress}`);
    console.log(`   ThresholdGovernance: ${governanceAddress}`);
    console.log(`   StorageContribution: ${storageAddress}`);
    console.log(`   ZKVerifier: ${zkVerifierAddress}`);
    console.log(`   Groth16Verifier: ${await ZKVerifier.groth16Verifier()}\n`);
    
    console.log("⛽ Total Gas Used: " + addresses.gasUsed.total);
    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Ready to test anonymous submissions with zkSNARKs!");
    console.log("Next steps:");
    console.log("1. Run: npx hardhat run scripts/test-zk-submission.js --network arbitrumSepolia");
    console.log("2. Check the frontend dashboard");
    console.log("3. Verify proofs on block explorer\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
