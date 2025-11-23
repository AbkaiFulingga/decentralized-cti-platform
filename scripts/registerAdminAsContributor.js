// scripts/registerAdminAsContributor.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Registering Admin 1 as STANDARD Contributor ===\n");
  
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  const testDataFile = chainId === "421614" 
    ? "test-addresses-arbitrum.json" 
    : "test-addresses.json";
  
  const testData = JSON.parse(fs.readFileSync(testDataFile));
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const [admin1] = await hre.ethers.getSigners();
  
  console.log("Admin 1:", admin1.address);
  console.log("Network:", chainId === "421614" ? "Arbitrum Sepolia" : "Ethereum Sepolia");
  
  // Check if already registered
  const contributor = await registry.contributors(admin1.address);
  
  if (contributor[5]) {
    console.log("✅ Already registered");
    console.log("  Submissions:", contributor[0].toString());
    console.log("  Reputation:", contributor[2].toString());
    console.log("  Tier:", hre.ethers.formatEther(contributor[4]), "ETH");
    return;
  }
  
  // Register as STANDARD tier (0.05 ETH)
  console.log("\nRegistering as STANDARD contributor (0.05 ETH)...");
  const tx = await registry.registerContributor(
    hre.ethers.parseEther("0.05"),
    { value: hre.ethers.parseEther("0.05") }
  );
  await tx.wait();
  
  console.log("✅ Admin 1 registered as contributor");
  console.log("   Can now submit IOC batches AND approve as admin");
}

main().catch(console.error);
