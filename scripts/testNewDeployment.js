// scripts/testNewDeployment.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Testing New Deployment (Oct 26) ===\n");
  
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  console.log("Registry Address:", testData.PrivacyPreservingRegistry);
  console.log("Governance Address:", testData.ThresholdGovernance);
  console.log("Admins:", testData.admins);
  console.log("Threshold:", testData.threshold);
  console.log("Deployed At:", testData.deployedAt, "\n");
  
  const [admin1, admin2] = await hre.ethers.getSigners();
  console.log("Testing with Admin 1:", admin1.address);
  console.log("Testing with Admin 2:", admin2.address, "\n");
  
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const governance = await hre.ethers.getContractAt(
    "ThresholdGovernance",
    testData.ThresholdGovernance
  );
  
  console.log("TEST 1: Verify Governance Link");
  const linkedGovernance = await registry.governance();
  console.log("Registry.governance():", linkedGovernance);
  console.log(linkedGovernance === testData.ThresholdGovernance ? "✅ PASS\n" : "❌ FAIL\n");
  
  console.log("TEST 2: Verify Admin Permissions");
  const isAdmin1 = await governance.admins(admin1.address);
  const isAdmin2 = await governance.admins(admin2.address);
  console.log("Admin 1 authorized:", isAdmin1 ? "✅" : "❌");
  console.log("Admin 2 authorized:", isAdmin2 ? "✅" : "❌");
  console.log(isAdmin1 && isAdmin2 ? "✅ PASS\n" : "❌ FAIL\n");
  
  console.log("TEST 3: Verify Threshold");
  const currentThreshold = await governance.threshold();
  console.log("Current threshold:", currentThreshold.toString());
  console.log(currentThreshold.toString() === "2" ? "✅ PASS\n" : "❌ FAIL\n");
  
  console.log("TEST 4: Platform Statistics");
  const stats = await registry.getPlatformStats();
  console.log("Total Batches:", stats[0].toString());
  console.log("Total Accepted:", stats[1].toString());
  console.log("Public Batches:", stats[2].toString());
  console.log("Anonymous Batches:", stats[3].toString());
  console.log("Public Contributors:", stats[4].toString());
  console.log("Anonymous Contributors:", stats[5].toString());
  console.log("Total Staked:", hre.ethers.formatEther(stats[6]), "ETH");
  console.log("✅ PASS\n");
  
  console.log("TEST 5: Batch Count");
  const batchCount = await registry.getBatchCount();
  console.log("Total batches stored:", batchCount.toString());
  console.log("✅ PASS\n");
  
  console.log("TEST 6: Admin Balance Check");
  const balance1 = await hre.ethers.provider.getBalance(admin1.address);
  const balance2 = await hre.ethers.provider.getBalance(admin2.address);
  console.log("Admin 1 balance:", hre.ethers.formatEther(balance1), "ETH");
  console.log("Admin 2 balance:", hre.ethers.formatEther(balance2), "ETH");
  
  const minRequired = hre.ethers.parseEther("0.01");
  if (balance1 >= minRequired && balance2 >= minRequired) {
    console.log("✅ PASS - Both admins have sufficient balance\n");
  } else {
    console.log("⚠️ WARNING - Low balance detected\n");
  }
  
  console.log("TEST 7: Contract Ownership");
  const owner = await registry.owner();
  console.log("Registry owner:", owner);
  console.log(owner === admin1.address ? "✅ PASS\n" : "❌ FAIL\n");
  
  console.log("=== All Tests Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
