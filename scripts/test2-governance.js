// scripts/test2-governance.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Step 2: Testing Threshold Governance ===");
  
  // Load previous test addresses
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  const registryAddr = testData.EnhancedIOCRegistry;
  
  // Deploy threshold governance
  console.log("1. Deploying ThresholdGovernance...");
  const [deployer, admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  const admins = [deployer.address, admin1.address, admin2.address];
  const threshold = 2; // 2 out of 3 approval needed
  
  const Governance = await hre.ethers.getContractFactory("ThresholdGovernance");
  const governance = await Governance.deploy(admins, threshold, registryAddr);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("✅ ThresholdGovernance deployed to:", govAddr);

  // Set governance in registry
  const registry = await hre.ethers.getContractAt("EnhancedIOCRegistry", registryAddr);
  await registry.setGovernance(govAddr);
  console.log("✅ Registry governance set");

  // Test 1: Check batch exists
  console.log("\n2. Checking existing batches...");
  const batchCount = await registry.getBatchCount();
  console.log("Available batches:", batchCount.toString());
  
  if (batchCount == 0) {
    console.log("❌ No batches found. Please run test1-registry.js first.");
    return;
  }

  const batchIndex = 0;
  const batch = await registry.getBatch(batchIndex);
  console.log(`Batch ${batchIndex} - Accepted: ${batch[3]}, Submitter: ${batch[4]}`);

  // Test 2: First admin approval
  console.log("\n3. Testing approval process...");
  const tx1 = await governance.connect(deployer).approveBatch(batchIndex);
  await tx1.wait();
  console.log("✅ Admin 1 approved batch", batchIndex);
  
  // Check status (should not be executed yet)
  let status = await governance.getBatchApprovalStatus(batchIndex);
  console.log(`Approvals: ${status[0]}/${threshold}, Executed: ${status[1]}`);

  // Test 3: Second admin approval (should trigger execution)
  const tx2 = await governance.connect(admin1).approveBatch(batchIndex);
  await tx2.wait();
  console.log("✅ Admin 2 approved batch", batchIndex);
  
  // Check final status
  status = await governance.getBatchApprovalStatus(batchIndex);
  console.log(`Final approvals: ${status[0]}/${threshold}, Executed: ${status[1]}`);

  // Test 4: Verify batch was accepted in registry
  console.log("\n4. Verifying batch acceptance...");
  const updatedBatch = await registry.getBatch(batchIndex);
  console.log(`Batch ${batchIndex} now accepted: ${updatedBatch[3]}`);

  // Test 5: Try double approval (should fail)
  console.log("\n5. Testing double approval protection...");
  try {
    await governance.connect(deployer).approveBatch(batchIndex);
    console.log("❌ Double approval succeeded (this should fail!)");
  } catch (error) {
    console.log("✅ Double approval correctly blocked");
  }

  // Test 6: Platform statistics after governance action
  console.log("\n6. Updated platform statistics...");
  const stats = await registry.getPlatformStats();
  console.log("Platform stats:", {
    totalBatches: stats[0].toString(),
    totalAccepted: stats[1].toString(),
    totalContributors: stats[2].toString(),
    totalStaked: hre.ethers.formatEther(stats[3])
  });

  console.log("\n✅ Threshold Governance testing complete!");
  
  // Update addresses file
  const updatedTestData = {
    ...testData,
    ThresholdGovernance: govAddr,
    admins: admins,
    threshold: threshold
  };
  
  fs.writeFileSync("test-addresses.json", JSON.stringify(updatedTestData, null, 2));
  console.log("Updated test-addresses.json with governance details");
}

main().catch(console.error);
