// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const IOCRegistry = await hre.ethers.getContractFactory("IOCRegistry");
  const registry = await IOCRegistry.deploy();

  await registry.waitForDeployment();

  console.log(`IOCRegistry deployed to: ${await registry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

