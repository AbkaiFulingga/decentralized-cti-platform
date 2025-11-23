// scripts/addAdmin3.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Adding Admin 3 to Governance ===\n");
  
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  const signers = await hre.ethers.getSigners();
  
  // Check if we have 3 signers
  if (signers.length < 3) {
    console.error("❌ ERROR: Need 3 admin accounts in hardhat.config.js");
    console.error(`Currently have: ${signers.length} signer(s)`);
    console.error("\nVerify your .env file has:");
    console.error("  PRIVATE_KEY_ADMIN1=...");
    console.error("  PRIVATE_KEY_ADMIN2=...");
    console.error("  PRIVATE_KEY_ADMIN3=...");
    process.exit(1);
  }
  
  const admin1 = signers[0];
  const admin2 = signers[1];
  const admin3 = signers[2];
  
  console.log("Admin 1:", admin1.address);
  console.log("Admin 2:", admin2.address);
  console.log("Admin 3:", admin3.address, "(NEW)\n");
  
  const governance = await hre.ethers.getContractAt(
    "ThresholdGovernance",
    testData.ThresholdGovernance
  );
  
  // Check if Admin 3 is already an admin
  const isAdmin = await governance.admins(admin3.address);
  
  if (isAdmin) {
    console.log("✅ Admin 3 is already authorized");
  } else {
    console.log("Adding Admin 3 to governance contract...");
    
    // Call addAdmin function (must be called by existing admin)
    const tx = await governance.connect(admin1).addAdmin(admin3.address);
    console.log("Transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("✅ Admin 3 added successfully!");
  }
  
  // Verify
  const isNowAdmin = await governance.admins(admin3.address);
  console.log("\nVerification:", isNowAdmin ? "✅ Admin 3 authorized" : "❌ Failed");
  
  // Get current admin count
  const adminCount = await governance.adminCount();
  console.log("Total admins in governance:", adminCount.toString());
  
  // Update test-addresses.json
  testData.admins = [admin1.address, admin2.address, admin3.address];
  fs.writeFileSync("test-addresses.json", JSON.stringify(testData, null, 2));
  console.log("✅ Updated test-addresses.json with Admin 3");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
