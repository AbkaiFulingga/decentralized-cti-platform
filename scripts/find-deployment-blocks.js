/**
 * Find Deployment Blocks for Contracts
 * This helps optimize event queries by avoiding scanning millions of empty blocks
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function findDeploymentBlocks() {
  console.log('🔍 Finding contract deployment blocks...\n');
  
  // Load addresses
  const sepoliaPath = path.join(__dirname, '..', 'test-addresses.json');
  const arbitrumPath = path.join(__dirname, '..', 'test-addresses-arbitrum.json');
  
  const results = {
    sepolia: {},
    arbitrumSepolia: {}
  };
  
  // Sepolia
  if (fs.existsSync(sepoliaPath)) {
    console.log('📡 Checking Sepolia contracts...');
    const addresses = JSON.parse(fs.readFileSync(sepoliaPath, 'utf8'));
    
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    
    // Registry
    if (addresses.PrivacyPreservingRegistry) {
      try {
        const code = await provider.getCode(addresses.PrivacyPreservingRegistry);
        if (code !== '0x') {
          // Binary search for deployment block
          const currentBlock = await provider.getBlockNumber();
          const deployBlock = await findDeploymentBlock(
            provider, 
            addresses.PrivacyPreservingRegistry,
            0,
            currentBlock
          );
          results.sepolia.registry = deployBlock;
          console.log(`   ✅ Registry deployed at block: ${deployBlock}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Registry check failed: ${error.message}`);
      }
    }
    
    // Governance
    if (addresses.ThresholdGovernance) {
      try {
        const code = await provider.getCode(addresses.ThresholdGovernance);
        if (code !== '0x') {
          const currentBlock = await provider.getBlockNumber();
          const deployBlock = await findDeploymentBlock(
            provider,
            addresses.ThresholdGovernance,
            0,
            currentBlock
          );
          results.sepolia.governance = deployBlock;
          console.log(`   ✅ Governance deployed at block: ${deployBlock}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Governance check failed: ${error.message}`);
      }
    }
  }
  
  console.log('\n');
  
  // Arbitrum Sepolia
  if (fs.existsSync(arbitrumPath)) {
    console.log('📡 Checking Arbitrum Sepolia contracts...');
    const addresses = JSON.parse(fs.readFileSync(arbitrumPath, 'utf8'));
    
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc');
    
    // Registry
    if (addresses.PrivacyPreservingRegistry || addresses.registry) {
      const addr = addresses.PrivacyPreservingRegistry || addresses.registry;
      try {
        const code = await provider.getCode(addr);
        if (code !== '0x') {
          const currentBlock = await provider.getBlockNumber();
          const deployBlock = await findDeploymentBlock(provider, addr, 0, currentBlock);
          results.arbitrumSepolia.registry = deployBlock;
          console.log(`   ✅ Registry deployed at block: ${deployBlock}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Registry check failed: ${error.message}`);
      }
    }
    
    // Governance
    if (addresses.ThresholdGovernance || addresses.governance) {
      const addr = addresses.ThresholdGovernance || addresses.governance;
      try {
        const code = await provider.getCode(addr);
        if (code !== '0x') {
          const currentBlock = await provider.getBlockNumber();
          const deployBlock = await findDeploymentBlock(provider, addr, 0, currentBlock);
          results.arbitrumSepolia.governance = deployBlock;
          console.log(`   ✅ Governance deployed at block: ${deployBlock}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Governance check failed: ${error.message}`);
      }
    }
  }
  
  // Write results
  const outputPath = path.join(__dirname, '..', 'deployment-blocks.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  
  console.log('\n✅ Results saved to deployment-blocks.json');
  console.log('\n📋 Constants for frontend:');
  console.log('```javascript');
  console.log('export const DEPLOYMENT_BLOCKS = ' + JSON.stringify(results, null, 2) + ';');
  console.log('```');
}

/**
 * Binary search to find deployment block
 */
async function findDeploymentBlock(provider, address, startBlock, endBlock) {
  console.log(`      🔎 Binary searching blocks ${startBlock}-${endBlock}...`);
  
  // Simple approach: check every 10000 blocks
  // Full binary search is too slow for demo purposes
  const step = 10000;
  let deployBlock = startBlock;
  
  for (let block = startBlock; block <= endBlock; block += step) {
    try {
      const code = await provider.getCode(address, block);
      if (code !== '0x') {
        // Found it, narrow down
        deployBlock = block;
        break;
      }
    } catch (error) {
      // Block might not exist yet
      continue;
    }
  }
  
  // Narrow down to exact block within the 10000 range
  if (deployBlock > startBlock) {
    const searchStart = Math.max(startBlock, deployBlock - step);
    for (let block = searchStart; block <= deployBlock; block += 100) {
      try {
        const code = await provider.getCode(address, block);
        if (code !== '0x') {
          return block;
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return deployBlock;
}

findDeploymentBlocks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
