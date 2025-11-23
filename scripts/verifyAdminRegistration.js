// scripts/verifyAdminRegistration.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Verifying Admin Registration ===\n");
  
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  const testDataFile = chainId === "421614" 
    ? "test-addresses-arbitrum.json" 
    : "test-addresses.json";
  
  const testData = JSON.parse(fs.readFileSync(testDataFile));
  
  const governance = await hre.ethers.getContractAt(
    "ThresholdGovernance",
    testData.ThresholdGovernance
  );
  
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  console.log("Expected Admins (from deployment):");
  console.log("  Admin 1:", testData.admins[0]);
  console.log("  Admin 2:", testData.admins[1]);
  console.log("  Admin 3:", testData.admins[2]);
  
  console.log("\nChecking governance contract registration:\n");
  
  // Check Admin 1
  const admin1Status = await governance.admins(admin1.address);
  console.log(`Admin 1 (${admin1.address}):`);
  console.log(`  Registered in governance: ${admin1Status}`);
  console.log(`  ${admin1Status ? '✅ CAN' : '❌ CANNOT'} approve batches\n`);
  
  // Check Admin 2
  const admin2Status = await governance.admins(admin2.address);
  console.log(`Admin 2 (${admin2.address}):`);
  console.log(`  Registered in governance: ${admin2Status}`);
  console.log(`  ${admin2Status ? '✅ CAN' : '❌ CANNOT'} approve batches\n`);
  
  // Check Admin 3
  const admin3Status = await governance.admins(admin3.address);
  console.log(`Admin 3 (${admin3.address}):`);
  console.log(`  Registered in governance: ${admin3Status}`);
  console.log(`  ${admin3Status ? '✅ CAN' : '❌ CANNOT'} approve batches\n`);
  
  // Check threshold
  const threshold = await governance.threshold();
  const adminCount = await governance.adminCount();
  
  console.log("Governance Configuration:");
  console.log(`  Threshold: ${threshold} of ${adminCount} approvals required`);
  
  // Diagnosis
  console.log("\n=== DIAGNOSIS ===");
  if (!admin2Status || !admin3Status) {
    console.log("❌ CRITICAL BUG: Admin 2 or Admin 3 not registered in governance!");
    console.log("   This explains why ALL approvals are reverting.");
    console.log("\n🔧 FIX: Redeploy governance contract or manually add admins");
  } else {
    console.log("✅ All admins properly registered");
    console.log("   The revert must be caused by something else (timeout, already approved, etc.)");
  }
}

main().catch(console.error);
