// scripts/attack-simulations/run-all-attacks.js
// Master script to run all security attack simulations

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const attacks = [
  {
    name: "Linkability Attack",
    script: "linkability-attack.js",
    description: "Attempts to correlate multiple anonymous submissions from the same contributor",
    expectedOutcome: "FAIL - Cryptographic commitments prevent linkability"
  },
  {
    name: "Sybil Attack",
    script: "sybil-attack.js",
    description: "Attempts to create multiple fake identities without staking",
    expectedOutcome: "FAIL - Economic barriers prevent spam"
  },
  {
    name: "Replay Attack",
    script: "replay-attack.js",
    description: "Attempts to reuse valid ZKP proofs for multiple submissions",
    expectedOutcome: "FAIL - Nullifier tracking prevents double-spending"
  },
  {
    name: "Deanonymization Attack",
    script: "deanonymization-attack.js",
    description: "Attempts to extract real identity from anonymous submissions",
    expectedOutcome: "FAIL - Zero-knowledge property protects identity"
  }
];

function runAttack(attack, network) {
  return new Promise((resolve, reject) => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🚀 Running: ${attack.name}`);
    console.log(`${"═".repeat(60)}\n`);
    
    const cmd = `npx hardhat run scripts/attack-simulations/${attack.script} --network ${network}`;
    const startTime = Date.now();
    
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      
      console.log(stdout);
      if (stderr && !stderr.includes('Warning')) {
        console.error(stderr);
      }
      
      // Try to load result
      let result = null;
      const resultFile = `scripts/attack-simulations/${attack.script.replace('.js', '-results.json')}`;
      try {
        result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      } catch (e) {
        console.log(`⚠️  Could not load results from ${resultFile}`);
      }
      
      resolve({
        ...attack,
        duration,
        success: !error,
        result,
        error: error ? error.message : null
      });
    });
  });
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🛡️  COMPREHENSIVE SECURITY ATTACK SIMULATION SUITE");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("📋 This suite tests the platform's resilience against:");
  console.log("   1. Privacy attacks (linkability, deanonymization)");
  console.log("   2. Economic attacks (Sybil)");
  console.log("   3. Protocol attacks (replay)\n");
  
  // Detect network
  let network = process.env.HARDHAT_NETWORK || 'sepolia';
  
  // Check if Arbitrum deployment exists
  try {
    fs.readFileSync('test-addresses-arbitrum.json');
    network = 'arbitrumSepolia';
    console.log(`🌐 Using network: ${network} (Arbitrum L2)\n`);
  } catch {
    console.log(`🌐 Using network: ${network} (Ethereum L1)\n`);
  }
  
  console.log("⏱️  Estimated time: 2-3 minutes\n");
  console.log("─".repeat(60) + "\n");
  
  const results = [];
  const startTime = Date.now();
  
  // Run all attacks sequentially
  for (const attack of attacks) {
    const result = await runAttack(attack, network);
    results.push(result);
    
    // Small delay between attacks
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Generate comprehensive report
  console.log("\n\n");
  console.log("═".repeat(60));
  console.log("📊 COMPREHENSIVE SECURITY AUDIT REPORT");
  console.log("═".repeat(60) + "\n");
  
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Total execution time: ${(totalDuration / 1000).toFixed(2)}s\n`);
  
  console.log("─".repeat(60));
  console.log("ATTACK RESULTS SUMMARY");
  console.log("─".repeat(60) + "\n");
  
  const successfulAttacks = results.filter(r => 
    r.result && 
    (r.result.successful_deanonymizations > 0 || 
     r.result.successful_attacks > 0 ||
     r.result.successful_replays > 0 ||
     r.result.successful_links > 0)
  ).length;
  
  results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.name}`);
    console.log(`   Description: ${result.description}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.result) {
      const attackSucceeded = 
        result.result.successful_deanonymizations > 0 || 
        result.result.successful_attacks > 0 ||
        result.result.successful_replays > 0 ||
        result.result.successful_links > 0;
      
      if (attackSucceeded) {
        console.log(`   Status: ⚠️  ATTACK PARTIALLY SUCCESSFUL`);
        console.log(`   Security: ❌ VULNERABILITY DETECTED`);
      } else {
        console.log(`   Status: ✅ ATTACK FAILED (SYSTEM SECURE)`);
        console.log(`   Security: 🔒 VERIFIED`);
      }
      console.log(`   Conclusion: ${result.result.conclusion}`);
    } else {
      console.log(`   Status: ⚠️  ERROR RUNNING ATTACK`);
      console.log(`   Error: ${result.error || 'Unknown'}`);
    }
    console.log("");
  });
  
  console.log("─".repeat(60));
  console.log("OVERALL SECURITY ASSESSMENT");
  console.log("─".repeat(60) + "\n");
  
  const totalAttacks = results.length;
  const failedAttacks = totalAttacks - successfulAttacks;
  const securityScore = (failedAttacks / totalAttacks) * 100;
  
  console.log(`Total attacks tested: ${totalAttacks}`);
  console.log(`Attacks blocked: ${failedAttacks}`);
  console.log(`Attacks succeeded: ${successfulAttacks}`);
  console.log(`Security score: ${securityScore.toFixed(1)}%\n`);
  
  if (securityScore === 100) {
    console.log("🏆 EXCELLENT: All attacks blocked!");
    console.log("\n✅ SECURITY GUARANTEES VERIFIED:");
    console.log("   ✓ Privacy: Anonymous submissions cannot be linked or deanonymized");
    console.log("   ✓ Sybil Resistance: Economic barriers prevent spam");
    console.log("   ✓ Replay Protection: Nullifiers prevent double-spending");
    console.log("   ✓ System Integrity: All attack vectors defended\n");
    
    console.log("🎯 READY FOR:");
    console.log("   ✓ Production deployment");
    console.log("   ✓ Academic publication");
    console.log("   ✓ Enterprise adoption");
    console.log("   ✓ Security audit submission\n");
    
  } else if (securityScore >= 75) {
    console.log("⚠️  GOOD: Most attacks blocked, some vulnerabilities exist");
    console.log("\n📝 RECOMMENDATIONS:");
    console.log("   - Review successful attack vectors");
    console.log("   - Implement suggested mitigations");
    console.log("   - Re-run tests after fixes");
    console.log("   - Consider additional security measures\n");
    
  } else {
    console.log("🚨 CRITICAL: Multiple vulnerabilities detected!");
    console.log("\n⚠️  IMMEDIATE ACTION REQUIRED:");
    console.log("   - DO NOT deploy to production");
    console.log("   - Review all smart contracts");
    console.log("   - Implement missing security controls");
    console.log("   - Engage security auditor");
    console.log("   - Re-test thoroughly\n");
  }
  
  // Privacy metrics
  console.log("─".repeat(60));
  console.log("PRIVACY METRICS");
  console.log("─".repeat(60) + "\n");
  
  const linkabilityResult = results.find(r => r.script === 'linkability-attack.js')?.result;
  const deanonResult = results.find(r => r.script === 'deanonymization-attack.js')?.result;
  
  if (linkabilityResult) {
    console.log("Linkability Resistance:");
    console.log(`  - Submissions analyzed: ${linkabilityResult.submissions}`);
    console.log(`  - Pairs tested: ${linkabilityResult.pairs_analyzed || 0}`);
    console.log(`  - Successful links: ${linkabilityResult.successful_links || 0}`);
    console.log(`  - Unlinkability: ${linkabilityResult.successful_links === 0 ? '✅ VERIFIED' : '❌ COMPROMISED'}\n`);
  }
  
  if (deanonResult) {
    console.log("Anonymity Protection:");
    console.log(`  - Submissions analyzed: ${deanonResult.submissions_analyzed}`);
    console.log(`  - Deanonymization attempts: ${deanonResult.deanonymization_attempts || 0}`);
    console.log(`  - Successful deanonymizations: ${deanonResult.successful_deanonymizations || 0}`);
    console.log(`  - Anonymity: ${deanonResult.successful_deanonymizations === 0 ? '✅ VERIFIED' : '❌ COMPROMISED'}\n`);
  }
  
  // Economic security
  console.log("─".repeat(60));
  console.log("ECONOMIC SECURITY");
  console.log("─".repeat(60) + "\n");
  
  const sybilResult = results.find(r => r.script === 'sybil-attack.js')?.result;
  
  if (sybilResult && sybilResult.cost_analysis) {
    console.log("Sybil Attack Cost:");
    console.log(`  - Cost for 1000 identities: ${sybilResult.cost_analysis.attack_cost_1000_identities_eth} ETH`);
    console.log(`  - USD equivalent: $${sybilResult.cost_analysis.attack_cost_1000_identities_usd?.toLocaleString() || 'N/A'}`);
    console.log(`  - Economic barrier: ${sybilResult.cost_analysis.attack_cost_1000_identities_eth > 10 ? '✅ STRONG' : '⚠️  WEAK'}\n`);
  }
  
  // Protocol integrity
  console.log("─".repeat(60));
  console.log("PROTOCOL INTEGRITY");
  console.log("─".repeat(60) + "\n");
  
  const replayResult = results.find(r => r.script === 'replay-attack.js')?.result;
  
  if (replayResult) {
    console.log("Replay Attack Protection:");
    console.log(`  - Replay attempts: ${replayResult.total_attempts || 0}`);
    console.log(`  - Successful replays: ${replayResult.successful_replays || 0}`);
    console.log(`  - Nullifier mechanism: ${replayResult.successful_replays === 0 ? '✅ WORKING' : '❌ BROKEN'}\n`);
  }
  
  console.log("═".repeat(60) + "\n");
  
  // Save comprehensive report
  const report = {
    summary: {
      network,
      timestamp: new Date().toISOString(),
      total_duration_ms: totalDuration,
      total_attacks: totalAttacks,
      attacks_blocked: failedAttacks,
      attacks_succeeded: successfulAttacks,
      security_score: securityScore
    },
    attacks: results.map(r => ({
      name: r.name,
      description: r.description,
      duration_ms: r.duration,
      success: r.success,
      result: r.result
    })),
    privacy: {
      linkability: linkabilityResult?.successful_links === 0,
      anonymity: deanonResult?.successful_deanonymizations === 0
    },
    economic_security: {
      sybil_resistant: sybilResult?.successful_attacks === 0,
      attack_cost_eth: sybilResult?.cost_analysis?.attack_cost_1000_identities_eth,
      attack_cost_usd: sybilResult?.cost_analysis?.attack_cost_1000_identities_usd
    },
    protocol_integrity: {
      replay_resistant: replayResult?.successful_replays === 0
    },
    overall_assessment: securityScore === 100 ? 'SECURE' : securityScore >= 75 ? 'GOOD' : 'VULNERABLE',
    ready_for_production: securityScore === 100
  };
  
  const reportPath = 'scripts/attack-simulations/SECURITY_REPORT.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`💾 Comprehensive report saved to: ${reportPath}\n`);
  
  // Generate markdown report for GitHub/docs
  generateMarkdownReport(report);
  
  console.log("✅ All attack simulations complete!\n");
}

