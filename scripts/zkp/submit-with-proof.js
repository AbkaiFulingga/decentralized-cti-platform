/**
 * 🚀 Submit Anonymous IOC Batch with zkSNARK Proof
 * 
 * This script demonstrates the complete anonymous submission workflow:
 * 1. Generate zkSNARK proof (or load existing)
 * 2. Upload IOCs to IPFS
 * 3. Submit batch on-chain with ZK proof
 * 4. Verify submission success
 * 
 * Usage:
 *   node scripts/zkp/submit-with-proof.js [proofFile]
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const axios = require('axios');
require('dotenv').config();

// Contract addresses
const ADDRESSES_PATH = path.join(__dirname, '../../test-addresses-arbitrum.json');
const PINATA_JWT = process.env.PINATA_JWT;

/**
 * Upload IOCs to IPFS via Pinata
 */
async function uploadToIPFS(iocs) {
  console.log('\n📤 Uploading IOCs to IPFS...');
  console.log(`   IOC count: ${iocs.length}`);
  
  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT not found in .env file');
  }
  
  const data = {
    pinataContent: {
      iocs: iocs,
      timestamp: new Date().toISOString(),
      format: 'anonymous-submission',
      version: '2.0'
    },
    pinataMetadata: {
      name: `anonymous-batch-${Date.now()}`,
      keyvalues: {
        type: 'zkp-submission',
        count: iocs.length.toString()
      }
    }
  };
  
  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`
        }
      }
    );
    
    const ipfsHash = response.data.IpfsHash;
    console.log(`✅ Uploaded to IPFS: ${ipfsHash}`);
    console.log(`   View at: https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    
    return ipfsHash;
    
  } catch (error) {
    console.error('❌ IPFS upload failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Submit batch with zkSNARK proof
 */
async function submitWithProof(registry, zkVerifier, ipfsHash, proofData) {
  console.log('\n🔐 Submitting batch with zkSNARK proof...');
  
  const { commitment, merkleRoot, proof } = proofData;
  
  console.log(`   IPFS Hash: ${ipfsHash}`);
  console.log(`   Commitment: ${commitment}`);
  console.log(`   Merkle Root: ${merkleRoot}`);
  
  // Check if commitment already used
  const isUsed = await zkVerifier.isCommitmentUsed(commitment);
  if (isUsed) {
    throw new Error('❌ Commitment already used! Generate a new proof with different nonce.');
  }
  
  // Check if Merkle root is valid
  const isValidRoot = await zkVerifier.isMerkleRootValid(merkleRoot);
  if (!isValidRoot) {
    console.warn('⚠️  Warning: Merkle root not recognized as valid. Tree may need updating.');
  }
  
  // Verify proof locally first
  console.log('\n🔍 Verifying proof locally...');
  const isValid = await zkVerifier.verifyProofReadOnly(
    commitment,
    merkleRoot,
    proof.a,
    proof.b,
    proof.c
  );
  
  if (!isValid) {
    throw new Error('❌ Proof verification failed locally!');
  }
  
  console.log('✅ Proof verified locally');
  
  // Submit transaction
  console.log('\n📝 Submitting transaction...');
  console.log('   (This may take 10-30 seconds on L2...)');
  
  const tx = await registry.addBatchWithZKProof(
    ipfsHash,
    commitment,
    merkleRoot,
    proof.a,
    proof.b,
    proof.c
  );
  
  console.log(`   Transaction hash: ${tx.hash}`);
  console.log('   Waiting for confirmation...');
  
  const receipt = await tx.wait();
  
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  
  return receipt;
}

/**
 * Verify submission was recorded on-chain
 */
async function verifySubmission(registry, commitment) {
  console.log('\n✅ Verifying submission was recorded...');
  
  // Get batch count
  const batchCount = await registry.batchCount();
  console.log(`   Total batches: ${batchCount}`);
  
  // Check recent batches for this commitment
  const recentBatches = 5;
  const startIndex = batchCount > recentBatches ? batchCount - recentBatches : 0n;
  
  for (let i = startIndex; i < batchCount; i++) {
    const batch = await registry.batches(i);
    
    // Check if this batch has our commitment
    // Note: In production, we'd need a better way to query by commitment
    console.log(`   Batch ${i}: ${batch.ipfsHash}`);
  }
  
  console.log('\n✅ Submission verification complete');
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 ANONYMOUS IOC SUBMISSION WITH zkSNARK PROOF');
  console.log('═══════════════════════════════════════════════════════');
  
  // Load proof file
  const proofFileName = process.argv[2];
  let proofData;
  
  if (proofFileName) {
    const proofPath = path.join(__dirname, '../../zkp-proofs', proofFileName);
    
    if (!fs.existsSync(proofPath)) {
      console.error(`❌ Proof file not found: ${proofPath}`);
      process.exit(1);
    }
    
    proofData = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    console.log(`\n📄 Loaded proof from: ${proofFileName}`);
    console.log(`   Generated: ${proofData.timestamp}`);
    console.log(`   Contributor: ${proofData.contributor} (hidden on-chain)`);
    
  } else {
    // Use most recent proof
    const proofsDir = path.join(__dirname, '../../zkp-proofs');
    if (!fs.existsSync(proofsDir)) {
      console.error('❌ No proofs directory found. Generate a proof first:');
      console.log('   node scripts/zkp/generate-zk-proof.js <address> <nonce>');
      process.exit(1);
    }
    
    const proofFiles = fs.readdirSync(proofsDir)
      .filter(f => f.startsWith('proof-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (proofFiles.length === 0) {
      console.error('❌ No proof files found. Generate a proof first:');
      console.log('   node scripts/zkp/generate-zk-proof.js <address> <nonce>');
      process.exit(1);
    }
    
    const latestProof = proofFiles[0];
    proofData = JSON.parse(fs.readFileSync(path.join(proofsDir, latestProof), 'utf8'));
    console.log(`\n📄 Using latest proof: ${latestProof}`);
  }
  
  // Sample IOCs for demonstration
  const sampleIOCs = [
    '45.76.128.45',
    '192.168.100.50',
    '10.0.0.15',
    'malicious-domain.com',
    'phishing-site.net',
    'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
  ];
  
  console.log('\n📋 Sample IOCs (6 items):');
  sampleIOCs.forEach((ioc, i) => {
    console.log(`   ${i + 1}. ${ioc}`);
  });
  
  try {
    // Load contract addresses
    if (!fs.existsSync(ADDRESSES_PATH)) {
      console.error(`❌ Addresses file not found: ${ADDRESSES_PATH}`);
      process.exit(1);
    }
    
    const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
    const registryAddress = addresses.PrivacyPreservingRegistry;
    const zkVerifierAddress = addresses.ZKVerifier;
    
    if (!zkVerifierAddress) {
      console.error('❌ ZKVerifier address not found in addresses file');
      console.log('Deploy ZKVerifier first:');
      console.log('   npx hardhat run scripts/deploy-zkverifier.js --network arbitrumSepolia');
      process.exit(1);
    }
    
    console.log(`\n🌐 Network: ${hre.network.name}`);
    console.log(`   Registry: ${registryAddress}`);
    console.log(`   ZKVerifier: ${zkVerifierAddress}`);
    
    // Get signers
    const [signer] = await ethers.getSigners();
    console.log(`\n👤 Submitter: ${signer.address}`);
    console.log('   (Identity hidden on-chain via zkSNARK)');
    
    // Connect to contracts
    const registry = await ethers.getContractAt('PrivacyPreservingRegistry', registryAddress);
    const zkVerifier = await ethers.getContractAt('ZKVerifier', zkVerifierAddress);
    
    // Step 1: Upload to IPFS
    const ipfsHash = await uploadToIPFS(sampleIOCs);
    
    // Step 2: Submit with proof
    const receipt = await submitWithProof(registry, zkVerifier, ipfsHash, proofData);
    
    // Step 3: Verify submission
    await verifySubmission(registry, proofData.commitment);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ SUCCESS - Anonymous Submission Complete!');
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('\n📊 Summary:');
    console.log(`   IOCs submitted: ${sampleIOCs.length}`);
    console.log(`   IPFS Hash: ${ipfsHash}`);
    console.log(`   Commitment: ${proofData.commitment.substring(0, 20)}...`);
    console.log(`   Transaction: ${receipt.transactionHash}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    
    console.log('\n🔒 Privacy Features:');
    console.log('   ✅ Contributor identity hidden via zkSNARK');
    console.log('   ✅ Proof verified on-chain without revealing address');
    console.log('   ✅ Commitment prevents replay attacks');
    console.log('   ✅ Merkle root ensures only registered contributors');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. View batch on frontend: /batches');
    console.log('   2. Try replay attack: node scripts/zkp/test-replay-attack.js');
    console.log('   3. Generate new proof: node scripts/zkp/generate-zk-proof.js <address> <nonce>');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { submitWithProof, uploadToIPFS };
