const hre = require("hardhat");

async function main() {
  console.log("=== ETHEREUM SEPOLIA ===");
  const sepoliaRegistry = "0xea816C1B93F5d76e03055BFcFE2ba5645341e09E";
  
  const sepoliaABI = [
    "function STANDARD_STAKE() external view returns (uint256)",
    "function contributors(address) external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)",
    "function registerContributor(uint256 tier) external payable"
  ];
  
  try {
    const sepContract = await hre.ethers.getContractAt(sepoliaABI, sepoliaRegistry);
    const stake = await sepContract.STANDARD_STAKE();
    console.log("✅ STANDARD_STAKE():", hre.ethers.formatEther(stake), "ETH");
    
    const contrib = await sepContract.contributors("0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82");
    console.log("✅ contributors() works, returns", contrib.length, "fields");
    console.log("   Data:", contrib);
  } catch (e) {
    console.log("❌ Sepolia contract call failed:", e.message);
  }
  
  console.log("\n=== ARBITRUM SEPOLIA ===");
  const arbRegistry = "0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E";
  
  try {
    const arbContract = await hre.ethers.getContractAt(sepoliaABI, arbRegistry);
    const stake = await arbContract.STANDARD_STAKE();
    console.log("✅ STANDARD_STAKE():", hre.ethers.formatEther(stake), "ETH");
    
    const contrib = await arbContract.contributors("0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82");
    console.log("✅ contributors() works, returns", contrib.length, "fields");
    console.log("   Data:", contrib);
  } catch (e) {
    console.log("❌ Arbitrum contract call failed:", e.message);
  }
}

main().catch(console.error);
