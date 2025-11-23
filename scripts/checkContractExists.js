const hre = require("hardhat");

async function main() {
  const addressToCheck = "0x4BBB3c9D24f826C80c50a9AD7380fBc91eE4776e";
  
  console.log("Checking if contract exists at:", addressToCheck);
  
  const code = await hre.ethers.provider.getCode(addressToCheck);
  
  console.log("\nContract bytecode length:", code.length, "characters");
  console.log("Is contract deployed:", code !== "0x");
  
  if (code === "0x") {
    console.log("\n❌ NO CONTRACT FOUND - Address is empty or is an EOA");
    console.log("   This address has no deployed contract code.");
  } else {
    console.log("\n✅ CONTRACT EXISTS - Address has deployed bytecode");
    console.log("   Bytecode preview:", code.substring(0, 66) + "...");
  }
}

main().catch(console.error);
