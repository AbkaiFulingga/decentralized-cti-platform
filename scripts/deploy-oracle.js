// scripts/deploy-oracle.js
const hre = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("🚀 Deploying OracleIOCFeed to Arbitrum Sepolia...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (parseFloat(hre.ethers.formatEther(balance)) < 0.01) {
    console.log("❌ Insufficient balance for deployment!");
    process.exit(1);
  }
  
  // Use environment variable for registry
  const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS_ARBITRUM || "0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E";
  console.log("Registry address:", REGISTRY_ADDRESS);
  
  // Verify registry exists
  const registryCode = await hre.ethers.provider.getCode(REGISTRY_ADDRESS);
  if (registryCode === '0x') {
    console.log("❌ Registry contract not found at", REGISTRY_ADDRESS);
    process.exit(1);
  }
  console.log("✅ Registry verified");
  
  // Deploy OracleIOCFeed
  console.log("\n📝 Deploying OracleIOCFeed...");
  const OracleFeed = await hre.ethers.getContractFactory("OracleIOCFeed");
  
  const oracleFeed = await OracleFeed.deploy(REGISTRY_ADDRESS);
  
  console.log("⏳ Waiting for deployment transaction...");
  await oracleFeed.waitForDeployment();
  
  const oracleFeedAddress = await oracleFeed.getAddress();
  console.log("✅ OracleIOCFeed deployed to:", oracleFeedAddress);
  
  // Wait for a few blocks
  console.log("⏳ Waiting for 2 block confirmations...");
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Register feeds
  console.log("\n📝 Registering feeds...");
  
  const feedNames = ['AbuseIPDB', 'URLhaus', 'MalwareBazaar', 'PhishTank'];
  
  for (const feedName of feedNames) {
    try {
      console.log(`Registering ${feedName}...`);
      const tx = await oracleFeed.registerFeed(feedName);
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Registered feed: ${feedName}`);
    } catch (error) {
      console.error(`❌ Failed to register ${feedName}:`, error.message);
    }
  }
  
  console.log("\n🎉 Deployment complete!");
  console.log("\n" + "=".repeat(60));
  console.log("CONTRACT ADDRESSES:");
  console.log("=".repeat(60));
  console.log(`OracleIOCFeed: ${oracleFeedAddress}`);
  console.log(`Registry: ${REGISTRY_ADDRESS}`);
  console.log("=".repeat(60));
  
  console.log("\n📋 NEXT STEPS:");
  console.log("1. Update .env:");
  console.log(`   ORACLE_FEED_ADDRESS=${oracleFeedAddress}`);
  console.log("\n2. Update cti-frontend/utils/constants.js:");
  console.log(`   oracleFeed: "${oracleFeedAddress}"`);
  console.log("\n3. Generate oracle wallet:");
  console.log("   node -e \"const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Address:', w.address, '\\\\nKey:', w.privateKey);\"");
  console.log("\n4. Update .env with oracle private key");
  console.log("\n5. Fund oracle wallet with 0.1 ETH");
  console.log("\n6. Transfer oracle ownership:");
  console.log("   (Instructions will be provided after you generate wallet)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    process.exit(1);
  });
