// scripts/diagnose-zkp-submission.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

async function main() {
  console.log("=== Diagnosing ZKP Submission Error ===\n");
  
  // Load addresses
  const treeData = JSON.parse(fs.readFileSync("contributor-merkle-tree.json"));
  const merkleZKAddress = treeData.merkleZKAddress;
  const userAddress = "0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82";
  
  console.log("MerkleZK:", merkleZKAddress);
  console.log("User:", userAddress);
  console.log("");
  
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);
  
  // 1. Check contract exists
  console.log("1️⃣ Checking MerkleZK contract...");
  const code = await hre.ethers.provider.getCode(merkleZKAddress);
  if (code === "0x") {
    console.log("❌ NO CONTRACT at this address!");
    console.log("   MerkleZK may have been redeployed to different address");
    return;
  }
  console.log("✅ Contract exists\n");
  
  const merkleZK = await hre.ethers.getContractAt("MerkleZKRegistry", merkleZKAddress);
  
  // 2. Check if tree initialized
  console.log("2️⃣ Checking contributor tree...");
  try {
    const root = await merkleZK.contributorMerkleRoot();
    const count = await merkleZK.contributorCount();
    const lastUpdate = await merkleZK.lastRootUpdate();
    
    console.log("Root:", root);
    console.log("Count:", count.toString());
    console.log("Last Update:", new Date(Number(lastUpdate) * 1000).toISOString());
    
    if (root === hre.ethers.ZeroHash) {
      console.log("❌ Tree NOT initialized!");
      console.log("   Run: npx hardhat run scripts/add-admins-to-contributor-tree.js --network arbitrumSepolia");
      return;
    }
    console.log("✅ Tree initialized\n");
  } catch (error) {
    console.log("❌ Error reading tree:", error.message);
    return;
  }
  
  // 3. Check user is in tree
  console.log("3️⃣ Checking if user in tree...");
  const leaf = "0x" + keccak256(userAddress.toLowerCase()).toString("hex");
  console.log("User Leaf:", leaf);
  
  const onChainRoot = await merkleZK.contributorMerkleRoot();
  console.log("On-chain Root:", onChainRoot);
  console.log("JSON Root:", treeData.root);
  
  if (onChainRoot.toLowerCase() !== treeData.root.toLowerCase()) {
    console.log("⚠️  WARNING: On-chain root doesn't match JSON file!");
    console.log("   JSON file may be outdated");
  }
  
  // Rebuild tree from JSON
  const leaves = treeData.contributors.map(addr => 
    "0x" + keccak256(addr.toLowerCase()).toString("hex")
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const treeRoot = tree.getHexRoot();
  
  console.log("Rebuilt Root:", treeRoot);
  
  if (!leaves.includes(leaf)) {
    console.log("❌ User NOT in contributor tree!");
    console.log("   Current contributors:", treeData.contributors);
    return;
  }
  console.log("✅ User is in tree\n");
  
  // 4. Generate proof and verify
  console.log("4️⃣ Testing proof generation...");
  const proof = tree.getHexProof(leaf);
  console.log("Proof elements:", proof.length);
  proof.forEach((p, i) => console.log(`  [${i}]`, p));
  
  const isValid = tree.verify(proof, leaf, treeRoot);
  console.log("Local Verification:", isValid ? "✅ Valid" : "❌ Invalid");
  
  // 5. Test on-chain verification
  console.log("\n5️⃣ Testing on-chain proof verification...");
  try {
    const isValidOnChain = await merkleZK.verifyAnonymousContributor(proof, leaf);
    console.log("On-chain Verification:", isValidOnChain ? "✅ Valid" : "❌ Invalid");
  } catch (error) {
    console.log("❌ On-chain verification failed:", error.message);
    return;
  }
  
  // 6. Check mainRegistry
  console.log("\n6️⃣ Checking mainRegistry link...");
  try {
    const mainRegistry = await merkleZK.mainRegistry();
    console.log("Main Registry:", mainRegistry);
    
    const registryCode = await hre.ethers.provider.getCode(mainRegistry);
    if (registryCode === "0x") {
      console.log("❌ Main Registry contract doesn't exist!");
      console.log("   MerkleZK is pointing to wrong/old address");
      return;
    }
    console.log("✅ Main Registry exists");
    
    // Check if Registry trusts MerkleZK
    const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", mainRegistry);
    const merkleZKFromRegistry = await registry.merkleZKRegistry();
    console.log("Registry's MerkleZK:", merkleZKFromRegistry);
    
    if (merkleZKFromRegistry.toLowerCase() !== merkleZKAddress.toLowerCase()) {
      console.log("❌ Registry doesn't trust this MerkleZK!");
      console.log("   Expected:", merkleZKAddress);
      console.log("   Got:", merkleZKFromRegistry);
      return;
    }
    console.log("✅ Bidirectional link correct\n");
  } catch (error) {
    console.log("❌ Error checking registry:", error.message);
    return;
  }
  
  // 7. Check submission fee
  console.log("7️⃣ Checking submission fee...");
  try {
    const registry = await hre.ethers.getContractAt(
      "PrivacyPreservingRegistry", 
      await merkleZK.mainRegistry()
    );
    
    const baseFee = await registry.submissionFee();
    console.log("Base Fee:", hre.ethers.formatEther(baseFee), "ETH");
    
    // Calculate with safety margin (L2 = 1.5x)
    const requiredFee = (baseFee * 15n) / 10n;
    console.log("Required (with margin):", hre.ethers.formatEther(requiredFee), "ETH");
    
    const balance = await hre.ethers.provider.getBalance(userAddress);
    console.log("User Balance:", hre.ethers.formatEther(balance), "ETH");
    
    if (balance < requiredFee) {
      console.log("❌ Insufficient balance!");
      return;
    }
    console.log("✅ Sufficient balance\n");
  } catch (error) {
    console.log("⚠️  Could not check fee:", error.message, "\n");
  }
  
  // 8. Try staticCall
  console.log("8️⃣ Testing transaction (staticCall)...");
  try {
    const testCID = "QmTest123";
    const testRoot = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test"));
    const commitment = hre.ethers.keccak256(
      hre.ethers.solidityPacked(
        ["bytes32", "bytes32", "uint256"],
        [leaf, hre.ethers.hexlify(hre.ethers.randomBytes(32)), Date.now()]
      )
    );
    
    console.log("Test Parameters:");
    console.log("  CID:", testCID);
    console.log("  Commitment:", commitment);
    console.log("  Proof:", proof);
    console.log("  Leaf:", leaf);
    
    const requiredFee = hre.ethers.parseEther("0.0001");
    
    await merkleZK.submitBatchAnonymous.staticCall(
      testCID,
      testRoot,
      commitment,
      proof,
      leaf,
      { value: requiredFee }
    );
    
    console.log("✅ StaticCall succeeded!");
    console.log("\n=== Diagnosis: Contract is working correctly ===");
    console.log("Issue is likely in frontend transaction construction");
    
  } catch (error) {
    console.log("❌ StaticCall failed!");
    console.log("Error:", error.message);
    
    if (error.message.includes("Contributor tree not initialized")) {
      console.log("\n💡 Fix: Tree not initialized properly");
    } else if (error.message.includes("Invalid contributor proof")) {
      console.log("\n💡 Fix: Proof verification failing");
    } else if (error.message.includes("Commitment already used")) {
      console.log("\n💡 Fix: Generate new commitment");
    }
  }
  
  console.log("\n=== Summary ===");
  console.log("MerkleZK Address:", merkleZKAddress);
  console.log("User in tree:", treeData.contributors.includes(userAddress) ? "✅" : "❌");
  console.log("Proof valid:", isValid ? "✅" : "❌");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
