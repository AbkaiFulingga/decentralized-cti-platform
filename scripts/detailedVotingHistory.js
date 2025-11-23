// scripts/detailedVotingHistory.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Detailed Voting History Analysis ===\n");
  
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
  
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  console.log("Network:", chainId === "421614" ? "Arbitrum Sepolia" : "Ethereum Sepolia");
  console.log("Admin 1:", admin1.address);
  console.log("Admin 2:", admin2.address);
  console.log("Admin 3:", admin3.address);
  
  const batchCount = await registry.getBatchCount();
  console.log("\nTotal batches:", batchCount.toString());
  console.log("\n" + "=".repeat(80));
  
  for (let i = 0; i < Number(batchCount); i++) {
    console.log(`\nBatch #${i}:`);
    
    const batch = await registry.getBatch(i);
    const submitterAddress = '0x' + batch[4].slice(26);
    const isPublic = batch[5];
    
    console.log("  Submitter:", isPublic ? submitterAddress : "Anonymous");
    console.log("  Accepted:", batch[3]);
    
    const approval = await governance.getBatchApprovalStatus(i);
    console.log("  Approval count:", approval[0].toString());
    console.log("  Executed:", approval[1]);
    console.log("  Created at:", new Date(Number(approval[2]) * 1000).toISOString());
    
    // Check each admin's vote status by trying staticCall
    console.log("\n  Individual Admin Voting Status:");
    
    for (const [name, admin] of [["Admin 1", admin1], ["Admin 2", admin2], ["Admin 3", admin3]]) {
      try {
        // Use staticCall to simulate without actually sending transaction
        await governance.connect(admin).approveBatch.staticCall(i);
        console.log(`    ${name}: ✅ CAN vote (has not voted yet)`);
      } catch (error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes("already approved")) {
          console.log(`    ${name}: 🔒 Already voted (cannot vote again)`);
        } else if (errorMsg.includes("already executed")) {
          console.log(`    ${name}: ✅ Batch already executed (no more votes needed)`);
        } else if (errorMsg.includes("approval timeout") || errorMsg.includes("timeout")) {
          console.log(`    ${name}: ⏰ Approval window expired (7 days passed)`);
        } else {
          console.log(`    ${name}: ❌ Cannot vote - ${error.message.split('\n')[0]}`);
        }
      }
    }
    
    console.log("\n" + "-".repeat(80));
  }
  
  console.log("\n=== SUMMARY ===");
  console.log("Threshold required: 2 votes");
  console.log("\nDiagnosis:");
  console.log("If all admins show 'Already voted' → System is deadlocked");
  console.log("If timeout expired → Batches cannot be approved anymore");
  console.log("If 'Already executed' → Batches were approved in previous runs");
}

main().catch(console.error);
