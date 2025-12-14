const hre = require("hardhat");

async function main() {
  console.log("\n🔍 Testing Environment & Signer Setup...\n");

  // Check environment variables
  console.log("📋 Environment Check:");
  console.log(`   PRIVATE_KEY_ADMIN1: ${process.env.PRIVATE_KEY_ADMIN1 ? '✅ Set (hidden)' : '❌ Not set'}`);
  console.log(`   ARBITRUM_RPC: ${process.env.ARBITRUM_RPC ? '✅ Set' : '❌ Not set'}`);
  console.log(`   PINATA_JWT: ${process.env.PINATA_JWT ? '✅ Set (hidden)' : '❌ Not set'}\n`);

  // Try to get signers
  console.log("🔑 Signer Check:");
  try {
    const signers = await hre.ethers.getSigners();
    console.log(`   Signers available: ${signers.length}`);
    
    if (signers.length > 0) {
      console.log(`   Signer 0: ${signers[0].address}`);
      const balance = await hre.ethers.provider.getBalance(signers[0].address);
      console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log("\n✅ Diagnostic complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
