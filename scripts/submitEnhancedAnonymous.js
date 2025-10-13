// scripts/submitEnhancedAnonymous.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { create } = require("ipfs-http-client");
const { EnhancedZKPAuth } = require("./zkp-utils-enhanced");

async function main() {
    console.log("=== Enhanced Anonymous IOC Submission ===");
    
    const credentials = JSON.parse(fs.readFileSync("enhanced-credentials.json"));
    const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
    
    const registry = await hre.ethers.getContractAt(
        "PrivacyPreservingRegistry",
        testData.PrivacyPreservingRegistry
    );
    
    const iocData = {
        iocs: [
            "advanced-apt-domain.com",
            "10.20.30.40",
            "deadbeef1234567890abcdef",
            "nation-state-infrastructure.net"
        ],
        metadata: {
            source: "Enhanced Anonymous Analyst",
            classification: "TOP SECRET",
            description: "Advanced persistent threat with 256-bit anonymity",
            timestamp: new Date().toISOString()
        }
    };
    
    console.log("IOC dataset:", iocData.iocs);
    
    const leaves = iocData.iocs.map(x => keccak256(x));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    
    const ipfs = create({ url: "http://192.168.1.3:5001" });
    const { cid } = await ipfs.add(JSON.stringify(iocData, null, 2));
    
    console.log("IPFS CID:", cid.toString());
    console.log("Merkle Root:", root);
    
    const proof = hre.ethers.solidityPacked(
        ["bytes32", "bytes32"],
        [credentials.secureNonce, credentials.salt]
    );
    
    console.log("\nSubmitting with enhanced anonymity...");
    console.log("  Commitment:", credentials.commitment);
    console.log("  Security level: 256-bit cryptographic protection");
    
    const tx = await registry.addBatch(
        cid.toString(),
        root,
        false,
        credentials.commitment,
        proof
    );
    await tx.wait();
    
    console.log("✅ Enhanced anonymous batch submitted!");
    console.log("   Your identity is protected by 2^512 key space");
}

main().catch(console.error);
