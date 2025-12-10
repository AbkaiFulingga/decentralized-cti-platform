const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Update ZKVerifier Merkle root with new contributor tree
 * 
 * Note: updateMerkleRoot() is onlyRegistry, so we need a workaround
 * Option 1: Deploy new ZKVerifier with correct root
 * Option 2: Add manual root addition function (requires contract update)
 * 
 * For now: Shows current state and instructions
 */
async function main() {
  console.log("\n🔐 Checking ZKVerifier Merkle Root Status...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log(`🔑 Signer: ${signer.address}`);

  // Load addresses
  const addressPath = path.join(__dirname, "../test-addresses-arbitrum.json");
  const addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  
  const deploymentPath = path.join(__dirname, "../deployments/zkverifier-arbitrum.json");
  const zkData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  // Load contributor tree
  const treePath = path.join(__dirname, "../contributor-merkle-tree.json");
  const treeData = JSON.parse(fs.readFileSync(treePath, "utf8"));

  console.log(`📋 ZKVerifier: ${zkData.zkVerifier}`);
  console.log(`📋 Registry: ${addresses.registry}`);
  console.log(`🌲 New Merkle Root: ${treeData.root}\n`);

  // Check current state
  const zkVerifier = await hre.ethers.getContractAt("ZKVerifier", zkData.zkVerifier);
  
  console.log("📊 Current State:");
  const owner = await zkVerifier.owner();
  console.log(`   Owner: ${owner}`);
  console.log(`   Is owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`);
  
  const registry = await zkVerifier.registry();
  console.log(`   Registry: ${registry}`);
  
  const currentRoot = await zkVerifier.currentMerkleRoot();
  console.log(`   Current Root: ${currentRoot}`);
  
  // Check if new root is already valid
  const newRootBigInt = BigInt(treeData.root);
  const isValid = await zkVerifier.isMerkleRootValid(newRootBigInt);
  console.log(`   New root valid: ${isValid}\n`);

  if (isValid) {
    console.log("✅ New Merkle root is already valid!");
    console.log("   You can proceed with proof generation.\n");
    return;
  }

  console.log("⚠️  Issue: New Merkle root is NOT in validMerkleRoots mapping");
  console.log("\n📋 Solutions:\n");
  
  console.log("Option 1: Redeploy ZKVerifier with new root (RECOMMENDED)");
  console.log("   npx hardhat run scripts/redeploy-zkverifier.js --network arbitrumSepolia");
  console.log("   Cost: ~$0.15, Time: 2 mins\n");
  
  console.log("Option 2: Use the initial root from deployment");
  console.log(`   The deployed root was: ${zkData.merkleRoot || 'check deployment'}`);
  console.log("   Rebuild contributor tree with the 3 addresses used during deployment\n");
  
  console.log("Option 3: Test with mock proof (will fail verification but shows workflow)");
  console.log("   npx hardhat run scripts/test-zk-proof-submission.js --network arbitrumSepolia\n");

  // Check what root was used at deployment
  const deployedRoot = await zkVerifier.currentMerkleRoot();
  console.log(`🔍 Root at deployment: ${deployedRoot}`);
  console.log(`🔍 Root we want: ${newRootBigInt}`);
  console.log(`   Match: ${deployedRoot.toString() === newRootBigInt.toString()}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
