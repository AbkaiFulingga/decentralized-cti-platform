// scripts/redeploy-merkle-zk.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Redeploying MerkleZKRegistry with Correct Registry ===\n");
  
  // Load current addresses
  const testData = JSON.parse(fs.readFileSync("test-addresses-arbitrum.json"));
  const registryAddress = testData.PrivacyPreservingRegistry;
  
  console.log("Target Registry:", registryAddress);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // Verify Registry exists and has the fix
  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", registryAddress);
  
  try {
    const merkleZKAddr = await registry.merkleZKRegistry();
    console.log("✅ Registry has merkleZKRegistry() function (has the fix)");
    console.log("Current value:", merkleZKAddr, "\n");
  } catch (e) {
    console.log("❌ Registry doesn't have merkleZKRegistry() function");
    console.log("   This registry doesn't have the ZKP fix!");
    console.log("   Deploy a new Registry with the fix first.\n");
    process.exit(1);
  }
  
  // Deploy new MerkleZKRegistry
  console.log("🚀 Deploying MerkleZKRegistry...");
  const MerkleZK = await hre.ethers.getContractFactory("MerkleZKRegistry");
  const merkleZK = await MerkleZK.deploy(registryAddress);
  await merkleZK.waitForDeployment();
  
  const merkleZKAddress = await merkleZK.getAddress();
  console.log("✅ MerkleZK deployed:", merkleZKAddress);
  console.log("");
  
  // Load contributor tree and update
  console.log("📊 Loading contributor tree...");
  const treeData = JSON.parse(fs.readFileSync("contributor-merkle-tree.json"));
  
  console.log("Root:", treeData.root);
  console.log("Contributors:", treeData.contributorCount);
  console.log("");
  
  console.log("🔄 Initializing contributor tree...");
  const tx1 = await merkleZK.updateContributorRoot(treeData.root, treeData.contributorCount);
  await tx1.wait();
  console.log("✅ Tree initialized");
  console.log("");
  
  // Link Registry → MerkleZK
  console.log("🔗 Linking Registry to MerkleZK...");
  const tx2 = await registry.setMerkleZKRegistry(merkleZKAddress);
  await tx2.wait();
  console.log("✅ Linked!");
  console.log("");
  
  // Update files
  testData.MerkleZKRegistry = merkleZKAddress;
  testData.merkleZKLinked = true;
  testData.merkleZKRedeployed = new Date().toISOString();
  
  fs.writeFileSync("test-addresses-arbitrum.json", JSON.stringify(testData, null, 2));
  
  treeData.merkleZKAddress = merkleZKAddress;
  treeData.lastUpdate = new Date().toISOString();
  fs.writeFileSync("contributor-merkle-tree.json", JSON.stringify(treeData, null, 2));
  
  console.log("✅ Updated JSON files");
  console.log("");
  
  // Summary
  console.log("=== Deployment Complete ===");
  console.log("NEW MerkleZK:", merkleZKAddress);
  console.log("Registry:", registryAddress);
  console.log("Contributors:", treeData.contributorCount);
  console.log("");
  console.log("🔍 Verify:");
  console.log(`cast call ${merkleZKAddress} "mainRegistry()(address)" --rpc-url https://sepolia-rollup.arbitrum.io/rpc`);
  console.log(`cast call ${registryAddress} "merkleZKRegistry()(address)" --rpc-url https://sepolia-rollup.arbitrum.io/rpc`);
  console.log("");
  console.log("⚠️  IMPORTANT: Update frontend constants.js with new MerkleZK address!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
