// scripts/check-merkle-config.js
const hre = require("hardhat");

async function main() {
  console.log("=== Checking MerkleZK Configuration ===\n");
  
  const MERKLE_ZK = "0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1";
  const OLD_REGISTRY = "0x892AD6E47dbD86aD7855f7eEAe0F4fCa6223C36A";
  const NEW_REGISTRY = "0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E";
  
  const merkleZK = await hre.ethers.getContractAt("MerkleZKRegistry", MERKLE_ZK);
  
  const currentRegistry = await merkleZK.mainRegistry();
  console.log("MerkleZK Address:", MERKLE_ZK);
  console.log("Current mainRegistry:", currentRegistry);
  console.log("");
  console.log("Expected (OLD):", OLD_REGISTRY);
  console.log("Expected (NEW):", NEW_REGISTRY);
  console.log("");
  
  if (currentRegistry.toLowerCase() === OLD_REGISTRY.toLowerCase()) {
    console.log("❌ PROBLEM: MerkleZK is pointing to OLD Registry!");
    console.log("   This is why you're getting 'Invalid ZKP commitment' error");
    console.log("");
    console.log("✅ SOLUTION: Run update-merkle-registry.js");
    console.log("   npx hardhat run scripts/update-merkle-registry.js --network arbitrumSepolia");
  } else if (currentRegistry.toLowerCase() === NEW_REGISTRY.toLowerCase()) {
    console.log("✅ CORRECT: MerkleZK is pointing to NEW Registry");
  } else {
    console.log("⚠️  UNKNOWN: MerkleZK is pointing to unexpected address");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
