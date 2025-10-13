// scripts/governanceSepolia.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  const registryAddress = testData.PrivacyPreservingRegistry;
  const governanceAddress = testData.ThresholdGovernance;
  
  console.log("=== Governance Testing on Sepolia ===");
  console.log("Registry:", registryAddress);
  console.log("Governance:", governanceAddress);
  
  // Get both admin signers from hardhat.config.js accounts array
  const [admin1, admin2] = await hre.ethers.getSigners();
  console.log("Admin 1 account:", admin1.address);
  console.log("Admin 2 account:", admin2.address);
  
  // Connect to contracts
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    registryAddress
  );
  
  const governance = await hre.ethers.getContractAt(
    "ThresholdGovernance",
    governanceAddress
  );
  
  // Check pending batches
  const stats = await registry.getPlatformStats();
  console.log("\nPlatform Stats:");
  console.log("- Total Batches:", stats[0].toString());
  console.log("- Total Accepted:", stats[1].toString());
  console.log("- Public Batches:", stats[2].toString());
  console.log("- Anonymous Batches:", stats[3].toString());
  
  const totalBatches = Number(stats[0]);
  if (totalBatches === 0) {
    console.log("\n❌ No batches to approve. Please submit IOCs first through the UI.");
    return;
  }
  
  // Find first unaccepted batch
  let batchToApprove = null;
  for (let i = 0; i < totalBatches; i++) {
    const batch = await registry.batches(i);
    if (!batch.accepted) {
      batchToApprove = i;
      break;
    }
  }
  
  if (batchToApprove === null) {
    console.log("\n✅ All batches already approved!");
    return;
  }
  
  console.log(`\n📋 Approving batch ${batchToApprove}...`);
  
  // Check if Admin 2 has ETH for gas fees
  const admin2Balance = await hre.ethers.provider.getBalance(admin2.address);
  console.log("Admin 2 balance:", hre.ethers.formatEther(admin2Balance), "ETH");
  
  if (admin2Balance < hre.ethers.parseEther("0.001")) {
    console.log("⚠️ Admin 2 has insufficient balance. Sending 0.01 ETH for gas...");
    const sendTx = await admin1.sendTransaction({
      to: admin2.address,
      value: hre.ethers.parseEther("0.01")
    });
    await sendTx.wait();
    console.log("✅ Sent 0.01 ETH to Admin 2");
  }
  
  // Connect governance contract to each admin
  const governance1 = governance.connect(admin1);
  const governance2 = governance.connect(admin2);
  
  // Try Admin 1 approval
  try {
    console.log("\nAdmin 1 attempting approval...");
    const tx1 = await governance1.approveBatch(batchToApprove);
    await tx1.wait();
    console.log("✅ Admin 1 approved");
  } catch (error) {
    if (error.message.includes("Already approved")) {
      console.log("ℹ️ Admin 1 already approved this batch previously");
    } else {
      throw error;
    }
  }
  
  // Try Admin 2 approval (different signer - should reach threshold)
  try {
    console.log("Admin 2 attempting approval...");
    const tx2 = await governance2.approveBatch(batchToApprove);
    await tx2.wait();
    console.log("✅ Admin 2 approved (threshold reached)");
  } catch (error) {
    if (error.message.includes("Already approved")) {
      console.log("ℹ️ Admin 2 already approved this batch previously");
    } else {
      throw error;
    }
  }
  
  // Check if batch is now accepted
  const updatedBatch = await registry.batches(batchToApprove);
  console.log(`\n✅ Batch ${batchToApprove} acceptance status:`, updatedBatch.accepted);
  
  if (updatedBatch.accepted) {
    console.log("🎉 Batch successfully approved by threshold governance!");
  } else {
    console.log("⚠️ Batch not yet accepted - may need additional approvals");
  }
  
  // Display updated platform stats
  const newStats = await registry.getPlatformStats();
  console.log("\nUpdated Platform Stats:");
  console.log("- Total Batches:", newStats[0].toString());
  console.log("- Total Accepted:", newStats[1].toString());
  
  // View on Etherscan
  console.log(`\n🔗 View on Etherscan:`);
  console.log(`Registry: https://sepolia.etherscan.io/address/${registryAddress}`);
  console.log(`Governance: https://sepolia.etherscan.io/address/${governanceAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
