// scripts/verifyPrivacyIOC.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { create } = require("ipfs-http-client");

async function main() {
  // Load deployed address for PrivacyPreservingRegistry
  const testData = JSON.parse(fs.readFileSync("test-addresses.json", "utf8"));
  const registryAddr = testData.PrivacyPreservingRegistry;

  // Connect to the privacy-preserving registry
  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", registryAddr);

  // Get batch index from environment variable or default to 0
  const batchIndex = Number(process.env.BATCH_INDEX ?? 0);
  
  console.log(`Verifying IOC in batch ${batchIndex}...`);
  
  // Get batch info (updated function signature for privacy registry)
  const batch = await registry.getBatch(batchIndex);
  const cid = batch[0];           // cid
  const onChainRoot = batch[1];   // merkleRoot
  const isPublic = batch[5];      // isPublic flag
  const contributorHash = batch[4]; // contributorHash
  
  console.log(`Batch ${batchIndex}:`);
  console.log(`  CID: ${cid}`);
  console.log(`  On-chain root: ${onChainRoot}`);
  console.log(`  Privacy type: ${isPublic ? 'PUBLIC' : 'ANONYMOUS'}`);
  console.log(`  Contributor hash: ${contributorHash}`);

  // Connect to IPFS (your remote node)
  const ipfs = create({ url: "http://192.168.1.3:5001" });

  try {
    // Fetch dataset from IPFS
    let chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const text = buffer.toString().trim();

    console.log("Raw IPFS content:", text);

    // Parse the dataset (handle both old and new formats)
    let dataset;
    try {
      const parsed = JSON.parse(text);
      if (parsed.iocs) {
        // New format with metadata
        dataset = parsed.iocs;
        console.log("Metadata:", parsed.metadata);
      } else {
        // Old flat format
        dataset = parsed;
      }
    } catch (e) {
      console.log("Failed to parse as JSON, treating as flat array");
      dataset = JSON.parse(text);
    }

    console.log("IOC Dataset:", dataset);

    // Build Merkle tree (same params as submission)
    const leaves = dataset.map((x) => keccak256(x));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

    // IOC to verify (from command line or first element)
    const iocToVerify = process.argv[2] ?? dataset[0];
    console.log("Verifying IOC:", iocToVerify);

    // Generate proof
    const leafBuf = keccak256(iocToVerify);
    const leafHex = "0x" + leafBuf.toString("hex");
    const proof = tree.getHexProof(leafBuf);

    console.log("Proof:", proof);
    console.log("Leaf:", leafHex);

    // Compare roots
    const calcRoot = "0x" + tree.getRoot().toString("hex");
    console.log("Calculated root:", calcRoot);
    console.log("On-chain root   :", onChainRoot);

    if (calcRoot.toLowerCase() === onChainRoot.toLowerCase()) {
      console.log("✅ Root matches! Proof is valid.");
      
      // Test on-chain verification
      console.log("Testing on-chain verification...");
      const isValid = await registry.verifyIOC(batchIndex, leafHex, proof);
      console.log(`✅ On-chain verification: ${isValid ? 'VALID' : 'INVALID'}`);
      
    } else {
      console.log("❌ Root mismatch - verification failed.");
    }

  } catch (error) {
    console.error("Error fetching from IPFS:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
