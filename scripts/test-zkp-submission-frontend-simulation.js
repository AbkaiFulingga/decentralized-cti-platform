// scripts/test-zkp-submission-frontend-simulation.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const axios = require("axios");

async function main() {
  console.log("=== Simulating Frontend ZKP Submission ===\n");
  
  const MERKLE_ZK = "0x8582cf2D5314781d04e7b35e7e553fC9dA14Ac61";
  const USER_ADDRESS = "0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82";
  
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "ETH\n");
  
  // 1. Generate test IOCs and upload to IPFS
  console.log("1️⃣ Creating test IOCs...");
  const testIOCs = [
    "192.168.1.100",
    "malware-test.com",
    "44d88612fea8a8f36de82e1278abb02f"
  ];
  console.log("IOCs:", testIOCs);
  
  // Create Merkle tree of IOCs
  const iocLeaves = testIOCs.map(ioc => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(ioc)));
  const iocTree = new MerkleTree(iocLeaves, hre.ethers.keccak256, { sortPairs: true });
  const iocRoot = iocTree.getHexRoot();
  console.log("IOC Merkle Root:", iocRoot);
  
  // Upload to Pinata
  console.log("\n2️⃣ Uploading to IPFS...");
  const PINATA_JWT = process.env.PINATA_JWT;
  
  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        pinataContent: { iocs: testIOCs, root: iocRoot },
        pinataMetadata: { name: `test-zkp-${Date.now()}` }
      },
      {
        headers: {
          'Authorization': `Bearer ${PINATA_JWT}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const cid = response.data.IpfsHash;
    console.log("CID:", cid);
    
    // 3. Generate ZKP proof
    console.log("\n3️⃣ Generating ZKP proof...");
    const treeData = JSON.parse(fs.readFileSync("contributor-merkle-tree.json"));
    
    const leaves = treeData.contributors.map(addr => 
      "0x" + keccak256(addr.toLowerCase()).toString("hex")
    );
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    
    const userLeaf = "0x" + keccak256(USER_ADDRESS.toLowerCase()).toString("hex");
    const proof = tree.getHexProof(userLeaf);
    
    // Generate commitment
    const secret = hre.ethers.hexlify(hre.ethers.randomBytes(32));
    const timestamp = Date.now();
    const commitment = hre.ethers.keccak256(
      hre.ethers.solidityPacked(
        ["bytes32", "bytes32", "uint256"],
        [userLeaf, secret, timestamp]
      )
    );
    
    console.log("User Leaf:", userLeaf);
    console.log("Proof elements:", proof.length);
    console.log("Commitment:", commitment);
    
    // 4. Get MerkleZK contract
    console.log("\n4️⃣ Connecting to MerkleZK...");
    const merkleZK = await hre.ethers.getContractAt("MerkleZKRegistry", MERKLE_ZK);
    
    // 5. Calculate submission fee
    console.log("\n5️⃣ Calculating submission fee...");
    const feeData = await hre.ethers.provider.getFeeData();
    console.log("maxFeePerGas:", hre.ethers.formatUnits(feeData.maxFeePerGas, 'gwei'), "Gwei");
    
    const submissionValue = hre.ethers.parseEther("0.01"); // Match frontend
    console.log("Submission value:", hre.ethers.formatEther(submissionValue), "ETH");
    
    // 6. Try staticCall first
    console.log("\n6️⃣ Testing with staticCall...");
    try {
      await merkleZK.submitBatchAnonymous.staticCall(
        cid,
        iocRoot,
        commitment,
        proof,
        userLeaf,
        { value: submissionValue }
      );
      console.log("✅ StaticCall passed!");
    } catch (error) {
      console.log("❌ StaticCall failed!");
      console.log("Error:", error.message);
      
      // Try to decode revert reason
      if (error.data) {
        console.log("Revert data:", error.data);
      }
      
      return; // Stop if staticCall fails
    }
    
    // 7. Estimate gas
    console.log("\n7️⃣ Estimating gas...");
    try {
      const gasEstimate = await merkleZK.submitBatchAnonymous.estimateGas(
        cid,
        iocRoot,
        commitment,
        proof,
        userLeaf,
        { value: submissionValue }
      );
      console.log("Gas estimate:", gasEstimate.toString());
      
      // 8. Send actual transaction
      console.log("\n8️⃣ Sending transaction...");
      const tx = await merkleZK.submitBatchAnonymous(
        cid,
        iocRoot,
        commitment,
        proof,
        userLeaf,
        { 
          value: submissionValue,
          gasLimit: gasEstimate * 120n / 100n // 20% buffer
        }
      );
      
      console.log("TX Hash:", tx.hash);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed!");
      console.log("Block:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());
      
      console.log("\n🎉 SUCCESS! Anonymous submission works!");
      console.log("View on Arbiscan:", `https://sepolia.arbiscan.io/tx/${tx.hash}`);
      
    } catch (error) {
      console.log("❌ Gas estimation failed!");
      console.log("Error:", error.message);
      
      if (error.data) {
        console.log("Error data:", error.data);
      }
      
      // Try to get more details
      if (error.transaction) {
        console.log("\nTransaction that failed:");
        console.log("  To:", error.transaction.to);
        console.log("  Value:", error.transaction.value?.toString());
        console.log("  Data:", error.transaction.data?.substring(0, 100) + "...");
      }
    }
    
  } catch (error) {
    console.log("❌ Error during test:", error.message);
    console.error(error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
