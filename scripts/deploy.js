// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("🚀 Starting clean deployment to Arbitrum Sepolia");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  // STEP 1: Deploy PrivacyPreservingRegistry
  // Constructor: () - no params
  console.log("📜 [1/5] Deploying PrivacyPreservingRegistry...");
  const PrivacyPreservingRegistry = await hre.ethers.getContractFactory("PrivacyPreservingRegistry");
  const registry = await PrivacyPreservingRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ Registry deployed to:", registryAddress);
  console.log("");

  // STEP 2: Deploy ThresholdGovernance
  // Constructor: (admins[], threshold, registry)
  console.log("📜 [2/5] Deploying ThresholdGovernance...");
  
  const admins = [
    "0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82",
    "0xf78afa5E41eDF35c05c1aEB082C1789283b09d3B",
    "0x0D5CaD75D37adA5A81EbEe04387229a40B0a457f"
  ];
  const threshold = 3;
  
  const ThresholdGovernance = await hre.ethers.getContractFactory("ThresholdGovernance");
  const governance = await ThresholdGovernance.deploy(
    admins,
    threshold,
    registryAddress
  );
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("✅ Governance deployed to:", governanceAddress);
  console.log("");

  // STEP 3: Deploy StorageContribution
  // Constructor: (registry, governance)
  console.log("📜 [3/5] Deploying StorageContribution...");
  const StorageContribution = await hre.ethers.getContractFactory("StorageContribution");
  const storage = await StorageContribution.deploy(
    registryAddress,
    governanceAddress
  );
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();
  console.log("✅ Storage deployed to:", storageAddress);
  console.log("");

  // STEP 4: Deploy MerkleZKRegistry
  // Constructor: (registry)
  console.log("📜 [4/5] Deploying MerkleZKRegistry...");
  const MerkleZKRegistry = await hre.ethers.getContractFactory("MerkleZKRegistry");
  const merkleZK = await MerkleZKRegistry.deploy(registryAddress);
  await merkleZK.waitForDeployment();
  const merkleZKAddress = await merkleZK.getAddress();
  console.log("✅ MerkleZK deployed to:", merkleZKAddress);
  console.log("");

  // STEP 5: Deploy OracleIOCFeed
  // Constructor: (registry)
  console.log("📜 [5/5] Deploying OracleIOCFeed...");
  const OracleIOCFeed = await hre.ethers.getContractFactory("OracleIOCFeed");
  const oracleFeed = await OracleIOCFeed.deploy(registryAddress);
  await oracleFeed.waitForDeployment();
  const oracleFeedAddress = await oracleFeed.getAddress();
  console.log("✅ OracleFeed deployed to:", oracleFeedAddress);
  console.log("");

  console.log("════════════════════════════════════════════════════════");
  console.log("✅ ALL CONTRACTS DEPLOYED SUCCESSFULLY");
  console.log("════════════════════════════════════════════════════════");
  console.log("");
  console.log("📋 CONTRACT ADDRESSES:");
  console.log("──────────────────────────────────────────────────────");
  console.log("Registry:    ", registryAddress);
  console.log("Governance:  ", governanceAddress);
  console.log("Storage:     ", storageAddress);
  console.log("MerkleZK:    ", merkleZKAddress);
  console.log("OracleFeed:  ", oracleFeedAddress);
  console.log("──────────────────────────────────────────────────────");
  console.log("");
  console.log("🔗 ARBISCAN VERIFICATION LINKS:");
  console.log("Registry:    https://sepolia.arbiscan.io/address/" + registryAddress);
  console.log("Governance:  https://sepolia.arbiscan.io/address/" + governanceAddress);
  console.log("Storage:     https://sepolia.arbiscan.io/address/" + storageAddress);
  console.log("MerkleZK:    https://sepolia.arbiscan.io/address/" + merkleZKAddress);
  console.log("OracleFeed:  https://sepolia.arbiscan.io/address/" + oracleFeedAddress);
  console.log("");
  console.log("📝 UPDATE .env FILE:");
  console.log("──────────────────────────────────────────────────────");
  console.log(`REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`GOVERNANCE_ADDRESS=${governanceAddress}`);
  console.log(`STORAGE_ADDRESS=${storageAddress}`);
  console.log(`MERKLE_ZK_ADDRESS=${merkleZKAddress}`);
  console.log(`ORACLE_FEED_ADDRESS=${oracleFeedAddress}`);
  console.log("");
  console.log("📝 UPDATE cti-frontend/utils/constants.js:");
  console.log("──────────────────────────────────────────────────────");
  console.log("arbitrumSepolia: {");
  console.log("  contracts: {");
  console.log(`    registry: "${registryAddress}",`);
  console.log(`    governance: "${governanceAddress}",`);
  console.log(`    storage: "${storageAddress}",`);
  console.log(`    merkleZK: "${merkleZKAddress}",`);
  console.log(`    oracleFeed: "${oracleFeedAddress}"`);
  console.log("  }");
  console.log("}");
  console.log("");
  console.log("⚠️  IMPORTANT: After updating constants.js, restart frontend:");
  console.log("   cd cti-frontend && rm -rf .next && npm run dev");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
