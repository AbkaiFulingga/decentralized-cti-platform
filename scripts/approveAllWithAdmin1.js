// scripts/approveAllWithAdmin1.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Admin 1 Approving All Pending Batches ===\n");
  
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
  
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const [admin1] = await hre.ethers.getSigners();
  
  console.log("Admin 1:", admin1.address);
  console.log("Network:", chainId === "421614" ? "Arbitrum Sepolia" : "Ethereum Sepolia");
  
  // Get all batches
  const batchCount = await registry.getBatchCount();
  console.log("Total batches:", batchCount.toString());
  
  // Approve each pending batch
  for (let i = 0; i < Number(batchCount); i++) {
    const batch = await registry.getBatch(i);
    const isAccepted = batch[3];
    
    if (!isAccepted) {
      const approval = await governance.getBatchApprovalStatus(i);
      const currentApprovals = Number(approval[0]);
      const executed = approval[1];
      
      console.log(`\nBatch #${i}:`);
      console.log("  Current approvals:", currentApprovals);
      console.log("  Executed:", executed);
      
      if (executed) {
        console.log("  ✅ Already executed, skipping");
        continue;
      }
      
      try {
        console.log("  🔐 Admin 1 approving...");
        const tx = await governance.connect(admin1).approveBatch(i);
        await tx.wait();
        
        const newApproval = await governance.getBatchApprovalStatus(i);
        const newCount = Number(newApproval[0]);
        const newExecuted = newApproval[1];
        
        if (newExecuted) {
          console.log(`  ✅ Batch #${i} APPROVED & EXECUTED (threshold reached: ${newCount} votes)`);
        } else {
          console.log(`  ✅ Batch #${i} approved by Admin 1 (${newCount} of 2 votes)`);
        }
        
      } catch (error) {
        if (error.message.includes("Already approved")) {
          console.log("  ℹ️ Admin 1 already approved this batch");
        } else {
          console.log("  ❌ Error:", error.message);
        }
      }
    } else {
      console.log(`\nBatch #${i}: ✅ Already accepted, skipping`);
    }
  }
  
  console.log("\n=== Approval Complete ===");
  
  // Show final statistics
  const stats = await registry.getPlatformStats();
  console.log("\nFinal Platform Stats:");
  console.log("  Total Batches:", stats[0].toString());
  console.log("  Accepted Batches:", stats[1].toString());
}

main().catch(console.error);
