// scripts/deploy-merkle-zk.js
const hre = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("🚀 Deploying Merkle ZKP system to Arbitrum Sepolia...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");
  
  if (parseFloat(ethers.formatEther(balance)) < 0.01) {
    throw new Error("Insufficient balance for deployment (need at least 0.01 ETH)");
  }
  
  // Get existing registry address
  const registryAddress = process.env.REGISTRY_ADDRESS_ARBITRUM;
  if (!registryAddress) {
    throw new Error("ARBITRUM_REGISTRY_ADDRESS not set in .env");
  }
  
  console.log("Using existing registry:", registryAddress);
  
  // Deploy MerkleZKRegistry
  console.log("\n📝 Deploying MerkleZKRegistry...");
  const MerkleZK = await ethers.getContractFactory("MerkleZKRegistry");
  const merkleZK = await MerkleZK.deploy(registryAddress);
  
  await merkleZK.waitForDeployment();
  const merkleZKAddress = await merkleZK.getAddress();
  
  console.log("✅ MerkleZKRegistry deployed to:", merkleZKAddress);
  
  // Verify deployment
  const rootCheck = await merkleZK.contributorMerkleRoot();
  console.log("Initial root (should be 0x0...):", rootCheck);
  
  const ownerCheck = await merkleZK.owner();
  console.log("Contract owner:", ownerCheck);
  
  // Save deployment info
  const deploymentInfo = {
    network: "arbitrumSepolia",
    merkleZKRegistry: merkleZKAddress,
    mainRegistry: registryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };
  
  fs.writeFileSync(
    'deployments/merkle-zk-arbitrum.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Add to cti-frontend/utils/constants.js:");
  console.log(`   merkleZK: "${merkleZKAddress}",`);
  console.log("\n2. Run initial tree generation:");
  console.log(`   REGISTRY_ADDRESS=${registryAddress} MERKLE_ZK_ADDRESS=${merkleZKAddress} node scripts/update-contributor-merkle.js`);
  console.log("\n3. Setup cron job for daily updates");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
