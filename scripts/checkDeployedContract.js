// scripts/checkDeployedContract.js
const hre = require("hardhat");

async function main() {
  const registryAddress = "0x5a24Df56a154f4c409F52e7d3CE74d004E6F9472";
  
  console.log("Checking deployed contract at:", registryAddress);
  
  // Try calling with OLD ABI (6 fields)
  const oldABI = [
    "function contributors(address) external view returns (uint256, uint256, uint256, uint256, bool, uint256)"
  ];
  
  const oldRegistry = await hre.ethers.getContractAt(oldABI, registryAddress);
  
  try {
    const contributor = await oldRegistry.contributors("0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82");
    console.log("✅ OLD ABI (6 fields) works - contract is OLD October 12 version");
    console.log("   Fields:", contributor);
  } catch (e) {
    console.log("❌ OLD ABI failed");
  }
  
  // Try calling with NEW ABI (7 fields)
  const newABI = [
    "function contributors(address) external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)"
  ];
  
  const newRegistry = await hre.ethers.getContractAt(newABI, registryAddress);
  
  try {
    const contributor = await newRegistry.contributors("0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82");
    console.log("✅ NEW ABI (7 fields) works - contract is NEW November 1 version");
    console.log("   Fields:", contributor);
  } catch (e) {
    console.log("❌ NEW ABI failed:", e.message);
  }
}

main().catch(console.error);
