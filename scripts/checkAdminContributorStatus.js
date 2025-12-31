// scripts/checkAdminContributorStatus.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Admin Contributor Status Check ===\n");
  
  // Prefer the correct deployment file based on the network.
  // This script is commonly used on both Sepolia and Arbitrum Sepolia.
  const networkName = hre.network.name;
  const deploymentFile = networkName === "arbitrumSepolia"
    ? "test-addresses-arbitrum.json"
    : "test-addresses.json";
  const testData = JSON.parse(fs.readFileSync(deploymentFile));
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );
  
  const [admin1, admin2, admin3] = await hre.ethers.getSigners();
  
  const admins = [
    { name: "Admin 1", address: admin1.address, signer: admin1 },
    { name: "Admin 2", address: admin2.address, signer: admin2 },
    { name: "Admin 3", address: admin3.address, signer: admin3 }
  ];
  
  console.log("Registry Address:", testData.PrivacyPreservingRegistry);
  console.log("Checking contributor status...\n");
  
  for (const admin of admins) {
    console.log(`${admin.name}: ${admin.address}`);
    
    try {
      // Get contributor data: (submissions, accepted, reputation, staked, tier, active, joinedAt)
      const contributor = await registry.contributors(admin.address);
      
      const isRegistered = contributor[5]; // isActive field
      
      if (isRegistered) {
        console.log("  Status: ✅ REGISTERED");
        console.log("  Tier:", hre.ethers.formatEther(contributor[4]), "ETH");
        console.log("  Tier Name:", getTierName(contributor[4]));
        console.log("  Reputation:", contributor[2].toString());
        console.log("  Submissions:", contributor[0].toString());
        console.log("  Accepted:", contributor[1].toString());
        console.log("  Staked:", hre.ethers.formatEther(contributor[3]), "ETH");
        
        const acceptanceRate = contributor[0] > 0 
          ? ((Number(contributor[1]) / Number(contributor[0])) * 100).toFixed(1)
          : "N/A";
        console.log("  Acceptance Rate:", acceptanceRate + "%");
        
        const joinedDate = new Date(Number(contributor[6]) * 1000);
        console.log("  Joined:", joinedDate.toISOString());
        
        // Calculate batches needed to reach PLATINUM
        const currentRep = Number(contributor[2]);
        const tierValue = contributor[4];
        let repBonus;
        
        if (tierValue.toString() === hre.ethers.parseEther("0.1").toString()) {
          repBonus = 15;
        } else if (tierValue.toString() === hre.ethers.parseEther("0.05").toString()) {
          repBonus = 10;
        } else {
          repBonus = 7;
        }
        
        if (currentRep >= 200) {
          console.log("  Access Tier: 🏆 PLATINUM (200+)");
        } else if (currentRep >= 150) {
          console.log("  Access Tier: 🥇 GOLD (150-199)");
          const needed = Math.ceil((200 - currentRep) / repBonus);
          console.log(`  To PLATINUM: ${needed} more accepted batches`);
        } else {
          console.log("  Access Tier: 🥈 STANDARD (100-149)");
          const toGold = Math.ceil((150 - currentRep) / repBonus);
          const toPlatinum = Math.ceil((200 - currentRep) / repBonus);
          console.log(`  To GOLD: ${toGold} batches | To PLATINUM: ${toPlatinum} batches`);
        }
        
      } else {
        console.log("  Status: ❌ NOT REGISTERED");
        console.log("  Note: Admin can still approve batches but cannot submit IOCs");
      }
      
      // Check wallet balance
      const balance = await hre.ethers.provider.getBalance(admin.address);
      console.log("  Wallet Balance:", hre.ethers.formatEther(balance), "ETH");
      
    } catch (error) {
      console.log("  Status: ❌ ERROR");
      console.log("  Error:", error.message);
    }
    
    console.log("");
  }
  
  // Platform summary
  console.log("=== Platform Summary ===");
  const stats = await registry.getPlatformStats();
  console.log("Total Contributors (all tiers):", stats[4].toString());
  console.log("Total Anonymous Contributors:", stats[5].toString());
  console.log("Total Batches:", stats[0].toString());
  console.log("Total Accepted:", stats[1].toString());
  console.log("Total Staked:", hre.ethers.formatEther(stats[6]), "ETH");
}

function getTierName(tierBigInt) {
  const tierString = hre.ethers.formatEther(tierBigInt);
  if (tierString === "0.01") return "MICRO";
  if (tierString === "0.05") return "STANDARD";
  if (tierString === "0.1") return "PREMIUM";
  return "UNKNOWN";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
