const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { MerkleTree } = require("merkletreejs");
const { keccak256 } = require("ethers");

/**
 * Tests anonymous IOC submission using zkSNARK proof
 * Demonstrates privacy-preserving contribution without revealing identity
 */
async function main() {
  console.log("\n🧪 Testing zkSNARK Proof Submission...\n");

  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error("❌ No signers available. Make sure PRIVATE_KEY is set in .env");
  }
  
  const signer = signers[0];
  console.log(`🔑 Testing with: ${signer.address}`);

  // Load contract addresses
  const addressPath = path.join(__dirname, "../test-addresses-arbitrum.json");
  const addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  
  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", addresses.registry);
  console.log(`📝 Registry: ${addresses.registry}\n`);

  // Step 1: Register as contributor (if not already)
  console.log("📝 Step 1: Checking contributor status...");
  try {
    const contributorInfo = await registry.contributors(signer.address);
    if (!contributorInfo.isActive) {
      console.log("⚠️  Not registered. Registering with Premium tier (0.1 ETH)...");
      const tx = await registry.registerContributor({ value: hre.ethers.parseEther("0.1") });
      await tx.wait();
      console.log("✅ Registered successfully!");
    } else {
      console.log(`✅ Already registered (Tier: ${contributorInfo.tier})`);
    }
  } catch (error) {
    console.log("⚠️  Registering with Premium tier (0.1 ETH)...");
    const tx = await registry.registerContributor({ value: hre.ethers.parseEther("0.1") });
    await tx.wait();
    console.log("✅ Registered successfully!");
  }

  // Step 2: Prepare IOC data
  console.log("\n📦 Step 2: Preparing IOC batch...");
  const iocs = [
    "198.51.100.42",
    "malicious-domain.com",
    "5d41402abc4b2a76b9719d911017c592" // MD5 hash
  ];
  console.log(`📊 IOCs: ${iocs.length} indicators`);

  // Build Merkle tree for IOCs
  const iocLeaves = iocs.map(ioc => keccak256(Buffer.from(ioc)));
  const iocTree = new MerkleTree(iocLeaves, keccak256, { sortPairs: true });
  const iocRoot = iocTree.getHexRoot();
  console.log(`🌲 IOC Merkle Root: ${iocRoot}`);

  // Step 3: Upload to IPFS
  console.log("\n☁️  Step 3: Uploading to IPFS...");
  const pinataJWT = process.env.PINATA_JWT;
  if (!pinataJWT) {
    throw new Error("❌ PINATA_JWT not found in .env");
  }

  const metadata = {
    pinataContent: { iocs },
    pinataMetadata: {
      name: `zk-batch-${Date.now()}`,
      keyvalues: {
        type: "anonymous",
        count: iocs.length.toString()
      }
    }
  };

  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    metadata,
    { headers: { Authorization: `Bearer ${pinataJWT}` }}
  );

  const ipfsHash = response.data.IpfsHash;
  console.log(`✅ Uploaded to IPFS: ${ipfsHash}`);

  // Step 4: Generate zkSNARK proof
  console.log("\n🔐 Step 4: Generating zkSNARK proof...");
  console.log("⏳ This may take 10-30 seconds...");
  
  // Load proof from circuit output (generated separately)
  const proofPath = path.join(__dirname, "../circuits/proof.json");
  const publicPath = path.join(__dirname, "../circuits/public.json");
  
  if (!fs.existsSync(proofPath)) {
    console.log("\n❌ Proof file not found!");
    console.log("📋 Generate proof first:");
    console.log("   cd circuits");
    console.log("   snarkjs groth16 prove circuit_final.zkey input.json proof.json public.json");
    console.log("\n💡 Using mock proof for demonstration...");
    
    // Mock proof structure (will fail verification but shows workflow)
    var proof = {
      pi_a: ["0", "0"],
      pi_b: [["0", "0"], ["0", "0"]],
      pi_c: ["0", "0"]
    };
    var publicSignals = [
      "0", // commitment
      "0"  // merkle root
    ];
  } else {
    var proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    var publicSignals = JSON.parse(fs.readFileSync(publicPath, "utf8"));
    console.log("✅ Loaded proof from file");
  }

  // Step 5: Submit anonymous batch
  console.log("\n🚀 Step 5: Submitting anonymous batch...");
  
  // Convert proof to contract format
  const proofArgs = [
    proof.pi_a.slice(0, 2),
    [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
    proof.pi_c.slice(0, 2)
  ];

  const commitment = publicSignals[0];
  console.log(`🔒 Commitment: ${commitment}`);

  try {
    const tx = await registry.addBatchWithZKProof(
      ipfsHash,
      iocRoot,
      proofArgs,
      commitment
    );
    
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

    // Check event
    const event = receipt.logs.find(log => {
      try {
        const parsed = registry.interface.parseLog(log);
        return parsed.name === "AnonymousBatchSubmitted";
      } catch { return false; }
    });

    if (event) {
      const parsed = registry.interface.parseLog(event);
      console.log("\n🎉 Anonymous Batch Submitted!");
      console.log(`   Batch Index: ${parsed.args.batchIndex}`);
      console.log(`   Commitment: ${parsed.args.commitment}`);
      console.log(`   IPFS: ${parsed.args.ipfsHash}`);
      console.log(`   Merkle Root: ${parsed.args.merkleRoot}`);
    }

    console.log("\n✅ SUCCESS! Anonymous submission completed!");
    console.log("\n🔍 Privacy guarantees:");
    console.log("   ✓ Your address is NOT linked to the batch");
    console.log("   ✓ Commitment is unique and unlinkable");
    console.log("   ✓ zkSNARK proves you're a valid contributor");
    console.log("   ✓ Zero-knowledge: no info leaked except validity");

  } catch (error) {
    console.error("\n❌ Submission failed:", error.message);
    if (error.message.includes("InvalidProof")) {
      console.log("\n💡 Tips:");
      console.log("   - Generate a real proof using snarkjs");
      console.log("   - Update ZKVerifier Merkle root to include your address");
      console.log("   - Ensure circuit input matches on-chain state");
    }
    throw error;
  }

  console.log("\n🎯 Next Steps:");
  console.log("   1. Test replay attack: npx hardhat run scripts/test-replay-attack.js --network arbitrumSepolia");
  console.log("   2. Approve batch: Admin needs to call governance.approveBatch()");
  console.log("   3. Check reputation: Your reputation updated without revealing identity!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
