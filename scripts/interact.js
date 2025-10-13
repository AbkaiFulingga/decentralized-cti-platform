// scripts/interact.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // The deployed contract address (from your last deploy)
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  // Load the contract
  const IOCRegistry = await hre.ethers.getContractFactory("IOCRegistry");
  const registry = IOCRegistry.attach(contractAddress);

  console.log("Using account:", deployer.address);

  // Add an IOC
  const tx = await registry.addIOC("8.8.8.8", "IP");
  await tx.wait();
  console.log("Added IOC: 8.8.8.8 (IP)");

  // Fetch back the IOC
  const ioc = await registry.getIOC(0);
  console.log("Retrieved IOC:", ioc);

  // Check total count
  const total = await registry.totalIOCs();
  console.log("Total IOCs stored:", total.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
