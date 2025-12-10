const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Redeploy ZKVerifier with updated Merkle root
 * Uses existing Groth16Verifier and new contributor tree root
 */
async function main() {
  console.log("\n🔐 Redeploying ZKVerifier with Updated Merkle Root...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Load existing deployment data
  const zkDataPath = path.join(__dirname, "../deployments/zkverifier-arbitrum.json");
  const zkData = JSON.parse(fs.readFileSync(zkDataPath, "utf8"));
  
  const addressPath = path.join(__dirname, "../test-addresses-arbitrum.json");
  const addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));

  // Load new Merkle root from contributor tree
  const treePath = path.join(__dirname, "../contributor-merkle-tree.json");
  const treeData = JSON.parse(fs.readFileSync(treePath, "utf8"));

  console.log("📋 Existing Deployment:");
  console.log(`   Groth16Verifier: ${zkData.groth16Verifier}`);
  console.log(`   Old ZKVerifier: ${zkData.zkVerifier}`);
  console.log(`   Old Root: ${zkData.merkleRoot}\n`);

  console.log("🌲 New Merkle Tree:");
  console.log(`   Root: ${treeData.root}`);
  console.log(`   Contributors: ${treeData.leaves.length}`);
  console.log(`   Addresses:`);
  treeData.leaves.forEach((leaf, i) => {
    console.log(`      ${i}: ${leaf.address}`);
  });
  console.log();

  // Deploy new ZKVerifier with updated root
  console.log("🚀 Deploying new ZKVerifier...");
  const ZKVerifier = await hre.ethers.getContractFactory("ZKVerifier");
  
  // Convert hex root to BigInt for constructor
  const merkleRootBigInt = BigInt(treeData.root);
  
  const zkVerifier = await ZKVerifier.deploy(
    zkData.groth16Verifier,  // Reuse existing Groth16Verifier
    merkleRootBigInt         // New Merkle root
  );
  await zkVerifier.waitForDeployment();
  
  const newZKVerifierAddress = await zkVerifier.getAddress();
  console.log(`✅ New ZKVerifier deployed: ${newZKVerifierAddress}\n`);

  // Link to Registry
  console.log("🔗 Linking to Registry...");
  let tx = await zkVerifier.setRegistry(addresses.registry);
  await tx.wait();
  console.log(`✅ Registry set: ${addresses.registry}\n`);

  // Update Registry to use new ZKVerifier
  console.log("🔗 Updating Registry...");
  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", addresses.registry);
  tx = await registry.setZKVerifier(newZKVerifierAddress);
  await tx.wait();
  console.log(`✅ Registry now uses new ZKVerifier\n`);

  // Verify the setup
  console.log("✅ Verifying setup...");
  const currentRoot = await zkVerifier.currentMerkleRoot();
  const isValid = await zkVerifier.isMerkleRootValid(merkleRootBigInt);
  const registryInZK = await zkVerifier.registry();
  const zkInRegistry = await registry.zkVerifier();

  console.log(`   Current root: ${currentRoot}`);
  console.log(`   Root valid: ${isValid}`);
  console.log(`   Registry → ZKVerifier: ${zkInRegistry}`);
  console.log(`   ZKVerifier → Registry: ${registryInZK}`);
  console.log(`   Links correct: ${zkInRegistry === newZKVerifierAddress && registryInZK === addresses.registry}\n`);

  // Update deployment records
  console.log("💾 Updating deployment records...");
  
  // Update zkverifier-arbitrum.json
  zkData.zkVerifier = newZKVerifierAddress;
  zkData.merkleRoot = treeData.root;
  zkData.deployedAt = new Date().toISOString();
  zkData.contributors = treeData.leaves.map(l => l.address);
  fs.writeFileSync(zkDataPath, JSON.stringify(zkData, null, 2));
  console.log(`   Updated: ${zkDataPath}`);

  // Update test-addresses-arbitrum.json
  addresses.zkVerifier = newZKVerifierAddress;
  addresses.zkVerifierUpdatedAt = new Date().toISOString();
  fs.writeFileSync(addressPath, JSON.stringify(addresses, null, 2));
  console.log(`   Updated: ${addressPath}\n`);

  console.log("✅ REDEPLOYMENT COMPLETE!\n");
  console.log("📋 Summary:");
  console.log(`   Old ZKVerifier: ${zkData.zkVerifier} (no longer used)`);
  console.log(`   New ZKVerifier: ${newZKVerifierAddress}`);
  console.log(`   Merkle Root: ${treeData.root}`);
  console.log(`   Contributors: ${treeData.leaves.length}\n`);

  console.log("🎯 Next Steps:");
  console.log("   1. Generate zkSNARK proof:");
  console.log("      cd circuits");
  console.log("      # Create input.json with your contributor data");
  console.log("      snarkjs groth16 prove circuit_final.zkey input.json proof.json public.json");
  console.log("      cd ..");
  console.log();
  console.log("   2. Test anonymous submission:");
  console.log("      npx hardhat run scripts/test-zk-proof-submission.js --network arbitrumSepolia\n");
  console.log("   3. Test replay attack:");
  console.log("      npx hardhat run scripts/test-replay-attack.js --network arbitrumSepolia\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
