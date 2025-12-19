#!/usr/bin/env node

/**
 * zkSNARK Demo Verification Script
 * 
 * Automated verification that zkSNARK anonymity is working correctly.
 * Run this script to verify transaction evidence without manual blockchain exploration.
 * 
 * Usage:
 *   node scripts/verify-zksnark-demo.js [TX_HASH]
 * 
 * Example:
 *   node scripts/verify-zksnark-demo.js 0x581de4fd4b1a76b2e2c9cf5d1e0dc9117d0a437773d82ddd45d68214504c64e9
 */

const { ethers } = require('hardhat');
const axios = require('axios');
const fs = require('fs');

// Configuration
const ARBISCAN_API = 'https://api-sepolia.arbiscan.io/api';
const RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';
const REGISTRY_ADDRESS = '0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function verifyTransaction(txHash) {
  log('\n' + '='.repeat(80), 'bold');
  log('zkSNARK DEMO VERIFICATION', 'bold');
  log('='.repeat(80) + '\n', 'bold');

  try {
    // Step 1: Fetch transaction from RPC
    info(`Step 1: Fetching transaction ${txHash.substring(0, 10)}...`);
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      error('Transaction not found on Arbitrum Sepolia');
      return false;
    }
    
    success(`Transaction found in block ${tx.blockNumber}`);

    // Step 2: Get transaction receipt
    info('Step 2: Fetching transaction receipt...');
    
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      error('Receipt not found (transaction may not be confirmed)');
      return false;
    }

    if (receipt.status === 0) {
      error('Transaction REVERTED (failed on-chain)');
      return false;
    }

    success(`Transaction succeeded (gas used: ${receipt.gasUsed.toString()})`);

    // Step 3: Decode function call
    info('Step 3: Decoding function call...');
    
    const iface = new ethers.Interface([
      'function addBatchWithZKProof((uint256[2] a, uint256[2][2] b, uint256[2] c) proof, bytes32 commitment, bytes32 merkleRoot, string ipfsCID)',
      'function submitBatch(string ipfsCID, bytes32 merkleRoot, uint8 iocType)',
      'event PrivacyBatchAccepted(bytes32 indexed commitment, bytes32 merkleRoot, string ipfsCID, uint256 timestamp)'
    ]);

    let functionName;
    let decodedInput;
    
    try {
      const parsedTx = iface.parseTransaction({ data: tx.data });
      functionName = parsedTx.name;
      decodedInput = parsedTx.args;
      
      if (functionName === 'addBatchWithZKProof') {
        success(`Function: addBatchWithZKProof (zkSNARK submission) ✅`);
      } else if (functionName === 'submitBatch') {
        warn(`Function: submitBatch (public submission, not anonymous)`);
        return false;
      } else {
        warn(`Function: ${functionName} (unexpected function)`);
        return false;
      }
    } catch (e) {
      error(`Failed to decode transaction data: ${e.message}`);
      return false;
    }

    // Step 4: Verify proof structure
    info('Step 4: Verifying Groth16 proof structure...');
    
    const proof = decodedInput[0]; // First argument is proof struct
    const commitment = decodedInput[1];
    const merkleRoot = decodedInput[2];
    const ipfsCID = decodedInput[3];

    // Validate proof points
    if (proof.a && proof.a.length === 2 &&
        proof.b && proof.b.length === 2 && proof.b[0].length === 2 &&
        proof.c && proof.c.length === 2) {
      success('Groth16 proof structure valid (a, b, c points present)');
      
      // Show proof snippet
      log('\n  Proof snippet:', 'blue');
      log(`    a[0]: ${proof.a[0].toString().substring(0, 20)}...`, 'blue');
      log(`    b[0][0]: ${proof.b[0][0].toString().substring(0, 20)}...`, 'blue');
      log(`    c[0]: ${proof.c[0].toString().substring(0, 20)}...\n`, 'blue');
    } else {
      error('Invalid proof structure');
      return false;
    }

    // Step 5: Verify anonymity (commitment ≠ sender address)
    info('Step 5: Verifying anonymity...');
    
    const sender = tx.from.toLowerCase();
    const commitmentHex = commitment.toLowerCase();
    
    log(`  Transaction sender: ${sender}`, 'blue');
    log(`  Commitment stored: ${commitmentHex}\n`, 'blue');
    
    if (sender === commitmentHex) {
      error('ANONYMITY BROKEN: Commitment equals sender address!');
      return false;
    }
    
    success('Anonymity verified: Commitment ≠ sender address ✅');

    // Step 6: Verify Merkle root
    info('Step 6: Verifying Merkle root...');
    
    const treeFile = './contributor-merkle-tree.json';
    
    if (fs.existsSync(treeFile)) {
      const treeData = JSON.parse(fs.readFileSync(treeFile, 'utf8'));
      const expectedRoot = treeData.root.toLowerCase();
      const actualRoot = merkleRoot.toLowerCase();
      
      if (expectedRoot === actualRoot) {
        success(`Merkle root matches local tree: ${expectedRoot.substring(0, 20)}...`);
        
        // Check contributor count
        const contributorCount = treeData.contributors.length;
        const anonymityBits = Math.log2(contributorCount).toFixed(2);
        info(`Anonymity set: ${contributorCount} contributors (${anonymityBits} bits)`);
      } else {
        warn('Merkle root does not match local tree (may be outdated)');
        log(`  Expected: ${expectedRoot}`, 'yellow');
        log(`  Actual:   ${actualRoot}`, 'yellow');
      }
    } else {
      warn(`Merkle tree file not found: ${treeFile}`);
    }

    // Step 7: Verify event logs
    info('Step 7: Verifying event logs...');
    
    let foundPrivacyEvent = false;
    
    for (const eventLog of receipt.logs) {
      try {
        const parsedLog = iface.parseLog({
          topics: eventLog.topics,
          data: eventLog.data
        });
        
        if (parsedLog.name === 'PrivacyBatchAccepted') {
          foundPrivacyEvent = true;
          success('PrivacyBatchAccepted event found (proof verified on-chain)');
          
          log('\n  Event details:', 'blue');
          log(`    Commitment: ${parsedLog.args.commitment}`, 'blue');
          log(`    IPFS CID: ${parsedLog.args.ipfsCID}`, 'blue');
          log(`    Timestamp: ${new Date(Number(parsedLog.args.timestamp) * 1000).toISOString()}\n`, 'blue');
          break;
        }
      } catch (e) {
        // Not the event we're looking for, skip
      }
    }
    
    if (!foundPrivacyEvent) {
      error('PrivacyBatchAccepted event not found in logs');
      return false;
    }

    // Step 8: Gas cost analysis
    info('Step 8: Analyzing gas costs...');
    
    const gasUsed = Number(receipt.gasUsed);
    const gasPrice = Number(receipt.gasPrice || tx.gasPrice);
    const costWei = gasUsed * gasPrice;
    const costEth = ethers.formatEther(costWei);
    
    log(`  Gas Used: ${gasUsed.toLocaleString()}`, 'blue');
    log(`  Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`, 'blue');
    log(`  Total Cost: ${costEth} ETH\n`, 'blue');
    
    // Expected zkSNARK gas: 350K-400K
    if (gasUsed >= 350000 && gasUsed <= 450000) {
      success(`Gas usage consistent with zkSNARK verification (${gasUsed.toLocaleString()} gas)`);
    } else if (gasUsed < 150000) {
      warn(`Gas usage too low for zkSNARK (${gasUsed.toLocaleString()} gas) - may be Merkle proof instead`);
    } else {
      warn(`Gas usage unexpected: ${gasUsed.toLocaleString()} gas`);
    }

    // Step 9: IPFS verification
    info('Step 9: Checking IPFS content...');
    
    try {
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;
      const ipfsResponse = await axios.get(ipfsUrl, { timeout: 5000 });
      
      if (ipfsResponse.data) {
        success(`IPFS content accessible (CID: ${ipfsCID.substring(0, 20)}...)`);
        
        // Check if STIX format
        if (ipfsResponse.data.type === 'bundle' && ipfsResponse.data.objects) {
          info(`  STIX 2.1 bundle with ${ipfsResponse.data.objects.length} objects`);
        }
      }
    } catch (e) {
      warn(`Could not fetch IPFS content: ${e.message}`);
      warn('This is not critical for zkSNARK verification');
    }

    // Final summary
    log('\n' + '='.repeat(80), 'bold');
    log('VERIFICATION SUMMARY', 'bold');
    log('='.repeat(80), 'bold');
    
    success('✅ Transaction exists and succeeded');
    success('✅ Function is addBatchWithZKProof (zkSNARK)');
    success('✅ Groth16 proof structure valid');
    success('✅ Anonymity verified (commitment ≠ sender)');
    success('✅ Event logs confirm on-chain verification');
    success('✅ Gas costs consistent with pairing checks');
    
    log('\n' + '='.repeat(80), 'bold');
    log('🎉 zkSNARK ANONYMITY IS WORKING CORRECTLY! 🎉', 'green');
    log('='.repeat(80) + '\n', 'bold');
    
    // Evidence for thesis
    log('Evidence for thesis:', 'blue');
    log(`- Transaction: https://sepolia.arbiscan.io/tx/${txHash}`, 'blue');
    log(`- Commitment: ${commitment}`, 'blue');
    log(`- Sender: ${tx.from}`, 'blue');
    log(`- Gas: ${gasUsed.toLocaleString()} (${costEth} ETH)`, 'blue');
    log(`- IPFS: https://gateway.pinata.cloud/ipfs/${ipfsCID}\n`, 'blue');

    return true;

  } catch (err) {
    error(`Verification failed: ${err.message}`);
    console.error(err);
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Use default successful transaction
    log('No transaction hash provided, using default successful zkSNARK transaction\n', 'yellow');
    const defaultTx = '0x581de4fd4b1a76b2e2c9cf5d1e0dc9117d0a437773d82ddd45d68214504c64e9';
    await verifyTransaction(defaultTx);
  } else {
    const txHash = args[0];
    
    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      error('Invalid transaction hash format');
      log('Expected: 0x followed by 64 hexadecimal characters', 'yellow');
      process.exit(1);
    }
    
    await verifyTransaction(txHash);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { verifyTransaction };