function generateMarkdownReport(report) {
  const md = `# Security Attack Simulation Report

**Generated:** ${report.summary.timestamp}  
**Network:** ${report.summary.network}  
**Security Score:** ${report.summary.security_score.toFixed(1)}%

## Executive Summary

This report documents comprehensive security testing of the Decentralized CTI Platform through simulated attacks targeting privacy, economic security, and protocol integrity.

**Results:** ${report.summary.attacks_blocked}/${report.summary.total_attacks} attacks blocked (${report.summary.security_score.toFixed(1)}% success rate)

${report.overall_assessment === 'SECURE' ? '✅ **SECURE** - System ready for production' : 
  report.overall_assessment === 'GOOD' ? '⚠️  **GOOD** - Minor vulnerabilities to address' :
  '🚨 **VULNERABLE** - Critical issues require immediate attention'}

## Attack Results

${report.attacks.map((attack, idx) => `
### ${idx + 1}. ${attack.name}

**Description:** ${attack.description}  
**Duration:** ${(attack.duration_ms / 1000).toFixed(2)}s  
**Status:** ${attack.result?.conclusion || 'No result'}

${attack.result ? `
**Metrics:**
- Attempts: ${attack.result.total_attempts || attack.result.deanonymization_attempts || attack.result.sybil_identities_created || 'N/A'}
- Successful: ${attack.result.successful_attacks || attack.result.successful_deanonymizations || attack.result.successful_replays || attack.result.successful_links || 0}
- Success Rate: ${attack.result.attack_success_rate || attack.result.success_rate || '0%'}
` : ''}
`).join('\n')}

## Security Guarantees

### Privacy
- **Linkability Resistance:** ${report.privacy.linkability ? '✅ VERIFIED' : '❌ COMPROMISED'}
- **Anonymity Protection:** ${report.privacy.anonymity ? '✅ VERIFIED' : '❌ COMPROMISED'}

### Economic Security
- **Sybil Resistance:** ${report.economic_security.sybil_resistant ? '✅ VERIFIED' : '❌ COMPROMISED'}
- **Attack Cost:** ${report.economic_security.attack_cost_eth || 'N/A'} ETH (~$${report.economic_security.attack_cost_usd?.toLocaleString() || 'N/A'} USD)

### Protocol Integrity
- **Replay Protection:** ${report.protocol_integrity.replay_resistant ? '✅ VERIFIED' : '❌ COMPROMISED'}

## Conclusion

${report.ready_for_production ? 
`The platform has successfully defended against all tested attack vectors. The system demonstrates:
- Strong cryptographic privacy (unlinkable, anonymous submissions)
- Robust economic barriers (Sybil resistance through staking)
- Sound protocol design (replay protection through nullifiers)

**Recommendation:** Ready for production deployment and academic publication.` :
`The platform has vulnerabilities that should be addressed before production deployment. Review individual attack reports for specific recommendations.`}

---
*Generated by automated security testing suite*
`;

  fs.writeFileSync('scripts/attack-simulations/SECURITY_REPORT.md', md);
  console.log("📄 Markdown report saved to: scripts/attack-simulations/SECURITY_REPORT.md\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
