// scripts/attack-simulations/replay-attack.js
// ATTACK: Reuse valid ZKP proof to submit multiple times (double-spend)
// DEFENSE: Nullifier/commitment tracking prevents reuse

const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🎯 ATTACK SIMULATION: Replay Attack");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log("📋 OBJECTIVE:");
  console.log("   Capture a valid anonymous submission and replay it multiple");
  console.log("   times to inflate reputation or spam the system.\n");
  
  console.log("🔍 METHODOLOGY:");
  console.log("   1. Make one legitimate anonymous submission");
  console.log("   2. Capture the ZKP proof and commitment");
  console.log("   3. Attempt to resubmit with same proof (replay)");
  console.log("   4. Attempt to resubmit with same commitment, different data");
  console.log("   5. Verify nullifier/commitment tracking prevents reuse\n");
  
  console.log("─────────────────────────────────────────────────────────\n");
  
  // Load deployed addresses
  let addresses;
  try {
    addresses = JSON.parse(fs.readFileSync("test-addresses-arbitrum.json"));
  } catch {
    console.log("⚠️  No Arbitrum deployment found, using Sepolia...");
    addresses = JSON.parse(fs.readFileSync("test-addresses.json"));
  }
  
  const [attacker] = await hre.ethers.getSigners();
  console.log(`🕵️  Attacker address: ${attacker.address}\n`);
  
  // Load MerkleZK if available
  let merkleZK, contributorTree;
  try {
    const treeData = JSON.parse(fs.readFileSync("contributor-merkle-tree.json"));
    
    if (treeData.contributors.includes(attacker.address)) {
      merkleZK = await hre.ethers.getContractAt(
        "MerkleZKRegistry",
        treeData.merkleZKAddress
      );
      
      // Rebuild tree
      const leaves = treeData.contributors.map(addr => 
        keccak256(addr.toLowerCase())
      );
      contributorTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      
      console.log("✅ Attacker is in contributor tree (can make anonymous submissions)\n");
    } else {
      console.log("⚠️  Attacker not in contributor tree - using public submission mode\n");
    }
  } catch (error) {
    console.log("⚠️  No MerkleZK deployment found - using public submission mode\n");
  }
  
  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    addresses.PrivacyPreservingRegistry
  );
  
  // Check if attacker is registered
  const contributor = await registry.contributors(attacker.address);
  if (!contributor.isActive) {
    console.log("❌ Attacker is not registered as contributor");
    console.log("   Registering now with minimum stake...\n");
    
    const microStake = await registry.MICRO_STAKE();
    const tx = await registry.registerContributor(microStake, { value: microStake });
    await tx.wait();
    
    console.log("✅ Registered successfully\n");
  } else {
    console.log("✅ Attacker already registered as contributor\n");
  }
  
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔬 ATTACK EXECUTION: Creating Original Submission");
  console.log("═══════════════════════════════════════════════════════\n");
  
  // Create legitimate submission first
  const originalIOCs = ["192.168.1.100", "evil.com", "deadbeef123456"];
  const leaves = originalIOCs.map(ioc => keccak256(ioc));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = tree.getHexRoot();
  
  const originalCID = "QmOriginalSubmission" + Date.now();
  
  console.log("📝 Original submission details:");
  console.log(`   CID: ${originalCID}`);
  console.log(`   Merkle Root: ${merkleRoot}`);
  console.log(`   IOCs: ${originalIOCs.join(", ")}\n`);
  
  let capturedCommitment, capturedProof, capturedLeaf;
  let originalTxHash;
  
  const results = {
    exact_replay_attempts: 0,
    exact_replay_success: 0,
    commitment_reuse_attempts: 0,
    commitment_reuse_success: 0,
    total_gas_wasted: 0n
  };
  
  if (merkleZK && contributorTree) {
    console.log("🔐 Using anonymous submission (via MerkleZKRegistry)...\n");
    
    // Generate ZKP proof
    const leaf = keccak256(attacker.address.toLowerCase());
    capturedLeaf = "0x" + leaf.toString("hex");
    capturedProof = contributorTree.getHexProof(leaf);
    
    // Generate commitment (this is what prevents replay)
    const secret = hre.ethers.randomBytes(32);
    const timestamp = Date.now();
    capturedCommitment = hre.ethers.keccak256(
      hre.ethers.solidityPacked(
        ["bytes32", "bytes32", "uint256"],
        [capturedLeaf, secret, timestamp]
      )
    );
    
    console.log(`   Commitment: ${capturedCommitment}`);
    console.log(`   Proof elements: ${capturedProof.length}`);
    console.log(`   Leaf: ${capturedLeaf}\n`);
    
    console.log("📡 Submitting original anonymous batch...");
    
    try {
      const tx = await merkleZK.submitBatchAnonymous(
        originalCID,
        merkleRoot,
        capturedCommitment,
        capturedProof,
        capturedLeaf,
        { value: hre.ethers.parseEther("0.001") }
      );
      const receipt = await tx.wait();
      originalTxHash = receipt.hash;
      
      console.log(`✅ Original submission successful!`);
      console.log(`   Transaction: ${originalTxHash}\n`);
    } catch (error) {
      console.log(`❌ Original submission failed: ${error.message}\n`);
      return;
    }
    
  } else {
    console.log("📢 Using public submission (via PrivacyPreservingRegistry)...\n");
    
    capturedCommitment = hre.ethers.ZeroHash;
    
    console.log("📡 Submitting original public batch...");
    
    try {
      const tx = await registry.addBatch(
        originalCID,
        merkleRoot,
        true,
        capturedCommitment,
        "0x00"
      );
      const receipt = await tx.wait();
      originalTxHash = receipt.hash;
      
      console.log(`✅ Original submission successful!`);
      console.log(`   Transaction: ${originalTxHash}\n`);
    } catch (error) {
      console.log(`❌ Original submission failed: ${error.message}\n`);
      return;
    }
  }
  
  // Wait a bit
  console.log("⏳ Waiting 5 seconds before replay attack...\n");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // ATTACK 1: Exact replay (same everything)
  console.log("═══════════════════════════════════════════════════════");
  console.log("⚔️  ATTACK VECTOR 1: Exact Replay");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("Attempting to resubmit with identical proof and commitment...\n");
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`🔄 Replay attempt #${attempt}:`);
    results.exact_replay_attempts++;
    
    try {
      let tx;
      if (merkleZK) {
        tx = await merkleZK.submitBatchAnonymous(
          originalCID,
          merkleRoot,
          capturedCommitment,
          capturedProof,
          capturedLeaf,
          { value: hre.ethers.parseEther("0.001"), gasLimit: 500000 }
        );
      } else {
        tx = await registry.addBatch(
          originalCID,
          merkleRoot,
          true,
          capturedCommitment,
          "0x00",
          { gasLimit: 500000 }
        );
      }
      
      const receipt = await tx.wait();
      results.total_gas_wasted += receipt.gasUsed;
      
      // If we get here, replay succeeded (BAD!)
      results.exact_replay_success++;
      console.log(`   ⚠️  REPLAY SUCCESSFUL! Transaction: ${receipt.hash}`);
      console.log(`   🚨 CRITICAL VULNERABILITY: Commitment reuse not prevented!\n`);
      
    } catch (error) {
      if (error.message.includes("Commitment already used") || 
          error.message.includes("usedCommitments")) {
        console.log(`   ✅ BLOCKED: "Commitment already used"`);
        console.log(`   🔒 Defense: Nullifier tracking prevented replay\n`);
      } else if (error.message.includes("revert")) {
        console.log(`   ✅ BLOCKED: ${error.reason || "Transaction reverted"}`);
        console.log(`   🔒 Defense: Smart contract prevented replay\n`);
      } else {
        console.log(`   ❌ ERROR: ${error.message.split('\n')[0]}\n`);
      }
    }
  }
  
  // ATTACK 2: Commitment reuse with different data
  console.log("─────────────────────────────────────────────────────────");
  console.log("⚔️  ATTACK VECTOR 2: Commitment Reuse (Different Data)");
  console.log("─────────────────────────────────────────────────────────\n");
  console.log("Attempting to reuse commitment with different IOCs...\n");
  
  const newIOCs = ["10.0.0.1", "malicious.net", "cafebabe789012"];
  const newLeaves = newIOCs.map(ioc => keccak256(ioc));
  const newTree = new MerkleTree(newLeaves, keccak256, { sortPairs: true });
  const newMerkleRoot = newTree.getHexRoot();
  const newCID = "QmReplayAttempt" + Date.now();
  
  console.log("📝 New submission (reusing old commitment):");
  console.log(`   CID: ${newCID} (different)`);
  console.log(`   Merkle Root: ${newMerkleRoot} (different)`);
  console.log(`   Commitment: ${capturedCommitment} (SAME - reused!)`);
  console.log(`   IOCs: ${newIOCs.join(", ")} (different)\n`);
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`🔄 Reuse attempt #${attempt}:`);
    results.commitment_reuse_attempts++;
    
    try {
      let tx;
      if (merkleZK) {
        tx = await merkleZK.submitBatchAnonymous(
          newCID,
          newMerkleRoot,
          capturedCommitment, // REUSING old commitment!
          capturedProof,
          capturedLeaf,
          { value: hre.ethers.parseEther("0.001"), gasLimit: 500000 }
        );
      } else {
        tx = await registry.addBatch(
          newCID,
          newMerkleRoot,
          true,
          capturedCommitment, // REUSING old commitment!
          "0x00",
          { gasLimit: 500000 }
        );
      }
      
      const receipt = await tx.wait();
      results.total_gas_wasted += receipt.gasUsed;
      
      results.commitment_reuse_success++;
      console.log(`   ⚠️  REUSE SUCCESSFUL! Transaction: ${receipt.hash}`);
      console.log(`   🚨 VULNERABILITY: Same commitment accepted for different data!\n`);
      
    } catch (error) {
      if (error.message.includes("Commitment already used") || 
          error.message.includes("usedCommitments")) {
        console.log(`   ✅ BLOCKED: "Commitment already used"`);
        console.log(`   🔒 Defense: Commitment tracking prevented reuse\n`);
      } else if (error.message.includes("revert")) {
        console.log(`   ✅ BLOCKED: ${error.reason || "Transaction reverted"}`);
        console.log(`   🔒 Defense: Smart contract enforced uniqueness\n`);
      } else {
        console.log(`   ❌ ERROR: ${error.message.split('\n')[0]}\n`);
      }
    }
  }
  
  // Summary
  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 ATTACK RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const totalAttempts = results.exact_replay_attempts + results.commitment_reuse_attempts;
  const totalSuccess = results.exact_replay_success + results.commitment_reuse_success;
  
  console.log(`Total replay attempts: ${totalAttempts}`);
  console.log(`Successful replays: ${totalSuccess}`);
  console.log(`Blocked replays: ${totalAttempts - totalSuccess}\n`);
  
  console.log("📋 BREAKDOWN:");
  console.log(`   Exact replay: ${results.exact_replay_success}/${results.exact_replay_attempts} succeeded`);
  console.log(`   Commitment reuse: ${results.commitment_reuse_success}/${results.commitment_reuse_attempts} succeeded\n`);
  
  if (totalSuccess === 0) {
    console.log("🎉 ALL REPLAY ATTACKS BLOCKED!");
    console.log("\n🔒 SECURITY GUARANTEES VERIFIED:");
    console.log("   ✓ Commitment uniqueness enforced");
    console.log("   ✓ Nullifier tracking prevents double-spending");
    console.log("   ✓ Each proof can only be used once");
    console.log("   ✓ System resistant to replay attacks\n");
  } else {
    console.log("🚨 CRITICAL VULNERABILITY!");
    console.log("\n⚠️  IMMEDIATE ACTION REQUIRED:");
    console.log("   - Implement commitment/nullifier tracking");
    console.log("   - Add mapping(bytes32 => bool) usedCommitments");
    console.log("   - Check usedCommitments before accepting submission");
    console.log("   - Consider adding time-based expiry for extra security\n");
  }
  
  // Technical explanation
  console.log("═══════════════════════════════════════════════════════");
  console.log("🎓 TECHNICAL EXPLANATION");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log("WHY REPLAY ATTACKS FAIL:");
  console.log("\n1. NULLIFIER MECHANISM:");
  console.log("   mapping(bytes32 => bool) public usedCommitments;");
  console.log("   ");
  console.log("   function submitBatch(..., bytes32 commitment) {");
  console.log("       require(!usedCommitments[commitment], 'Already used');");
  console.log("       usedCommitments[commitment] = true;");
  console.log("       ...");
  console.log("   }");
  console.log("   - Each commitment marked as used after first submission");
  console.log("   - Subsequent attempts with same commitment revert\n");
  
  console.log("2. COMMITMENT STRUCTURE:");
  console.log("   commitment = keccak256(contributorLeaf || secret || timestamp)");
  console.log("   ");
  console.log("   - Contains random 256-bit secret (fresh per submission)");
  console.log("   - Includes timestamp (prevents temporal replay)");
  console.log("   - Cryptographically bound to contributor leaf");
  console.log("   - Result: Each submission has unique commitment\n");
  
  console.log("3. DOUBLE-SPEND PREVENTION:");
  console.log("   Similar to blockchain transactions:");
  console.log("   - Bitcoin: UTXO model prevents double-spend");
  console.log("   - Ethereum: Nonce prevents transaction replay");
  console.log("   - Our system: Commitment nullifier prevents proof replay\n");
  
  console.log("4. COMPARISON TO FLAWED SYSTEMS:");
  console.log("   ❌ Flawed: Accept any valid signature");
  console.log("      → Attacker can replay same signed message");
  console.log("   ");
  console.log("   ✅ Secure: Accept valid signature + unique nullifier");
  console.log("      → Each signature tied to one-time nullifier\n");
  
  console.log("5. ATTACK COST:");
  console.log("   If replay succeeded:");
  console.log(`   - Gas wasted: ${hre.ethers.formatUnits(results.total_gas_wasted, "gwei")} gwei`);
  console.log("   - Potential reputation inflation: Unlimited");
  console.log("   - System integrity: Compromised");
  console.log("   ");
  console.log("   With proper defense:");
  console.log("   - Replays blocked at smart contract level");
  console.log("   - No gas refund for failed attacks");
  console.log("   - Attacker pays for their failed attempts\n");
  
  console.log("═══════════════════════════════════════════════════════\n");
  
  // Save results
  const report = {
    attack: "Replay Attack",
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    attacker: attacker.address,
    original_submission: originalTxHash,
    captured_commitment: capturedCommitment,
    total_attempts: totalAttempts,
    successful_replays: totalSuccess,
    attack_success_rate: `${((totalSuccess / totalAttempts) * 100).toFixed(2)}%`,
    gas_wasted_wei: results.total_gas_wasted.toString(),
    details: results,
    conclusion: totalSuccess === 0 ?
      "ATTACK FAILED - Nullifier/commitment tracking provides strong replay protection" :
      "ATTACK SUCCESSFUL - CRITICAL VULNERABILITY IN REPLAY PREVENTION"
  };
  
  fs.writeFileSync(
    "scripts/attack-simulations/replay-attack-results.json",
    JSON.stringify(report, null, 2)
  );
  
  console.log("💾 Results saved to: scripts/attack-simulations/replay-attack-results.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
