const hre = require("hardhat");

async function main() {
  const registryAddress = "0x5a24Df56a154f4c409F52e7d3CE74d004E6F9472";
  
  console.log("Testing contract at:", registryAddress);
  
  // Test 1: Try calling STANDARD_STAKE (should exist if November 1 contract)
  try {
    const abi1 = ["function STANDARD_STAKE() external view returns (uint256)"];
    const contract1 = await hre.ethers.getContractAt(abi1, registryAddress);
    const stake = await contract1.STANDARD_STAKE();
    console.log("✅ STANDARD_STAKE() exists:", hre.ethers.formatEther(stake), "ETH");
  } catch (e) {
    console.log("❌ STANDARD_STAKE() NOT FOUND - Contract is OLD version");
  }
  
  // Test 2: Try the tier-based registerContributor
  try {
    const abi2 = ["function registerContributor(uint256 tier) external payable"];
    const contract2 = await hre.ethers.getContractAt(abi2, registryAddress);
    console.log("✅ registerContributor(uint256) signature exists");
  } catch (e) {
    console.log("❌ registerContributor(uint256) NOT FOUND");
  }
  
  // Test 3: Check what the contract bytecode actually says
  const code = await hre.ethers.provider.getCode(registryAddress);
  console.log("\nContract bytecode length:", code.length, "bytes");
  console.log("Contract deployed:", code !== "0x");
}

main().catch(console.error);
