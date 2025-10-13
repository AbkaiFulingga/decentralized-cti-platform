// scripts/addPrivacyBatch.js (Updated version)
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { create } = require("ipfs-http-client");

async function main() {
  const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
  const registryAddr = testData.PrivacyPreservingRegistry;
  
  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", registryAddr);
  const [deployer] = await hre.ethers.getSigners();

  // Enhanced IOC dataset with privacy metadata
  const iocData = {
    iocs: [
      "sensitive-apt-domain.com",
      "192.168.200.100", 
      "deadbeefcafebabe1234567890abcdef",
      "government-breach-indicator.org",
      "10.10.10.50"
    ],
    metadata: {
      source: "Anonymous Intelligence Analyst",
      classification: "CONFIDENTIAL",
      description: "Nation-state APT infrastructure - requires privacy protection",
      timestamp: new Date().toISOString(),
      tags: ["apt", "nation-state", "confidential"],
      privacyLevel: process.env.PUBLIC === "true" ? "public" : "anonymous"
    }
  };
  
  console.log("=== Privacy-Preserving IOC Submission ===");
  console.log("IOC dataset:", iocData.iocs);
  console.log("Privacy level:", iocData.metadata.privacyLevel);

  // Create Merkle tree
  const leaves = iocData.iocs.map(x => keccak256(x));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  // Upload to IPFS
  const ipfs = create({ url: "http://192.168.1.3:5001" });
  const { cid } = await ipfs.add(JSON.stringify(iocData, null, 2));
  console.log("IPFS CID:", cid.toString());
  console.log("Merkle Root:", root);

  // Privacy choice
  const isPublic = process.env.PUBLIC === "true";
  console.log("Submission type:", isPublic ? "PUBLIC" : "ANONYMOUS");

  if (isPublic) {
    // Check if user is registered as public contributor
    const contributor = await registry.contributors(deployer.address);
    if (!contributor.isActive) {
      console.log("Registering as public contributor first...");
      const stakeAmount = hre.ethers.parseEther("0.05");
      await registry.registerContributor({ value: stakeAmount });
      console.log("✅ Public contributor registered");
    }

    // Public submission
    const tx = await registry.addBatch(
      cid.toString(), 
      root, 
      true, // isPublic
      hre.ethers.ZeroHash, // No ZKP commitment needed
      "0x" // No ZKP proof needed
    );
    await tx.wait();
    console.log("✅ Public batch submitted - identity visible on-chain");
    
  } else {
    // Anonymous submission - need to register commitment first
    const randomNonce = Math.floor(Math.random() * 1000000);
    const commitment = hre.ethers.keccak256(
      hre.ethers.solidityPacked(
        ["address", "uint256"], 
        [deployer.address, randomNonce]
      )
    );
    
    console.log("Checking if anonymous contributor is registered...");
    const isValidCommitment = await registry.validCommitments(commitment);
    
    if (!isValidCommitment) {
      console.log("Registering anonymous contributor with new commitment...");
      const zkpProof = hre.ethers.solidityPacked(["uint256"], [randomNonce]);
      const stakeAmount = hre.ethers.parseEther("0.05");
      
      const regTx = await registry.registerAnonymousContributor(
        commitment,
        zkpProof,
        { value: stakeAmount }
      );
      await regTx.wait();
      console.log("✅ Anonymous contributor registered with commitment:", commitment);
    }
    
    // Now submit the anonymous batch
    const zkpProof = hre.ethers.solidityPacked(["uint256"], [randomNonce]);
    
    const tx = await registry.addBatch(
      cid.toString(),
      root,
      false, // isPublic = false
      commitment,
      zkpProof
    );
    await tx.wait();
    console.log("✅ Anonymous batch submitted - identity protected by ZKP");
  }

  // Display updated statistics
  const stats = await registry.getPlatformStats();
  console.log("\n=== Updated Platform Statistics ===");
  console.log("Total batches:", stats[0].toString());
  console.log("Total accepted:", stats[1].toString());
  console.log("Public batches:", stats[2].toString());
  console.log("Anonymous batches:", stats[3].toString());
  console.log("Public contributors:", stats[4].toString());
  console.log("Anonymous contributors:", stats[5].toString());
}

main().catch(console.error);
