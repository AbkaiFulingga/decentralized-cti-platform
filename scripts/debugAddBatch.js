// scripts/debugAddBatch.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Debugging addBatch Revert ===\n");
  
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  const testDataFile = chainId === "421614" 
    ? "test-addresses-arbitrum.json" 
    : "test-addresses.json";
  
  const testData = JSON.parse(fs.readFileSync(testDataFile));
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const [admin1, admin2] = await hre.ethers.getSigners();
  
  console.log("Registry:", testData.PrivacyPreservingRegistry);
  console.log("Admin 2:", admin2.address);
  
  // Check registration status
  const contributor = await registry.contributors(admin2.address);
  console.log("\nAdmin 2 status:");
  console.log("  Active:", contributor[5]);
  console.log("  Submissions:", contributor[0].toString());
  console.log("  Tier:", hre.ethers.formatEther(contributor[4]), "ETH");
  
  // Try calling addBatch with try/catch to capture revert reason
  console.log("\n🧪 Testing addBatch with minimal params...");
  
  try {
    // Calculate submission fee
    const feeData = await hre.ethers.provider.getFeeData();
    const estimatedGas = 200000n;
    const gasCost = estimatedGas * feeData.gasPrice;
    const submissionFee = gasCost / 100n;
    
    console.log("Submission fee:", hre.ethers.formatEther(submissionFee), "ETH");
    
    // Use estimateGas to see where it fails
    const gasEstimate = await registry.connect(admin2).addBatch.estimateGas(
      "QmTestCID123456789012345678901234567890123",  // Valid-length CID
      hre.ethers.randomBytes(32),
      true,
      hre.ethers.ZeroHash,
      "0x",
      { value: submissionFee }
    );
    
    console.log("✅ Gas estimate succeeded:", gasEstimate.toString());
    
    // Now try actual transaction
    const tx = await registry.connect(admin2).addBatch(
      "QmTestCID123456789012345678901234567890123",
      hre.ethers.randomBytes(32),
      true,
      hre.ethers.ZeroHash,
      "0x",
      { value: submissionFee }
    );
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    
    console.log("✅ Transaction succeeded!");
    
  } catch (error) {
    console.log("\n❌ Transaction failed:");
    console.log("Error code:", error.code);
    console.log("Error reason:", error.reason || "No reason provided");
    console.log("Error data:", error.data || "No data");
    
    // Try to decode revert reason from error
    if (error.data) {
      try {
        const reason = hre.ethers.toUtf8String("0x" + error.data.slice(138));
        console.log("Decoded revert reason:", reason);
      } catch (e) {
        console.log("Could not decode revert reason");
      }
    }
    
    // Print full error for analysis
    console.log("\nFull error object:");
    console.log(JSON.stringify(error, null, 2));
  }
}

main().catch(console.error);
