// scripts/verifyDeployment.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  console.log("Checking deployment at:", testData.PrivacyPreservingRegistry);
  
  const provider = hre.ethers.provider;
  
  // Check if contract exists
  const code = await provider.getCode(testData.PrivacyPreservingRegistry);
  console.log("Contract code length:", code.length);
  
  if (code === "0x") {
    console.log("❌ No contract deployed at this address!");
    console.log("Need to redeploy contracts");
    return;
  }
  
  console.log("✅ Contract exists");
  
  // Try to call getPlatformStats
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  try {
    const stats = await registry.getPlatformStats();
    console.log("Platform stats:", {
      totalBatches: stats[0].toString(),
      totalAccepted: stats[1].toString(),
      publicBatches: stats[2].toString(),
      anonymousBatches: stats[3].toString(),
      publicContributors: stats[4].toString(),
      anonymousContributors: stats[5].toString(),
      totalStaked: hre.ethers.formatEther(stats[6])
    });
  } catch (error) {
    console.log("❌ Error calling getPlatformStats:", error.message);
  }
}

main().catch(console.error);
