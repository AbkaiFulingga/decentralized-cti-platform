// scripts/deployComplete.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Complete System Deployment (All Features) ===\n");
  
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // Deploy PrivacyPreservingRegistry
  console.log("1. Deploying PrivacyPreservingRegistry...");
  const Registry = await hre.ethers.getContractFactory("PrivacyPreservingRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ Registry:", registryAddress);
  
  // Verify tier constants
  const microStake = await registry.MICRO_STAKE();
  const standardStake = await registry.STANDARD_STAKE();
  const premiumStake = await registry.PREMIUM_STAKE();
  console.log("\n📊 Staking Tiers:");
  console.log("  MICRO:", hre.ethers.formatEther(microStake), "ETH (+7 rep/batch)");
  console.log("  STANDARD:", hre.ethers.formatEther(standardStake), "ETH (+10 rep/batch)");
  console.log("  PREMIUM:", hre.ethers.formatEther(premiumStake), "ETH (+15 rep/batch)");
  
  // Setup admins
  let admins = [];
  if (signers.length >= 3) {
    admins = [signers[0].address, signers[1].address, signers[2].address];
  } else if (signers.length === 2) {
    admins = [signers[0].address, signers[1].address, signers[0].address];
  } else {
    admins = [deployer.address, deployer.address, deployer.address];
  }
  
  console.log("\n👥 Admin Addresses:");
  admins.forEach((addr, i) => console.log(`  Admin ${i+1}:`, addr));
  
  const threshold = 2;
  
  // Deploy ThresholdGovernance
  console.log("\n2. Deploying ThresholdGovernance...");
  const Governance = await hre.ethers.getContractFactory("ThresholdGovernance");
  const governance = await Governance.deploy(admins, threshold, registryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("✅ Governance:", governanceAddress);
  console.log("   Threshold: 2-of-3 approvals");
  console.log("   Features: Admin rewards + Tier-aware slashing");
  
  // Deploy StorageContribution
  console.log("\n3. Deploying StorageContribution...");
  const Storage = await hre.ethers.getContractFactory("StorageContribution");
  const storage = await Storage.deploy(registryAddress, governanceAddress);
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();
  console.log("✅ Storage:", storageAddress);
  
  // Link governance to registry
  await registry.setGovernance(governanceAddress);
  console.log("\n✅ All contracts linked");
  
  // Save deployment info
  const network = await hre.ethers.provider.getNetwork();
  const deploymentData = {
    network: network.name,
    chainId: network.chainId.toString(),
    PrivacyPreservingRegistry: registryAddress,
    ThresholdGovernance: governanceAddress,
    StorageContribution: storageAddress,
    admins: admins,
    threshold: threshold,
    features: {
      tieredStaking: true,
      adminRewards: true,
      communityFeedback: true,
      badActorDetection: true,
      storageContribution: true
    },
    stakingTiers: {
      micro: { amount: hre.ethers.formatEther(microStake), reputationBonus: 7 },
      standard: { amount: hre.ethers.formatEther(standardStake), reputationBonus: 10 },
      premium: { amount: hre.ethers.formatEther(premiumStake), reputationBonus: 15 }
    },
    deployedAt: new Date().toISOString()
  };
  
  const filename = network.chainId.toString() === "11155111" 
    ? "test-addresses.json" 
    : "test-addresses-arbitrum.json";
  
  fs.writeFileSync(filename, JSON.stringify(deploymentData, null, 2));
  console.log(`\n✅ Deployment saved to ${filename}`);
  
  console.log("\n=== Explorer Links ===");
  const explorerBase = network.chainId.toString() === "11155111" 
    ? "https://sepolia.etherscan.io" 
    : "https://sepolia.arbiscan.io";
  console.log("Registry:", `${explorerBase}/address/${registryAddress}`);
  console.log("Governance:", `${explorerBase}/address/${governanceAddress}`);
  console.log("Storage:", `${explorerBase}/address/${storageAddress}`);
  
  console.log("\n=== Feature Summary ===");
  console.log("✅ Tiered Staking (MICRO/STANDARD/PREMIUM)");
  console.log("✅ Admin Reward System (1% submission fees)");
  console.log("✅ Community Confirmation Buttons");
  console.log("✅ Bad Actor Detection & Slashing");
  console.log("✅ Storage Contribution Program");
  console.log("⏳ Multi-Network Support (Deploy to both L1 and L2)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
