// scripts/addBatch.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { create } = require("ipfs-http-client");

async function main() {
  // Load address
  const { IOCRegistryMerkle } = JSON.parse(fs.readFileSync("deployedAddress.json"));

  const registry = await hre.ethers.getContractAt("IOCRegistryMerkle", IOCRegistryMerkle);

  // Example dataset
  const iocs = ["8.8.8.8", "malicious.com", "abcdef1234567890hash"];
  console.log("IOC dataset:", iocs);

  // Build Merkle tree
  const leaves = iocs.map((x) => keccak256(x));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();
  console.log("Merkle Root:", root);

  // Upload to IPFS
  const ipfs = create({ url: "http://192.168.1.3:5001" });
  const { cid } = await ipfs.add(JSON.stringify(iocs));

  // Submit batch
  const tx = await registry.addBatch(cid.toString(), root);
  await tx.wait();
  console.log(`Batch submitted! CID=${cid.toString()} Root=${root}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
