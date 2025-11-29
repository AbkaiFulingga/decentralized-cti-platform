// scripts/link-merkle-zk.js
// Run this AFTER deploy-merkle-zk.js to link MerkleZKRegistry to PrivacyPreservingRegistry
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Linking MerkleZKRegistry to PrivacyPreservingRegistry ===\n");
  
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  if (chainId !== "421614") {
    console.log("❌ This script is for Arbitrum Sepolia only (chainId: 421614)");
    console.log(`   Current network: ${chainId}`);
    process.exit(1);
  }
  
  // Load addresses
  const testData = JSON.parse(fs.readFileSync("test-addresses-arbitrum.json"));
  
  // Use existing MerkleZK from contributor-merkle-tree.json
  let merkleZKAddress;
  try {
    const merkleTreeData = JSON.parse(fs.readFileSync("contributor-merkle-tree.json"));
    merkleZKAddress = merkleTreeData.merkleZKAddress;
  } catch (error) {
    // Fallback to deployments file if it exists
    try {
      const merkleZKData = JSON.parse(fs.readFileSync("deployments/merkle-zk-arbitrum.json"));
      merkleZKAddress = merkleZKData.MerkleZKRegistry;
    } catch (e) {
      console.log("❌ Cannot find MerkleZK address in either file");
      process.exit(1);
    }
  }
  
  const registryAddress = testData.PrivacyPreservingRegistry;
  
  console.log("Registry Address:", registryAddress);
  console.log("MerkleZK Address:", merkleZKAddress);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Connect to registry
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    registryAddress
  );
  
  // Check current owner
  const owner = await registry.owner();
  console.log("Registry Owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ Not owner! Cannot set MerkleZKRegistry address");
    process.exit(1);
  }
  
  // Check if already set
  try {
    const currentMerkleZK = await registry.merkleZKRegistry();
    if (currentMerkleZK === merkleZKAddress) {
      console.log("✅ MerkleZKRegistry already linked!");
      return;
    }
    console.log("Current MerkleZK:", currentMerkleZK);
  } catch (error) {
    console.log("MerkleZK not yet set");
  }
  
  // Set MerkleZKRegistry address
  console.log("\n🔗 Setting MerkleZKRegistry address...");
  const tx = await registry.setMerkleZKRegistry(merkleZKAddress);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ MerkleZKRegistry linked successfully!");
  
  // Verify
  const verifyAddress = await registry.merkleZKRegistry();
  console.log("\n🔍 Verification:");
  console.log("Expected:", merkleZKAddress);
  console.log("On-chain:", verifyAddress);
  console.log("Match:", verifyAddress === merkleZKAddress ? "✅" : "❌");
  
  // Update deployment file
  testData.MerkleZKRegistry = merkleZKAddress;
  testData.merkleZKLinked = true;
  testData.linkTimestamp = new Date().toISOString();
  
  fs.writeFileSync("test-addresses-arbitrum.json", JSON.stringify(testData, null, 2));
  console.log("\n✅ Updated test-addresses-arbitrum.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
