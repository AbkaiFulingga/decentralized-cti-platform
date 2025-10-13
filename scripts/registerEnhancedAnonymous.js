// scripts/registerEnhancedAnonymous.js
const hre = require("hardhat");
const fs = require("fs");
const { EnhancedZKPAuth } = require("./zkp-utils-enhanced");

async function main() {
    console.log("=== Enhanced Anonymous Contributor Registration ===");
    
    const testData = JSON.parse(fs.readFileSync("test-addresses.json"));
    const registry = await hre.ethers.getContractAt(
        "PrivacyPreservingRegistry", 
        testData.PrivacyPreservingRegistry
    );
    
    const [contributor] = await hre.ethers.getSigners();
    
    console.log("\n1. Generating enhanced cryptographic credentials...");
    const secureNonce = EnhancedZKPAuth.generateSecureNonce();
    const salt = EnhancedZKPAuth.generateSalt();
    
    console.log("Secure nonce (256-bit):", secureNonce);
    console.log("Salt (256-bit):", salt);
    
    const commitment = EnhancedZKPAuth.generateCommitment(
        contributor.address,
        secureNonce,
        salt
    );
    
    const { proof, nullifier } = EnhancedZKPAuth.generateProof(
        contributor.address,
        secureNonce,
        salt,
        commitment
    );
    
    console.log("\nGenerated credentials:");
    console.log("  Commitment:", commitment);
    console.log("  Nullifier:", nullifier);
    console.log("  Proof length:", proof.length, "bytes");
    
    console.log("\n2. Security Analysis:");
    const metrics = EnhancedZKPAuth.getSecurityMetrics();
    console.log("  Nonce space:", metrics.nonceSpace);
    console.log("  Salt space:", metrics.saltSpace);
    console.log("  Total key space:", metrics.totalKeySpace);
    console.log("  Brute-force resistance:", metrics.bruteForceTime);
    console.log("  Security level:", metrics.securityLevel);
    
    console.log("\n3. Off-chain proof verification...");
    const isValid = EnhancedZKPAuth.verifyProof(
        contributor.address,
        secureNonce,
        salt,
        commitment
    );
    console.log("  Proof valid:", isValid ? "✅ YES" : "❌ NO");
    
    if (!isValid) {
        console.log("❌ Proof verification failed!");
        return;
    }
    
    console.log("\n4. Registering on-chain...");
    const stakeAmount = hre.ethers.parseEther("0.05");
    
    const tx = await registry.registerAnonymousContributorEnhanced(
        commitment,
        nullifier,
        proof,
        { value: stakeAmount }
    );
    await tx.wait();
    
    console.log("✅ Enhanced anonymous contributor registered!");
    
    const credentials = {
        walletAddress: contributor.address,
        commitment: commitment,
        nullifier: nullifier,
        secureNonce: secureNonce,
        salt: salt,
        registeredAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
        "enhanced-credentials.json",
        JSON.stringify(credentials, null, 2)
    );
    console.log("\n📄 Credentials saved to enhanced-credentials.json");
    console.log("⚠️  Keep this file secure - it contains your secret keys!");
}

main().catch(console.error);
