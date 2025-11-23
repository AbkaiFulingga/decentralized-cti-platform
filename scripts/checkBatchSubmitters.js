// scripts/checkBatchSubmitters.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  const testDataFile = chainId === "421614" 
    ? "test-addresses-arbitrum.json" 
    : "test-addresses.json";
  
  const testData = JSON.parse(fs.readFileSync(testDataFile));
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  console.log("=== Batch Submitter Analysis ===\n");
  console.log("Admin 1:", admin1.address);
  console.log("Admin 2:", admin2.address);
  console.log("Admin 3:", admin3.address);
  
  const batchCount = await registry.getBatchCount();
  
  for (let i = 0; i < Number(batchCount); i++) {
    const batch = await registry.getBatch(i);
    const contributorHash = batch[4];
    const isPublic = batch[5];
    
    console.log(`\nBatch #${i}:`);
    console.log("  Privacy:", isPublic ? "Public" : "Anonymous");
    
    if (isPublic) {
      const submitterAddress = '0x' + contributorHash.slice(26);
      console.log("  Submitter:", submitterAddress);
      
      if (submitterAddress.toLowerCase() === admin2.address.toLowerCase()) {
        console.log("  ⚠️ Submitted by Admin 2");
      } else if (submitterAddress.toLowerCase() === admin3.address.toLowerCase()) {
        console.log("  ⚠️ Submitted by Admin 3");
      } else if (submitterAddress.toLowerCase() === admin1.address.toLowerCase()) {
        console.log("  ⚠️ Submitted by Admin 1");
      }
    } else {
      console.log("  Submitter: Anonymous (commitment)");
    }
  }
}

main().catch(console.error);
