// scripts/addSTIXBatch.js
const hre = require("hardhat");
const fs = require("fs");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { create } = require("ipfs-http-client");
const { STIXConverter } = require("./stix-utils");
const { EnhancedZKPAuth } = require("./zkp-utils-enhanced");

async function main() {
    console.log("=== STIX 2.1 Batch Submission ===");
    
    const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
    const registry = await hre.ethers.getContractAt(
        "PrivacyPreservingRegistry",
        testData.PrivacyPreservingRegistry
    );

    // Read submission preferences from environment variables
    const useSTIX = process.env.STIX === "true";
    const isPublic = process.env.PUBLIC === "true";

    let iocData;
    let flatIOCs;

    if (useSTIX) {
        console.log("Using STIX 2.1 format...");
        
        // User provides flat IOCs, we convert to STIX
        flatIOCs = [
            "apt-group-infrastructure.com",
            "203.0.113.50",
            "5d41402abc4b2a76b9719d911017c592",
            "nation-state-malware.net",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        ];

        const metadata = {
            source: "Advanced Threat Research Team",
            confidence: "high",
            description: "APT infrastructure indicators discovered through advanced threat hunting",
            tags: ["apt", "nation-state", "infrastructure", "malware"]
        };

        const stixBundle = STIXConverter.convertToSTIX(flatIOCs, metadata);
        
        // Validate STIX bundle
        let validCount = 0;
        stixBundle.objects.forEach(obj => {
            const validation = STIXConverter.validateSTIX(obj);
            if (validation.valid) validCount++;
        });
        console.log(`✅ ${validCount}/${stixBundle.objects.length} STIX objects valid`);

        iocData = {
            format: "STIX-2.1",
            stixBundle: stixBundle,
            flatIOCs: flatIOCs, // Keep flat version for Merkle tree
            metadata: metadata
        };

    } else {
        console.log("Using flat IOC format...");
        
        // Traditional flat IOC submission
        flatIOCs = [
            "traditional-threat.com",
            "198.51.100.100",
            "098f6bcd4621d373cade4e832627b4f6"
        ];

        iocData = {
            format: "FLAT",
            iocs: flatIOCs,
            metadata: {
                source: "Security Researcher",
                description: "Standard flat IOC submission",
                timestamp: new Date().toISOString()
            }
        };
    }

    console.log(`Submission format: ${iocData.format}`);
    console.log(`Privacy mode: ${isPublic ? 'PUBLIC' : 'ANONYMOUS'}`);
    console.log(`IOC count: ${flatIOCs.length}`);

    // Generate Merkle tree from flat IOCs (works for both formats)
    const leaves = flatIOCs.map(x => keccak256(x));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    // Upload to IPFS
    const ipfs = create({ 
        host: '192.168.1.3',
        port: 5001,
        protocol: 'http',
        timeout: 30000
    });
    
    const { cid } = await ipfs.add(JSON.stringify(iocData, null, 2));
    console.log(`IPFS CID: ${cid.toString()}`);
    console.log(`Merkle Root: ${root}`);

    // Handle privacy choice
    const [deployer] = await hre.ethers.getSigners();
    
    if (isPublic) {
        // Check if registered as public contributor
        const contributor = await registry.contributors(deployer.address);
        
        if (!contributor.isActive) {
            console.log("Registering as public contributor...");
            const stakeAmount = hre.ethers.parseEther("0.05");
            await registry.registerContributor({ value: stakeAmount });
            console.log("✅ Registered");
        }

        const tx = await registry.addBatch(
            cid.toString(),
            root,
            true,
            hre.ethers.ZeroHash,
            "0x"
        );
        await tx.wait();
        console.log(`✅ Public ${iocData.format} batch submitted`);

    } else {
        // Anonymous submission with enhanced 256-bit security
        let credentials;
        
        if (fs.existsSync("enhanced-credentials.json")) {
            credentials = JSON.parse(fs.readFileSync("enhanced-credentials.json"));
            console.log("Using existing enhanced credentials");
        } else {
            console.log("Generating new enhanced credentials (256-bit security)...");
            const secureNonce = EnhancedZKPAuth.generateSecureNonce();
            const salt = EnhancedZKPAuth.generateSalt();
            const commitment = EnhancedZKPAuth.generateCommitment(deployer.address, secureNonce, salt);
            const { proof, nullifier } = EnhancedZKPAuth.generateProof(deployer.address, secureNonce, salt, commitment);
            
            // Register first
            const stakeAmount = hre.ethers.parseEther("0.05");
            await registry.registerAnonymousContributorEnhanced(
                commitment,
                nullifier,
                proof,
                { value: stakeAmount }
            );
            
            credentials = { commitment, secureNonce, salt };
            fs.writeFileSync("enhanced-credentials.json", JSON.stringify(credentials, null, 2));
            console.log("✅ Registered with 256-bit cryptographic security");
        }

        const proof = hre.ethers.solidityPacked(
            ["bytes32", "bytes32"],
            [credentials.secureNonce, credentials.salt]
        );

        const tx = await registry.addBatch(
            cid.toString(),
            root,
            false,
            credentials.commitment,
            proof
        );
        await tx.wait();
        console.log(`✅ Anonymous ${iocData.format} batch submitted with 256-bit protection`);
    }

    // Display stats
    const stats = await registry.getPlatformStats();
    console.log("\n=== Platform Statistics ===");
    console.log(`Total batches: ${stats[0]}`);
    console.log(`Accepted: ${stats[1]}`);
    console.log(`Public: ${stats[2]} | Anonymous: ${stats[3]}`);
}

main().catch(console.error);
