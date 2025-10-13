// scripts/test4-privacy-governance.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Step 4: Testing Privacy + Governance Integration ===");
  
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", testData.PrivacyPreservingRegistry);
  
  // Deploy threshold governance for privacy registry
  console.log("1. Deploying ThresholdGovernance for Privacy Registry...");
  const [deployer, admin1, admin2] = await hre.ethers.getSigners();
  const admins = [deployer.address, admin1.address, admin2.address];
  const threshold = 2;
  
  const Governance = await hre.ethers.getContractFactory("ThresholdGovernance");
  const governance = await Governance.deploy(admins, threshold, testData.PrivacyPreservingRegistry);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  
  // Set governance in privacy registry
  await registry.setGovernance(govAddr);
  console.log("✅ Privacy governance integration complete");

  // Test approving both public and anonymous batches
  console.log("\n2. Approving all privacy batches...");
  const stats = await registry.getPlatformStats();
  console.log(`Found ${stats[0]} batches (${stats[2]} public, ${stats[3]} anonymous)`);
  
  for (let i = 0; i < stats[0]; i++) {
    const batch = await registry.getBatch(i);
    const privacyType = batch[5] ? 'PUBLIC' : 'ANONYMOUS';
    console.log(`\nApproving batch ${i} - Type: ${privacyType}`);
    
    // Multi-admin approval (2 out of 3)
    await governance.connect(deployer).approveBatch(i);
    console.log(`  Admin 1 approved batch ${i}`);
    
    await governance.connect(admin1).approveBatch(i);
    console.log(`  Admin 2 approved batch ${i} - Auto-executed!`);
    
    // Verify batch accepted
    const updatedBatch = await registry.getBatch(i);
    console.log(`  ✅ Batch ${i} (${privacyType}) now accepted: ${updatedBatch[3]}`);
  }

  console.log("\n=== Final Platform Statistics ===");
  const finalStats = await registry.getPlatformStats();
  console.log("Platform stats:", {
    totalBatches: finalStats[0].toString(),
    totalAccepted: finalStats[1].toString(),
    publicBatches: finalStats[2].toString(),
    anonymousBatches: finalStats[3].toString(),
    publicContributors: finalStats[4].toString(),
    anonymousContributors: finalStats[5].toString()
  });

  // Save governance address for next tests
  const updatedTestData = {
    ...testData,
    PrivacyGovernance: govAddr
  };
  
  fs.writeFileSync("test-addresses.json", JSON.stringify(updatedTestData, null, 2));
  console.log("\n✅ Privacy + Governance integration complete!");
}

main().catch(console.error);
