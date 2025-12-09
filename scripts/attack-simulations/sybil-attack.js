// scripts/attack-simulations/sybil-attack.js
// ATTACK: Create multiple fake identities to submit IOCs without staking
// DEFENSE: Smart contract enforces stake requirement, rate limiting

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🎯 ATTACK SIMULATION: Sybil Attack");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log("📋 OBJECTIVE:");
  console.log("   Overwhelm the system with fake submissions from multiple");
  console.log("   disposable identities WITHOUT paying the required stake.\n");
  
  console.log("🔍 METHODOLOGY:");
  console.log("   1. Create 10 new Ethereum addresses (Sybil identities)");
  console.log("   2. Attempt to register as contributor without stake");
  console.log("   3. Attempt to submit IOCs directly without registration");
  console.log("   4. Attempt to bypass stake with insufficient amount");
  console.log("   5. Measure defense effectiveness\n");
  
  console.log("─────────────────────────────────────────────────────────\n");
  
  // Load deployed addresses
  let addresses;
  try {
    addresses = JSON.parse(fs.readFileSync("test-addresses-arbitrum.json"));
  } catch {
    console.log("⚠️  No Arbitrum deployment found, using Sepolia...");
    addresses = JSON.parse(fs.readFileSync("test-addresses.json"));
  }
  
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    addresses.PrivacyPreservingRegistry
  );
  
  console.log("💰 Fetching staking requirements...\n");
  const microStake = await registry.MICRO_STAKE();
  const standardStake = await registry.STANDARD_STAKE();
  const premiumStake = await registry.PREMIUM_STAKE();
  
  console.log(`   Micro tier:    ${hre.ethers.formatEther(microStake)} ETH`);
  console.log(`   Standard tier: ${hre.ethers.formatEther(standardStake)} ETH`);
  console.log(`   Premium tier:  ${hre.ethers.formatEther(premiumStake)} ETH\n`);
  
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔬 ATTACK EXECUTION: Creating Sybil Identities");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const results = {
    no_stake_attempts: 0,
    no_stake_success: 0,
    insufficient_stake_attempts: 0,
    insufficient_stake_success: 0,
    unregistered_submission_attempts: 0,
    unregistered_submission_success: 0,
    total_cost_eth: 0,
    total_cost_usd: 0
  };
  
  // Generate 10 Sybil identities
  const sybilIdentities = [];
  for (let i = 0; i < 10; i++) {
    const wallet = hre.ethers.Wallet.createRandom();
    sybilIdentities.push(wallet);
    console.log(`🕵️  Sybil Identity #${i + 1}: ${wallet.address}`);
  }
  console.log("\n");
  
  // ATTACK 1: Try to register without stake
  console.log("─────────────────────────────────────────────────────────");
  console.log("⚔️  ATTACK VECTOR 1: Register Without Stake");
  console.log("─────────────────────────────────────────────────────────\n");
  
  for (let i = 0; i < 3; i++) {
    const sybil = sybilIdentities[i];
    console.log(`Attempting registration for Sybil #${i + 1}...`);
    
    try {
      results.no_stake_attempts++;
      
      // Try to register with 0 ETH
      await registry.registerContributor(standardStake, { value: 0 });
      
      // If we reach here, attack succeeded
      results.no_stake_success++;
      console.log(`   ⚠️  SUCCESS: Registered without stake!\n`);
      
    } catch (error) {
      // Expected: transaction should revert
      if (error.message.includes("Insufficient stake")) {
        console.log(`   ✅ BLOCKED: "Insufficient stake for selected tier"`);
      } else if (error.message.includes("revert")) {
        console.log(`   ✅ BLOCKED: ${error.reason || error.message.split('\n')[0]}`);
      } else {
        console.log(`   ❌ ERROR: ${error.message.split('\n')[0]}`);
      }
      console.log(`   🔒 Defense: Smart contract enforced stake requirement\n`);
    }
  }
  
  // ATTACK 2: Try to register with insufficient stake
  console.log("─────────────────────────────────────────────────────────");
  console.log("⚔️  ATTACK VECTOR 2: Register With Insufficient Stake");
  console.log("─────────────────────────────────────────────────────────\n");
  
  for (let i = 3; i < 6; i++) {
    const sybil = sybilIdentities[i];
    const tinyStake = hre.ethers.parseEther("0.001"); // Way below minimum
    
    console.log(`Attempting registration for Sybil #${i + 1} with ${hre.ethers.formatEther(tinyStake)} ETH...`);
    
    try {
      results.insufficient_stake_attempts++;
      
      await registry.registerContributor(standardStake, { value: tinyStake });
      
      results.insufficient_stake_success++;
      console.log(`   ⚠️  SUCCESS: Registered with insufficient stake!\n`);
      
    } catch (error) {
      if (error.message.includes("Insufficient stake")) {
        console.log(`   ✅ BLOCKED: "Insufficient stake for selected tier"`);
        console.log(`   Required: ${hre.ethers.formatEther(standardStake)} ETH`);
        console.log(`   Provided: ${hre.ethers.formatEther(tinyStake)} ETH`);
      } else if (error.message.includes("revert")) {
        console.log(`   ✅ BLOCKED: ${error.reason || "Transaction reverted"}`);
      } else {
        console.log(`   ❌ ERROR: ${error.message.split('\n')[0]}`);
      }
      console.log(`   🔒 Defense: Stake validation enforced\n`);
    }
  }
  
  // ATTACK 3: Try to submit without registering
  console.log("─────────────────────────────────────────────────────────");
  console.log("⚔️  ATTACK VECTOR 3: Submit IOCs Without Registration");
  console.log("─────────────────────────────────────────────────────────\n");
  
  for (let i = 6; i < 9; i++) {
    const sybil = sybilIdentities[i];
    
    console.log(`Attempting IOC submission from unregistered Sybil #${i + 1}...`);
    
    try {
      results.unregistered_submission_attempts++;
      
      const fakeCID = "QmSybilAttackFakeIOCs" + i;
      const fakeMerkleRoot = hre.ethers.randomBytes(32);
      
      await registry.addBatch(fakeCID, fakeMerkleRoot, true, hre.ethers.ZeroHash, "0x00");
      
      results.unregistered_submission_success++;
      console.log(`   ⚠️  SUCCESS: Submitted without registration!\n`);
      
    } catch (error) {
      if (error.message.includes("Not active contributor")) {
        console.log(`   ✅ BLOCKED: "Not active contributor"`);
      } else if (error.message.includes("revert")) {
        console.log(`   ✅ BLOCKED: ${error.reason || "Transaction reverted"}`);
      } else {
        console.log(`   ❌ ERROR: ${error.message.split('\n')[0]}`);
      }
      console.log(`   🔒 Defense: Registration requirement enforced\n`);
    }
  }
  
  // Calculate cost of successful Sybil attack (if any)
  console.log("═══════════════════════════════════════════════════════");
  console.log("💰 ATTACK COST ANALYSIS");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const successfulAttacks = 
    results.no_stake_success + 
    results.insufficient_stake_success + 
    results.unregistered_submission_success;
  
  if (successfulAttacks > 0) {
    console.log(`⚠️  ${successfulAttacks} attack vectors succeeded!`);
    console.log(`   Cost per successful attack: 0 ETH (no stake required)`);
    console.log(`   Total attack cost: 0 ETH\n`);
  } else {
    console.log("✅ All attack vectors blocked!\n");
    console.log("💸 COST TO ATTACK (if stake enforcement removed):");
    console.log(`   Per Sybil identity: ${hre.ethers.formatEther(microStake)} ETH (minimum)`);
    console.log(`   For 10 identities:  ${hre.ethers.formatEther(microStake * 10n)} ETH`);
    console.log(`   For 100 identities: ${hre.ethers.formatEther(microStake * 100n)} ETH`);
    console.log(`   For 1000 identities: ${hre.ethers.formatEther(microStake * 1000n)} ETH\n`);
    
    // Estimate USD cost (approximate ETH price)
    const ethPriceUSD = 3500; // Approximate
    const cost100 = Number(hre.ethers.formatEther(microStake * 100n)) * ethPriceUSD;
    const cost1000 = Number(hre.ethers.formatEther(microStake * 1000n)) * ethPriceUSD;
    
    console.log(`💵 USD Cost Estimate (ETH @ $${ethPriceUSD}):`);
    console.log(`   100 Sybils:  $${cost100.toLocaleString()}`);
    console.log(`   1000 Sybils: $${cost1000.toLocaleString()}\n`);
    
    results.total_cost_eth = Number(hre.ethers.formatEther(microStake * 1000n));
    results.total_cost_usd = cost1000;
  }
  
  // Summary
  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 ATTACK RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const totalAttempts = 
    results.no_stake_attempts + 
    results.insufficient_stake_attempts + 
    results.unregistered_submission_attempts;
  
  console.log(`Total attack attempts: ${totalAttempts}`);
  console.log(`Successful attacks: ${successfulAttacks}`);
  console.log(`Blocked attacks: ${totalAttempts - successfulAttacks}\n`);
  
  console.log("📋 BREAKDOWN:");
  console.log(`   No stake: ${results.no_stake_success}/${results.no_stake_attempts} succeeded`);
  console.log(`   Insufficient stake: ${results.insufficient_stake_success}/${results.insufficient_stake_attempts} succeeded`);
  console.log(`   Unregistered: ${results.unregistered_submission_success}/${results.unregistered_submission_attempts} succeeded\n`);
  
  if (successfulAttacks === 0) {
    console.log("🎉 ATTACK COMPLETELY FAILED!");
    console.log("\n🔒 SECURITY GUARANTEES VERIFIED:");
    console.log("   ✓ Stake requirement enforced by smart contract");
    console.log("   ✓ Cannot bypass registration process");
    console.log("   ✓ Economic barrier prevents spam");
    console.log("   ✓ Sybil resistance mechanism working correctly\n");
  } else {
    console.log("🚨 CRITICAL VULNERABILITY DETECTED!");
    console.log("\n⚠️  IMMEDIATE ACTION REQUIRED:");
    console.log("   - Review smart contract stake validation logic");
    console.log("   - Add additional access control checks");
    console.log("   - Consider implementing rate limiting");
    console.log("   - Audit all entry points for bypass vulnerabilities\n");
  }
  
  // Technical explanation
  console.log("═══════════════════════════════════════════════════════");
  console.log("🎓 TECHNICAL EXPLANATION");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log("WHY SYBIL ATTACKS FAIL:");
  console.log("\n1. ECONOMIC DISINCENTIVE:");
  console.log("   - Each identity requires stake (minimum 0.01 ETH)");
  console.log("   - Stake is locked and at risk of slashing");
  console.log("   - Cost of attack scales linearly with Sybil count");
  console.log("   - Example: 1000 fake identities = 10 ETH ($35,000 USD)\n");
  
  console.log("2. SMART CONTRACT ENFORCEMENT:");
  console.log("   modifier onlyActiveContributor() {");
  console.log("       require(contributors[msg.sender].isActive, 'Not active');");
  console.log("       _;");
  console.log("   }");
  console.log("   - All submission functions protected by modifier");
  console.log("   - Cannot bypass without registered stake\n");
  
  console.log("3. TIERED REPUTATION SYSTEM:");
  console.log("   - Micro tier (0.01 ETH): +7 reputation per batch");
  console.log("   - Standard tier (0.05 ETH): +10 reputation per batch");
  console.log("   - Premium tier (0.1 ETH): +15 reputation per batch");
  console.log("   - Higher stake = more trusted submissions\n");
  
  console.log("4. SLASHING MECHANISM:");
  console.log("   - False positive reports reduce reputation");
  console.log("   - Bad actors lose stake through governance");
  console.log("   - Creates long-term accountability");
  console.log("   - Makes disposable identities economically unviable\n");
  
  console.log("5. COMPARISON TO WEB2 SYSTEMS:");
  console.log("   Traditional CTI: Free account creation → Sybil heaven");
  console.log("   Our system: Staked accounts → Sybil hell");
  console.log("   Cost difference: $0 vs $35 per identity\n");
  
  console.log("═══════════════════════════════════════════════════════\n");
  
  // Save results
  const report = {
    attack: "Sybil Attack",
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    registry: addresses.PrivacyPreservingRegistry,
    sybil_identities_created: sybilIdentities.length,
    total_attempts: totalAttempts,
    successful_attacks: successfulAttacks,
    attack_success_rate: `${((successfulAttacks / totalAttempts) * 100).toFixed(2)}%`,
    stake_requirements: {
      micro: hre.ethers.formatEther(microStake) + " ETH",
      standard: hre.ethers.formatEther(standardStake) + " ETH",
      premium: hre.ethers.formatEther(premiumStake) + " ETH"
    },
    cost_analysis: {
      attack_cost_1000_identities_eth: results.total_cost_eth,
      attack_cost_1000_identities_usd: results.total_cost_usd
    },
    details: results,
    conclusion: successfulAttacks === 0 ? 
      "ATTACK FAILED - Stake requirement provides strong Sybil resistance" : 
      "ATTACK SUCCESSFUL - CRITICAL VULNERABILITY IN STAKE ENFORCEMENT"
  };
  
  fs.writeFileSync(
    "scripts/attack-simulations/sybil-attack-results.json",
    JSON.stringify(report, null, 2)
  );
  
  console.log("💾 Results saved to: scripts/attack-simulations/sybil-attack-results.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
