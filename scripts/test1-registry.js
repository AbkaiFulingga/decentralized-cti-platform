// scripts/test1-registry.js
const hre = require("hardhat");

async function main() {
  console.log("=== Step 1: Testing Enhanced Registry ===");
  
  // Deploy contract
  console.log("1. Deploying EnhancedIOCRegistry...");
  const Registry = await hre.ethers.getContractFactory("EnhancedIOCRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("✅ Registry deployed to:", registryAddr);

  // Get test accounts
  const [deployer, contributor1, contributor2] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Contributor 1:", contributor1.address);
  console.log("Contributor 2:", contributor2.address);

  // Test 1: Register contributors
  console.log("\n2. Testing contributor registration...");
  const stakeAmount = hre.ethers.parseEther("0.05");
  
  try {
    await registry.connect(contributor1).registerContributor({ value: stakeAmount });
    console.log("✅ Contributor 1 registered");
    
    await registry.connect(contributor2).registerContributor({ value: stakeAmount });
    console.log("✅ Contributor 2 registered");
  } catch (error) {
    console.log("❌ Registration failed:", error.message);
    return;
  }

  // Test 2: Check contributor details
  console.log("\n3. Checking contributor details...");
  const contrib1 = await registry.getContributor(contributor1.address);
  console.log("Contributor 1 stats:", {
    submissions: contrib1[0].toString(),
    reputation: contrib1[2].toString(),
    staked: hre.ethers.formatEther(contrib1[3]),
    active: contrib1[4]
  });

  // Test 3: Try to add batch without being contributor (should fail)
  console.log("\n4. Testing access control...");
  try {
    await registry.connect(deployer).addBatch("test-cid", "0x1234567890abcdef");
    console.log("❌ Non-contributor was able to add batch (this should fail!)");
  } catch (error) {
    console.log("✅ Access control working: Non-contributor cannot add batch");
  }

  // Test 4: Add batch as registered contributor
  console.log("\n5. Testing batch submission...");
  try {
    const tx = await registry.connect(contributor1).addBatch(
      "QmTestCID123", 
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    );
    await tx.wait();
    console.log("✅ Batch added successfully");
    
    const batchCount = await registry.getBatchCount();
    console.log("Total batches:", batchCount.toString());
    
    // Check batch details
    const batch = await registry.getBatch(0);
    console.log("Batch 0 details:", {
      cid: batch[0],
      submitter: batch[4],
      accepted: batch[3]
    });
    
  } catch (error) {
    console.log("❌ Batch submission failed:", error.message);
    return;
  }

  // Test 5: Platform statistics
  console.log("\n6. Platform statistics...");
  const stats = await registry.getPlatformStats();
  console.log("Platform stats:", {
    totalBatches: stats[0].toString(),
    totalAccepted: stats[1].toString(),
    totalContributors: stats[2].toString(),
    totalStaked: hre.ethers.formatEther(stats[3])
  });

  console.log("\n✅ Enhanced Registry testing complete!");
  console.log("Registry Address:", registryAddr);
  
  // Save address for next test
  const fs = require("fs");
  fs.writeFileSync("test-addresses.json", JSON.stringify({
    EnhancedIOCRegistry: registryAddr,
    contributor1: contributor1.address,
    contributor2: contributor2.address
  }, null, 2));
}

main().catch(console.error);
