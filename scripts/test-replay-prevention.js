/**
 * Test replay attack prevention in zkSNARK system
 * 
 * This script tests:
 * 1. Submitting the same proof twice (should fail)
 * 2. Submitting with tampered proof (should fail)
 * 3. Verifying commitment reuse is blocked
 */

const fs = require('fs');

async function testReplayAttack(registry, proof, publicSignals, submissionFee) {
    console.log("\n🛡️  Test 1: Replay Attack Prevention");
    console.log("   Attempting to resubmit the same proof...");

    try {
        const tx = await registry.addBatchWithZKProof(
            "QmReplayTest",
            "0x" + "0".repeat(64),
            proof.pA,
            proof.pB,
            proof.pC,
            publicSignals.map(s => BigInt(s)),
            { value: submissionFee }
        );
        await tx.wait();
        console.log("   ❌ FAIL: Replay attack succeeded (this is a security issue!)");
        return false;
    } catch (error) {
        if (error.message.includes("CommitmentAlreadyUsed") || 
            error.message.includes("revert")) {
            console.log("   ✅ PASS: Replay attack blocked");
            return true;
        } else {
            console.log(`   ⚠️  Unknown error: ${error.message}`);
            return false;
        }
    }
}

async function testInvalidProof(registry, proof, publicSignals, submissionFee) {
    console.log("\n🛡️  Test 2: Invalid Proof Rejection");
    console.log("   Attempting to submit tampered proof...");

    // Tamper with proof by modifying one coordinate
    const tamperedProof = {
        pA: [proof.pA[0], BigInt(proof.pA[1]) + 1n],  // Change second coordinate
        pB: proof.pB,
        pC: proof.pC
    };

    try {
        const tx = await registry.addBatchWithZKProof(
            "QmTamperedTest",
            "0x" + "0".repeat(64),
            tamperedProof.pA,
            tamperedProof.pB,
            tamperedProof.pC,
            publicSignals.map(s => BigInt(s)),
            { value: submissionFee }
        );
        await tx.wait();
        console.log("   ❌ FAIL: Invalid proof accepted (this is a security issue!)");
        return false;
    } catch (error) {
        if (error.message.includes("InvalidProof") || 
            error.message.includes("verification failed") ||
            error.message.includes("revert")) {
            console.log("   ✅ PASS: Invalid proof rejected");
            return true;
        } else {
            console.log(`   ⚠️  Unknown error: ${error.message}`);
            return false;
        }
    }
}

async function testCommitmentReuse(registry, proof, publicSignals, submissionFee) {
    console.log("\n🛡️  Test 3: Commitment Reuse Prevention");
    console.log("   Attempting to use same commitment with different data...");

    try {
        // Try to submit different IOCs with same commitment
        const tx = await registry.addBatchWithZKProof(
            "QmDifferentCID123",
            "0x" + "1".repeat(64),  // Different merkle root
            proof.pA,
            proof.pB,
            proof.pC,
            publicSignals.map(s => BigInt(s)),
            { value: submissionFee }
        );
        await tx.wait();
        console.log("   ❌ FAIL: Commitment reuse succeeded");
        return false;
    } catch (error) {
        if (error.message.includes("CommitmentAlreadyUsed") || 
            error.message.includes("revert")) {
            console.log("   ✅ PASS: Commitment reuse blocked");
            return true;
        } else {
            console.log(`   ⚠️  Unknown error: ${error.message}`);
            return false;
        }
    }
}

async function main() {
    console.log("=" .repeat(60));
    console.log("🧪 Replay Attack Prevention Test Suite");
    console.log("=" .repeat(60));

    // Load previous test results
    if (!fs.existsSync('zk-test-results.json')) {
        console.error("\n❌ No previous test found!");
        console.log("Run: npx hardhat run scripts/test-zk-submission.js --network arbitrumSepolia");
        process.exit(1);
    }

    const testResults = JSON.parse(fs.readFileSync('zk-test-results.json', 'utf8'));
    console.log(`\n📋 Using proof from batch ${testResults.batchIndex}`);
    console.log(`   Commitment: ${testResults.commitment}`);

    // Load deployment addresses
    const addresses = JSON.parse(fs.readFileSync('deployment-complete-zk.json', 'utf8'));
    const registryAddress = addresses.contracts.privacyPreservingRegistry;

    console.log(`   Registry: ${registryAddress}\n`);

    // Get contract instance
    const Registry = await ethers.getContractFactory("PrivacyPreservingRegistry");
    const registry = Registry.attach(registryAddress);

    // Load proof from circuits directory
    const proof = JSON.parse(fs.readFileSync('circuits/proof.json', 'utf8'));
    const publicSignals = JSON.parse(fs.readFileSync('circuits/public.json', 'utf8'));

    // Format proof
    const formattedProof = {
        pA: [proof.pi_a[0], proof.pi_a[1]],
        pB: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        pC: [proof.pi_c[0], proof.pi_c[1]]
    };

    // Calculate submission fee
    const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
    const submissionFee = (200000n * gasPrice) / 100n;

    // Run tests
    const results = {
        replayAttackBlocked: await testReplayAttack(registry, formattedProof, publicSignals, submissionFee),
        invalidProofRejected: await testInvalidProof(registry, formattedProof, publicSignals, submissionFee),
        commitmentReuseBlocked: await testCommitmentReuse(registry, formattedProof, publicSignals, submissionFee)
    };

    // Summary
    console.log("\n" + "=" .repeat(60));
    console.log("📊 Test Results Summary:");
    console.log("=" .repeat(60));
    console.log(`   Replay Attack Prevention: ${results.replayAttackBlocked ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Invalid Proof Rejection: ${results.invalidProofRejected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Commitment Reuse Prevention: ${results.commitmentReuseBlocked ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r === true);
    
    if (allPassed) {
        console.log("\n🎉 ALL TESTS PASSED - System is secure!");
    } else {
        console.log("\n⚠️  SOME TESTS FAILED - Security vulnerabilities detected!");
    }
    
    console.log("=" .repeat(60) + "\n");

    // Save results
    const securityTestResults = {
        timestamp: new Date().toISOString(),
        network: network.name,
        results,
        allPassed
    };

    fs.writeFileSync('security-test-results.json', JSON.stringify(securityTestResults, null, 2));
    console.log("💾 Security test results saved to security-test-results.json\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test suite failed:", error);
        process.exit(1);
    });
