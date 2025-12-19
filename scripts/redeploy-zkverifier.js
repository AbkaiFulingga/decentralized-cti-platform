const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🔄 Redeploying ZKVerifier with verifyAndRegisterProof function...\n");
  
  // Load existing addresses
  const addressPath = path.join(__dirname, "../test-addresses-arbitrum.json");
  const addresses = JSON.parse(fs.readFileSync(addressPath, "utf8"));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // Get Groth16Verifier address (should remain the same)
  const groth16Verifier = addresses.Groth16Verifier || "0xDb7c15F9992F9f25bFCC67759C2ff9468ed93bDb";
  console.log("Using Groth16Verifier at:", groth16Verifier);
  
  // Get Merkle root from contributor tree
  const treePath = path.join(__dirname, "../contributor-merkle-tree.json");
  const contributorTree = JSON.parse(fs.readFileSync(treePath, "utf8"));
  const merkleRoot = contributorTree.root;
  console.log("Using Merkle root:", merkleRoot);
  
  // Convert hex root to uint256
  const merkleRootBigInt = BigInt(merkleRoot);
  console.log("Merkle root as uint256:", merkleRootBigInt.toString());
  
  // Deploy new ZKVerifier
  console.log("\n📝 Deploying ZKVerifier...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(groth16Verifier, merkleRootBigInt);
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("✅ ZKVerifier deployed at:", zkVerifierAddress);
  
  // Update PrivacyPreservingRegistry to use new ZKVerifier
  console.log("\n📝 Updating PrivacyPreservingRegistry...");
  const registry = await ethers.getContractAt("PrivacyPreservingRegistry", addresses.PrivacyPreservingRegistry);
  const tx = await registry.setZKVerifier(zkVerifierAddress);
  await tx.wait();
  console.log("✅ Registry updated to use new ZKVerifier");
  
  // Set registry in ZKVerifier
  console.log("\n📝 Setting registry in ZKVerifier...");
  const tx2 = await zkVerifier.setRegistry(addresses.PrivacyPreservingRegistry);
  await tx2.wait();
  console.log("✅ Registry set in ZKVerifier");
  
  // Verify zkVerifier in registry
  const verifierAddress = await registry.zkVerifier();
  console.log("\n✅ Verification: Registry's zkVerifier =", verifierAddress);
  console.log("✅ Match:", verifierAddress.toLowerCase() === zkVerifierAddress.toLowerCase());
  
  // Update addresses file
  addresses.ZKVerifier = zkVerifierAddress;
  addresses.zkVerifierRedeployedAt = new Date().toISOString();
  addresses.zkVerifierRedeployReason = "Added verifyAndRegisterProof function for PrivacyPreservingRegistry";
  
  fs.writeFileSync(
    addressPath,
    JSON.stringify(addresses, null, 2)
  );
  
  console.log("\n✅ Updated test-addresses-arbitrum.json");
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🎉 ZKVerifier Redeployment Complete!");
  console.log("═══════════════════════════════════════════════════════");
  console.log("New ZKVerifier:", zkVerifierAddress);
  console.log("Registry updated: ✅");
  console.log("Function added: verifyAndRegisterProof(uint256[2],uint256[2][2],uint256[2],uint256[2])");
  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
