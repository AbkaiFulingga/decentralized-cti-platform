// scripts/readBatches.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const { IOCRegistryMerkle } = JSON.parse(fs.readFileSync("deployedAddress.json", "utf8"));
  const registry = await hre.ethers.getContractAt("IOCRegistryMerkle", IOCRegistryMerkle);

  const count = await registry.getBatchCount();
  console.log("Total batches:", count.toString());

  for (let i = 0; i < count; i++) {
    const [cid, root, timestamp, accepted] = await registry.getBatch(i);
    console.log(`Batch ${i}: CID=${cid}, Root=${root}, Accepted=${accepted}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
