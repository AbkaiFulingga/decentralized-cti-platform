// scripts/checkAdmin3.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Checking Admin 3 Status ===\n");
  
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
  
  console.log("Admin 3 Address:", admin3.address);
  console.log("Admin 3 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(admin3.address)), "ETH");
  
  // Check if Admin 3 is registered as admin
  const isAdmin = await governance.admins(admin3.address);
  console.log("Is Admin 3 registered as admin?", isAdmin);
  
  // Check approval status for all batches
  console.log("\nAdmin 3's approval status for each batch:");
  
  for (let i = 0; i < 4; i++) {
    const approval = await governance.batchApprovals(i);
    console.log(`  Batch #${i}: Approval count = ${approval.approvalCount}`);
    
    // Try to check if Admin 3 has approved (this might not work with public mapping)
    // We'll try to call approveBatch with estimateGas to see the revert reason
    try {
      await governance.connect(admin3).approveBatch.staticCall(i);
      console.log(`    Admin 3 CAN approve Batch #${i}`);
    } catch (error) {
      console.log(`    Admin 3 CANNOT approve Batch #${i}: ${error.message}`);
    }
  }
}

main().catch(console.error);
