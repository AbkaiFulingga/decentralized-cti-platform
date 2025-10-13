
// scripts/verifyIOC.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Load address
  const { IOCRegistryMerkle } = JSON.parse(fs.readFileSync("deployedAddress.json"));

  const registry = await hre.ethers.getContractAt("IOCRegistryMerkle", IOCRegistryMerkle);

  const batchCount = await registry.getBatchCount();
  console.log("Total batches:", batchCount.toString());

  for (let i = 0; i < batchCount; i++) {
    const batch = await registry.getBatch(i);
    console.log(`Batch ${i}:`, batch);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
