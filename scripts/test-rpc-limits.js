/**
 * Test RPC Limits - Determine actual eth_getLogs limits for your RPC providers
 * 
 * Tests different chunk sizes to find the maximum allowed block range.
 */

const { ethers } = require('ethers');
require('dotenv').config();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
const ARBITRUM_RPC = process.env.ARBITRUM_SEPOLIA_RPC_URL;

const REGISTRY_ABI = [
  'event BatchSubmitted(uint256 indexed batchIndex, address indexed submitter, string ipfsCid, bytes32 merkleRoot)'
];

async function testChunkSize(provider, networkName, registryAddress, chunkSize) {
  try {
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - chunkSize;
    
    console.log(`   Testing ${chunkSize} blocks (${startBlock} → ${currentBlock})...`);
    
    const filter = registry.filters.BatchSubmitted();
    const events = await registry.queryFilter(filter, startBlock, currentBlock);
    
    console.log(`   ✅ SUCCESS: ${chunkSize} blocks work! Found ${events.length} events\n`);
    return true;
  } catch (error) {
    if (error.message.includes('block range') || error.message.includes('10 block')) {
      console.log(`   ❌ FAILED: ${chunkSize} blocks exceed limit`);
      console.log(`   Error: ${error.message.split('\n')[0]}\n`);
      return false;
    } else {
      console.log(`   ⚠️  Other error: ${error.message}\n`);
      return false;
    }
  }
}

async function findMaxChunkSize(provider, networkName, registryAddress) {
  console.log(`\n🔍 Testing ${networkName}...`);
  console.log(`Registry: ${registryAddress}`);
  
  const testSizes = [10, 50, 100, 500, 1000, 5000, 10000];
  let maxWorking = 0;
  
  for (const size of testSizes) {
    const works = await testChunkSize(provider, networkName, registryAddress, size);
    if (works) {
      maxWorking = size;
    } else {
      break; // Stop at first failure
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Result: Maximum chunk size for ${networkName} = ${maxWorking} blocks`);
  return maxWorking;
}

async function main() {
  console.log('🚀 RPC Limit Tester\n');
  console.log('This will test different eth_getLogs block ranges to find the maximum allowed.');
  console.log('This helps determine optimal CHUNK_SIZE for Analytics queries.\n');
  
  // Load contract addresses
  const sepoliaAddresses = require('../test-addresses.json');
  const arbitrumAddresses = require('../test-addresses-arbitrum.json');
  
  // Test Sepolia (Alchemy)
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const sepoliaMax = await findMaxChunkSize(
    sepoliaProvider,
    'Ethereum Sepolia (Alchemy)',
    sepoliaAddresses.PrivacyPreservingRegistry
  );
  
  // Test Arbitrum (Public RPC)
  const arbitrumProvider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
  const arbitrumMax = await findMaxChunkSize(
    arbitrumProvider,
    'Arbitrum Sepolia (Public)',
    arbitrumAddresses.PrivacyPreservingRegistry
  );
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Sepolia (Alchemy):        ${sepoliaMax} blocks max`);
  console.log(`Arbitrum (Public RPC):    ${arbitrumMax} blocks max`);
  console.log('\n💡 Recommendation:');
  console.log(`   Use CHUNK_SIZE = ${Math.min(sepoliaMax, arbitrumMax)} for cross-network compatibility`);
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
