// scripts/check-registry-addresses.js
const hre = require("hardhat");

async function main() {
  console.log("=== Checking Registry Addresses ===\n");
  
  const addresses = [
    "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44", // From deployment output
    "0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E", // From test-addresses-arbitrum.json
    "0x892AD6E47dbD86aD7855f7eEAe0F4fCa6223C36A"  // OLD Registry
  ];
  
  for (const addr of addresses) {
    console.log(`Checking ${addr}...`);
    
    try {
      const code = await hre.ethers.provider.getCode(addr);
      
      if (code === "0x") {
        console.log("  ❌ No contract at this address\n");
        continue;
      }
      
      console.log("  ✅ Contract exists");
      
      // Try to read merkleZKRegistry (only NEW Registry has this)
      try {
        const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", addr);
        const merkleZK = await registry.merkleZKRegistry();
        console.log(`  📍 merkleZKRegistry: ${merkleZK}`);
        
        if (merkleZK === hre.ethers.ZeroAddress) {
          console.log("  ⚠️  Not linked yet");
        } else {
          console.log("  ✅ Linked!");
        }
      } catch (e) {
        console.log("  ⚠️  No merkleZKRegistry() function (old version?)");
      }
      
      console.log("");
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
