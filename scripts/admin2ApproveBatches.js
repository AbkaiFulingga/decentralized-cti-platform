// scripts/admin2ApproveBatches.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Admin 2 Approving Batches Submitted by Admin 3 ===\n");
  
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
  
  // Get Admin 2 signer (index 1)
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  console.log("Admin 2:", admin2.address);
  console.log("Network:", chainId === "421614" ? "Arbitrum Sepolia" : "Ethereum Sepolia");
  
  const batchCount = await registry.getBatchCount();
  console.log("Total batches:", batchCount.toString());
  
  // Identify which batches Admin 3 submitted
  const admin3Batches = [];
  
  for (let i = 0; i < Number(batchCount); i++) {
    const batch = await registry.getBatch(i);
    const contributorHash = batch[4];
    const isPublic = batch[5];
    
    if (isPublic) {
      const submitterAddress = '0x' + contributorHash.slice(26);
      if (submitterAddress.toLowerCase() === admin3.address.toLowerCase()) {
        admin3Batches.push(i);
        console.log(`Batch #${i}: Submitted by Admin 3 ✓`);
      }
    }
  }
  
  console.log(`\nFound ${admin3Batches.length} batches submitted by Admin 3`);
  console.log("Admin 2 will approve these batches (no conflict of interest)\n");
  
  // Approve each batch submitted by Admin 3
  for (const batchIndex of admin3Batches) {
    const approval = await governance.getBatchApprovalStatus(batchIndex);
    const currentApprovals = Number(approval[0]);
    const executed = approval[1];
    
    console.log(`Batch #${batchIndex}:`);
    console.log("  Current approvals:", currentApprovals);
    console.log("  Executed:", executed);
    
    if (executed) {
      console.log("  ✅ Already executed, skipping\n");
      continue;
    }
    
    try {
      console.log("  🔐 Admin 2 approving...");
      const tx = await governance.connect(admin2).approveBatch(batchIndex);
      await tx.wait();
      
      const newApproval = await governance.getBatchApprovalStatus(batchIndex);
      const newCount = Number(newApproval[0]);
      const newExecuted = newApproval[1];
      
      if (newExecuted) {
        console.log(`  ✅ Batch #${batchIndex} APPROVED & EXECUTED (threshold reached: ${newCount} votes)\n`);
        
        // Check reputation update
        const contributor = await registry.contributors(admin3.address);
        console.log(`  📊 Admin 3 reputation updated: ${contributor[2].toString()}\n`);
      } else {
        console.log(`  ✅ Batch #${batchIndex} approved by Admin 2 (${newCount} of 2 votes)\n`);
      }
      
    } catch (error) {
      if (error.message.includes("Already approved")) {
        console.log("  ℹ️ Admin 2 already approved this batch\n");
      } else {
        console.log("  ❌ Error:", error.message, "\n");
      }
    }
  }
  
  console.log("=== Approval Complete ===\n");
  
  // Show final statistics
  const stats = await registry.getPlatformStats();
  console.log("Final Platform Stats:");
  console.log("  Total Batches:", stats[0].toString());
  console.log("  Accepted Batches:", stats[1].toString());
  
  // Show both contributors' final reputations
  const admin2Rep = await registry.contributors(admin2.address);
  const admin3Rep = await registry.contributors(admin3.address);
  
  console.log("\nContributor Reputations:");
  console.log("  Admin 2 (MICRO tier):", admin2Rep[2].toString());
  console.log("  Admin 3 (PREMIUM tier):", admin3Rep[2].toString());
}

main().catch(console.error);
