// scripts/debugApprovals.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  const testDataFile = chainId === "421614" 
    ? "test-addresses-arbitrum.json" 
    : "test-addresses.json";
  
  const testData = JSON.parse(fs.readFileSync(testDataFile));
  
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const governance = await hre.ethers.getContractAt(
    "ThresholdGovernance",
    testData.ThresholdGovernance
  );
  
  const batchCount = await registry.getBatchCount();
  
  console.log("=== Batch Approval Status ===\n");
  console.log("Total batches:", batchCount.toString());
  
  for (let i = 0; i < Number(batchCount); i++) {
    const batch = await registry.getBatch(i);
    const approval = await governance.getBatchApprovalStatus(i);
    
    console.log(`\nBatch #${i}:`);
    console.log("  CID:", batch[0].substring(0, 20) + "...");
    console.log("  Accepted:", batch[3]);
    console.log("  Approval Count:", approval[0].toString());
    console.log("  Executed:", approval[1]);
    console.log("  Created At:", new Date(Number(approval[2]) * 1000).toISOString());
  }
}

main().catch(console.error);
