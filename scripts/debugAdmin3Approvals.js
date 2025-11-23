// scripts/debugAdmin3Approvals.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const testDataFile = "test-addresses-arbitrum.json";
  const testData = JSON.parse(fs.readFileSync(testDataFile));
  
  const governance = await hre.ethers.getContractAt(
    "ThresholdGovernance",
    testData.ThresholdGovernance
  );
  
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  console.log("=== Checking Admin 3 Approval History ===\n");
  console.log("Admin 3:", admin3.address);
  
  // Check if Admin 3 has already voted on each batch
  for (let i = 0; i < 4; i++) {
    try {
      // Try to read hasApproved mapping directly
      const approval = await governance.batchApprovals(i);
      console.log(`Batch #${i}: Approval count = ${approval.approvalCount}`);
      
      // We can't directly read hasApproved mapping from public view
      // So we use staticCall to simulate the transaction
      const canApprove = await governance.connect(admin3).approveBatch.staticCall(i);
      console.log(`  Admin 3 can approve: YES`);
    } catch (error) {
      console.log(`  Admin 3 CANNOT approve: ${error.message.split('\n')[0]}`);
    }
  }
}

main().catch(console.error);
