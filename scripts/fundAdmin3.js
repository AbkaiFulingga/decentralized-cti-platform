// scripts/fundAdmin3.js
const hre = require("hardhat");

async function main() {
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  console.log("Admin 1:", admin1.address);
  console.log("Admin 2:", admin2.address);
  console.log("Admin 3:", admin3.address);
  
  const balance3 = await hre.ethers.provider.getBalance(admin3.address);
  console.log("\nAdmin 3 current balance:", hre.ethers.formatEther(balance3), "ETH");
  
  if (balance3 < hre.ethers.parseEther("0.15")) {
    console.log("\nSending 0.15 ETH from Admin 1 to Admin 3...");
    
    const tx = await admin1.sendTransaction({
      to: admin3.address,
      value: hre.ethers.parseEther("0.15")
    });
    
    await tx.wait();
    console.log("✅ Sent 0.15 ETH to Admin 3");
    
    const newBalance = await hre.ethers.provider.getBalance(admin3.address);
    console.log("Admin 3 new balance:", hre.ethers.formatEther(newBalance), "ETH");
  } else {
    console.log("✅ Admin 3 already has sufficient balance");
  }
}

main().catch(console.error);
