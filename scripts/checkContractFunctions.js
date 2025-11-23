const hre = require("hardhat");

async function main() {
  console.log("=== Checking Sepolia Registry ===");
  const sepoliaRegistry = "0xea816C1B93F5d76e03055BFcFE2ba5645341e09E";
  
  const Registry = await hre.ethers.getContractFactory("IOCRegistry");
  const registry = Registry.attach(sepoliaRegistry);
  
  try {
    const count = await registry.batchCount();
    console.log("✅ batchCount() exists:", count.toString());
  } catch (e) {
    console.log("❌ batchCount() doesn't exist");
    console.log("Error:", e.message);
  }
  
  console.log("\n=== Checking Arbitrum Registry ===");
  const arbRegistry = "0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E";
  const registry2 = Registry.attach(arbRegistry);
  
  try {
    const count = await registry2.batchCount();
    console.log("✅ batchCount() exists:", count.toString());
  } catch (e) {
    console.log("❌ batchCount() doesn't exist");
    console.log("Error:", e.message);
  }
  
  // Try alternative function names
  console.log("\n=== Trying alternative function names ===");
  try {
    const nextId = await registry.nextBatchId();
    console.log("✅ nextBatchId() exists:", nextId.toString());
  } catch (e) {
    console.log("❌ nextBatchId() doesn't exist");
  }
  
  try {
    const totalBatches = await registry.totalBatches();
    console.log("✅ totalBatches() exists:", totalBatches.toString());
  } catch (e) {
    console.log("❌ totalBatches() doesn't exist");
  }
}

main().catch(console.error);
