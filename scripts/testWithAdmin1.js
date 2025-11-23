// Just Admin 1 approving all batches
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const testData = JSON.parse(fs.readFileSync("test-addresses-arbitrum.json"));
  const governance = await hre.ethers.getContractAt("ThresholdGovernance", testData.ThresholdGovernance);
  const [admin1] = await hre.ethers.getSigners();
  
  console.log("Admin 1 approving all 4 batches as second voter...");
  
  for (let i = 0; i < 4; i++) {
    try {
      await governance.connect(admin1).approveBatch(i);
      console.log(`✅ Batch #${i} approved`);
    } catch (error) {
      console.log(`❌ Batch #${i} failed: ${error.message}`);
    }
  }
}

main().catch(console.error);
