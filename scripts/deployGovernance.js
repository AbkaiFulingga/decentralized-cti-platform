// scripts/deployGovernance.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const signers = await hre.ethers.getSigners();

  // deploy registry
  const Registry = await hre.ethers.getContractFactory("IOCRegistryMerkle");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("IOCRegistryMerkle deployed to:", registryAddr);

  // pick members (first 3 signers) - adjust as you like
  const members = [signers[0].address, signers[1].address, signers[2].address];
  const votingPeriodSeconds = 60; // 1 minute for quick tests

  // deploy governance
  const Governance = await hre.ethers.getContractFactory("Governance");
  const governance = await Governance.deploy(members, votingPeriodSeconds, registryAddr);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("Governance deployed to:", govAddr);

  // set governance in registry (owner of registry is deployer = signer[0])
  await registry.setGovernance(govAddr);
  console.log("Registry governance set:", govAddr);

  // save deployed addresses
  fs.writeFileSync("deployedAddress.json", JSON.stringify({
    IOCRegistryMerkle: registryAddr,
    Governance: govAddr
  }, null, 2));

  console.log("Saved deployedAddress.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
