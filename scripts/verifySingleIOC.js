// scripts/verifySingleIOC.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { create } = require("ipfs-http-client");

async function main() {
  // load deployed address
  const { IOCRegistryMerkle } = JSON.parse(
    fs.readFileSync("deployedAddress.json", "utf8")
  );

  // connect contract
  const registry = await hre.ethers.getContractAt(
    "IOCRegistryMerkle",
    IOCRegistryMerkle
  );

  // choose batch index to verify
  const batchIndex = Number(process.argv[2] ?? 0); // default 0; pass index as arg
  const batch = await registry.getBatch(batchIndex);
  const cid = batch[0];
  const onChainRoot = batch[1];
  console.log(
    "Batch",
    batchIndex,
    "CID:",
    cid,
    "On-chain root:",
    onChainRoot
  );

  // connect to IPFS (remote node)
  const ipfs = create({ url: "http://192.168.1.3:5001" });

  // fetch dataset from IPFS (collect raw chunks, decode to string)
  let chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const text = buffer.toString().trim();

  console.log("Raw decoded IPFS text:", text);

  const dataset = JSON.parse(text);
  console.log("Dataset:", dataset);

  // build Merkle tree (same params as addBatch.js)
  const leaves = dataset.map((x) => keccak256(x));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  // IOC to verify (second CLI arg, else first element)
  const iocToVerify = process.argv[3] ?? dataset[0];
  console.log("Verifying IOC:", iocToVerify);

  const leafBuf = keccak256(iocToVerify);
  const leafHex = "0x" + leafBuf.toString("hex");

  const proof = tree.getHexProof(leafBuf);

  console.log("Proof:", proof);
  console.log("Leaf:", leafHex);

  // now we can compare Merkle root
  const calcRoot = "0x" + tree.getRoot().toString("hex");
  console.log("Calculated root:", calcRoot);
  console.log("On-chain root   :", onChainRoot);

  if (calcRoot.toLowerCase() === onChainRoot.toLowerCase()) {
    console.log("Root matches! Proof is valid.");
  } else {
    console.log("Root mismatch.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
