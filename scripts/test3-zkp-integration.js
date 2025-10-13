// scripts/test3-zkp-integration.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Step 3: Testing ZKP Integration ===");
  
  // Deploy privacy-preserving registry
  console.log("1. Deploying PrivacyPreservingRegistry...");
  const Registry = await hre.ethers.getContractFactory("PrivacyPreservingRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("✅ PrivacyPreservingRegistry deployed to:", registryAddr);

  const [deployer, contributor1, contributor2] = await hre.ethers.getSigners();
  const stakeAmount = hre.ethers.parseEther("0.05");

  // Test 1: Public contributor registration
  console.log("\n2. Testing public contributor registration...");
  await registry.connect(contributor1).registerContributor({ value: stakeAmount });
  console.log("✅ Public contributor registered");

  // Test 2: Anonymous contributor registration with ZKP commitment
  console.log("\n3. Testing anonymous contributor registration...");
  const randomNonce = 12345;
  const commitment = hre.ethers.keccak256(
    hre.ethers.solidityPacked(["address", "uint256"], [contributor2.address, randomNonce])
  );
  const zkpProof = hre.ethers.solidityPacked(["uint256"], [randomNonce]);
  
  await registry.connect(contributor2).registerAnonymousContributor(
    commitment, 
    zkpProof, 
    { value: stakeAmount }
  );
  console.log("✅ Anonymous contributor registered with commitment:", commitment);

  // Test 3: Public batch submission
  console.log("\n4. Testing public batch submission...");
  const publicTx = await registry.connect(contributor1).addBatch(
    "QmPublicCID123",
    "0x1111111111111111111111111111111111111111111111111111111111111111",
    true, // public
    hre.ethers.ZeroHash,
    "0x"
  );
  await publicTx.wait();
  console.log("✅ Public batch submitted");

  // Test 4: Anonymous batch submission
  console.log("\n5. Testing anonymous batch submission...");
  const anonProof = hre.ethers.solidityPacked(["uint256"], [randomNonce]);
  const anonTx = await registry.connect(contributor2).addBatch(
    "QmAnonCID456",
    "0x2222222222222222222222222222222222222222222222222222222222222222",
    false, // anonymous
    commitment,
    anonProof
  );
  await anonTx.wait();
  console.log("✅ Anonymous batch submitted");

  // Test 5: Verify privacy preservation
  console.log("\n6. Testing privacy preservation...");
  const publicBatch = await registry.getBatch(0);
  const anonBatch = await registry.getBatch(1);
  
  console.log("Public batch submitter hash:", publicBatch[4]);
  console.log("Anonymous batch commitment:", anonBatch[4]);
  console.log("Public batch is public:", publicBatch[5]);
  console.log("Anonymous batch is public:", anonBatch[5]);

  // Test 6: Platform statistics with privacy breakdown
  console.log("\n7. Privacy-preserving platform statistics...");
  const stats = await registry.getPlatformStats();
  console.log("Platform stats:", {
    totalBatches: stats[0].toString(),
    totalAccepted: stats[1].toString(),
    publicBatches: stats[2].toString(),
    anonymousBatches: stats[3].toString(),
    publicContributors: stats[4].toString(),
    anonymousContributors: stats[5].toString(),
    totalStaked: hre.ethers.formatEther(stats[6])
  });

  console.log("\n✅ ZKP Integration testing complete!");
  
  // Save for next tests
  const updatedTestData = {
    PrivacyPreservingRegistry: registryAddr,
    publicContributor: contributor1.address,
    anonContributor: contributor2.address,
    zkpCommitment: commitment
  };
  
  fs.writeFileSync("test-addresses.json", JSON.stringify(updatedTestData, null, 2));
}

main().catch(console.error);
