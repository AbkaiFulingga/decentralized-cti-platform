// scripts/deployMerkle.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const IOCRegistryMerkle = await hre.ethers.getContractFactory("IOCRegistryMerkle");
  const registry = await IOCRegistryMerkle.deploy();

  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log(`IOCRegistryMerkle deployed to: ${address}`);

  // Save to file
  fs.writeFileSync(
    "deployedAddress.json",
    JSON.stringify({ IOCRegistryMerkle: address }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
