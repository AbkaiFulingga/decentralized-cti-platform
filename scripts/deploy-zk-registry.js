const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Deploying Updated PrivacyPreservingRegistry with ZK Support...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📝 Deploying from: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Load existing ZKVerifier address
  const zkVerifierPath = path.join(__dirname, "../deployments/zkverifier-arbitrum.json");
  if (!fs.existsSync(zkVerifierPath)) {
    throw new Error("❌ ZKVerifier not found! Deploy it first with: npx hardhat run scripts/deploy-zkverifier.js --network arbitrumSepolia");
  }
  
  const zkVerifierData = JSON.parse(fs.readFileSync(zkVerifierPath, "utf8"));
  const zkVerifierAddress = zkVerifierData.zkVerifier;
  console.log(`🔗 Using ZKVerifier at: ${zkVerifierAddress}\n`);

  // Deploy PrivacyPreservingRegistry
  console.log("📦 Deploying PrivacyPreservingRegistry...");
  const Registry = await hre.ethers.getContractFactory("PrivacyPreservingRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`✅ PrivacyPreservingRegistry deployed: ${registryAddress}`);

  // Deploy ThresholdGovernance with 3 admins, threshold 2
  console.log("\n📦 Deploying ThresholdGovernance...");
  const Governance = await hre.ethers.getContractFactory("ThresholdGovernance");
  
  // Use deployer as all 3 admins for now (can be changed later)
  const admins = [deployer.address, deployer.address, deployer.address];
  const threshold = 2; // 2-of-3 multi-sig
  
  const governance = await Governance.deploy(admins, threshold, registryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log(`✅ ThresholdGovernance deployed: ${governanceAddress}`);

  // Deploy StorageContribution with registry and governance addresses
  console.log("\n📦 Deploying StorageContribution...");
  const Storage = await hre.ethers.getContractFactory("StorageContribution");
  const storage = await Storage.deploy(registryAddress, governanceAddress);
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();
  console.log(`✅ StorageContribution deployed: ${storageAddress}`);

  // Link contracts
  console.log("\n🔗 Linking contracts...");
  
  console.log("Setting governance in registry...");
  let tx = await registry.setGovernance(governanceAddress);
  await tx.wait();
  console.log("✅ Governance linked");

  console.log("Setting ZKVerifier in registry...");
  tx = await registry.setZKVerifier(zkVerifierAddress);
  await tx.wait();
  console.log("✅ ZKVerifier linked");

  console.log("Setting storage in registry...");
  tx = await registry.setStorageContract(storageAddress);
  await tx.wait();
  console.log("✅ Storage linked");

  // Save addresses
  const addresses = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    registry: registryAddress,
    governance: governanceAddress,
    storage: storageAddress,
    zkVerifier: zkVerifierAddress,
    deployer: deployer.address
  };

  const outputPath = path.join(__dirname, "../test-addresses-arbitrum.json");
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log(`\n💾 Addresses saved to: ${outputPath}`);

  console.log("\n✅ DEPLOYMENT COMPLETE!\n");
  console.log("📋 Summary:");
  console.log(`   Registry: ${registryAddress}`);
  console.log(`   Governance: ${governanceAddress}`);
  console.log(`   Storage: ${storageAddress}`);
  console.log(`   ZKVerifier: ${zkVerifierAddress}`);
  console.log("\n🎯 Next Steps:");
  console.log("   1. Build contributor tree: npx hardhat run scripts/build-contributor-tree.js");
  console.log("   2. Test proof submission: npx hardhat run scripts/test-zk-proof-submission.js --network arbitrumSepolia");
  console.log("   3. Test replay attack: npx hardhat run scripts/test-replay-attack.js --network arbitrumSepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
