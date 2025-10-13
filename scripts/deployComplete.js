// scripts/deployComplete.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Complete System Deployment ===");
  
  // Get all signers from hardhat.config.js
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  
  // Deploy PrivacyPreservingRegistry
  console.log("\n1. Deploying PrivacyPreservingRegistry...");
  const Registry = await hre.ethers.getContractFactory("PrivacyPreservingRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ PrivacyPreservingRegistry:", registryAddress);
  
  // Setup admins - use up to 3 different accounts if available
  let admins = [];
  if (signers.length >= 3) {
    admins = [signers[0].address, signers[1].address, signers[2].address];
    console.log("\n✅ Using 3 distinct admin addresses:");
    console.log("  Admin 1:", admins[0]);
    console.log("  Admin 2:", admins[1]);
    console.log("  Admin 3:", admins[2]);
  } else if (signers.length === 2) {
    admins = [signers[0].address, signers[1].address, signers[0].address];
    console.log("\n⚠️ Only 2 accounts available, using deployer twice:");
    console.log("  Admin 1:", admins[0]);
    console.log("  Admin 2:", admins[1]);
    console.log("  Admin 3:", admins[2], "(same as Admin 1)");
  } else {
    admins = [deployer.address, deployer.address, deployer.address];
    console.log("\n⚠️ Only 1 account available, using deployer for all admin slots");
  }
  
  const threshold = 2; // 2-of-3 approval required
  
  // Deploy ThresholdGovernance
  console.log("\n2. Deploying ThresholdGovernance...");
  const Governance = await hre.ethers.getContractFactory("ThresholdGovernance");
  const governance = await Governance.deploy(admins, threshold, registryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("✅ ThresholdGovernance:", governanceAddress);
  
  // Link governance to registry
  await registry.setGovernance(governanceAddress);
  console.log("✅ Governance linked to registry");
  
  // Save deployment info
  const deploymentData = {
    PrivacyPreservingRegistry: registryAddress,
    ThresholdGovernance: governanceAddress,
    admins: admins,
    threshold: threshold,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync("test-addresses.json", JSON.stringify(deploymentData, null, 2));
  console.log("\n✅ Deployment complete! Saved to test-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
