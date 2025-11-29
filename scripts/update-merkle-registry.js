// scripts/update-merkle-registry.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Updating MerkleZK to point to NEW Registry ===\n");
  
  // Load addresses
  const addresses = JSON.parse(
    fs.readFileSync("test-addresses-arbitrum.json", "utf8")
  );
  
  const MERKLE_ZK_ADDRESS = "0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1";
  const NEW_REGISTRY_ADDRESS = addresses.PrivacyPreservingRegistry;
  
  console.log("MerkleZK Address:", MERKLE_ZK_ADDRESS);
  console.log("NEW Registry Address:", NEW_REGISTRY_ADDRESS);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address, "\n");
  
  // Get MerkleZK contract
  const merkleZK = await hre.ethers.getContractAt(
    "MerkleZKRegistry",
    MERKLE_ZK_ADDRESS
  );
  
  // Check current registry
  const oldRegistry = await merkleZK.mainRegistry();
  console.log("Current Registry:", oldRegistry);
  
  if (oldRegistry.toLowerCase() === NEW_REGISTRY_ADDRESS.toLowerCase()) {
    console.log("✅ Already pointing to correct registry!");
    return;
  }
  
  // Update to new registry
  console.log("\n🔄 Updating MerkleZK's mainRegistry...");
  const tx = await merkleZK.updateMainRegistry(NEW_REGISTRY_ADDRESS);
  console.log("TX:", tx.hash);
  
  await tx.wait();
  console.log("✅ Updated!\n");
  
  // Verify
  const newRegistry = await merkleZK.mainRegistry();
  console.log("New Registry:", newRegistry);
  console.log("\n✅ Step 1/2 Complete: MerkleZK now points to NEW Registry");
  console.log("\nNext: Run link-merkle-zk.js to complete bidirectional link");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
