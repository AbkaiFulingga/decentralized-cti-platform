// scripts/update-contributor-merkle.js
require('dotenv').config({ path: '/home/sc/blockchain-dev/.env' });
const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const fs = require('fs');
const path = require('path');

async function updateContributorMerkleTree() {
  console.log('🌳 Starting contributor Merkle tree generation...');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    // ✅ FIX: Use hardcoded addresses to avoid ENS resolution
    const rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
    const registryAddress = '0x892AD6E47dbD86aD7855f7eEAe0F4fCa6223C36A';
    const merkleZKAddress = process.env.MERKLE_ZK_ADDRESS || '0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1';
    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
    
    console.log('\n📋 Configuration Check:');
    console.log('RPC URL:', rpcUrl ? '✅ Set' : '❌ Missing');
    console.log('Registry:', registryAddress ? '✅ Set' : '❌ Missing');
    console.log('MerkleZK:', merkleZKAddress ? '✅ Set' : '❌ Missing');
    console.log('Deployer Key:', deployerKey ? '✅ Set' : '❌ Missing');
    
    if (!rpcUrl || !registryAddress || !merkleZKAddress || !deployerKey) {
      throw new Error('Missing required configuration');
    }
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log('\n✅ Connected to:', rpcUrl);
    
    const blockNumber = await provider.getBlockNumber();
    console.log('Current block:', blockNumber);
    
    // ✅ FIX: Pass address directly, not variable that might trigger ENS
    const registryABI = [
      "function contributors(address) external view returns (uint256 submissionCount, uint256 acceptedSubmissions, uint256 reputationScore, uint256 totalStaked, uint256 tier, bool isActive, uint256 joinedAt)"
    ];
    
    const registry = new ethers.Contract(registryAddress, registryABI, provider);
    
    // Known contributor addresses
    const knownAddresses = [
      '0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82',
      process.env.TEST_CONTRIBUTOR_2,
      process.env.TEST_CONTRIBUTOR_3
    ].filter(addr => addr && addr.startsWith('0x'));
    
    console.log(`\n📡 Checking ${knownAddresses.length} known addresses...`);
    
    const activeContributors = [];
    
    for (const addr of knownAddresses) {
      try {
        // ✅ FIX: Pass address as string literal
        const contributorData = await registry.contributors(addr);
        const isActive = contributorData[5];
        
        if (isActive) {
          activeContributors.push(addr);
          console.log(`✅ Active contributor: ${addr}`);
        } else {
          console.log(`⚠️  Inactive: ${addr}`);
        }
      } catch (error) {
        console.log(`❌ Error checking ${addr}:`, error.message);
      }
    }
    
    if (activeContributors.length === 0) {
      console.log('\n❌ No active contributors found!');
      console.log('\n💡 Debug: Check if address is actually registered:');
      console.log(`   cast call ${registryAddress} "contributors(address)(bool)" 0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82 --rpc-url ${rpcUrl}`);
      process.exit(1);
    }
    
    console.log(`\n✅ Found ${activeContributors.length} active contributors`);
    
    // Generate Merkle tree
    console.log('\n🌳 Generating Merkle tree...');
    const leaves = activeContributors.map(addr => keccak256(addr.toLowerCase()));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getRoot();
    const rootHex = '0x' + root.toString('hex');
    
    console.log('Merkle root:', rootHex);
    console.log('Tree depth:', tree.getDepth());
    console.log('Leaf count:', tree.getLeafCount());
    
    // Update on-chain
    console.log('\n📤 Updating Merkle root on-chain...');
    
    const cleanKey = deployerKey.startsWith('0x') ? deployerKey : '0x' + deployerKey;
    const wallet = new ethers.Wallet(cleanKey, provider);
    console.log('Using wallet:', wallet.address);
    
    const merkleZKABI = [
      "function updateContributorRoot(bytes32 newRoot, uint256 count) external",
      "function contributorMerkleRoot() external view returns (bytes32)",
      "function owner() external view returns (address)"
    ];
    
    const merkleZK = new ethers.Contract(merkleZKAddress, merkleZKABI, wallet);
    
    // Verify ownership
    const owner = await merkleZK.owner();
    console.log('Contract owner:', owner);
    
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`Not contract owner! Owner is ${owner}, you are ${wallet.address}`);
    }
    
    const tx = await merkleZK.updateContributorRoot(rootHex, activeContributors.length, {
      gasLimit: 150000
    });
    
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed!');
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Block:', receipt.blockNumber);
    
    // Verify update
    const onChainRoot = await merkleZK.contributorMerkleRoot();
    console.log('\n🔍 Verification:');
    console.log('Expected root:', rootHex);
    console.log('On-chain root:', onChainRoot);
    console.log('Match:', onChainRoot.toLowerCase() === rootHex.toLowerCase() ? '✅' : '❌');
    
    // Save tree data
    const treeData = {
      root: rootHex,
      leaves: leaves.map(l => '0x' + l.toString('hex')),
      contributors: activeContributors,
      contributorCount: activeContributors.length,
      treeDepth: tree.getDepth(),
      timestamp: Date.now(),
      lastUpdate: new Date().toISOString(),
      network: 'arbitrumSepolia',
      merkleZKAddress: merkleZKAddress,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
    
    const outputPath = path.join(__dirname, '../contributor-merkle-tree.json');
    fs.writeFileSync(outputPath, JSON.stringify(treeData, null, 2));
    
    console.log('\n💾 Tree data saved to:', outputPath);
    console.log('\n🎉 Merkle tree update complete!');
    console.log(`Anonymity set size: ${activeContributors.length} contributors`);
    
  } catch (error) {
    console.error('\n❌ Error updating Merkle tree:');
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  updateContributorMerkleTree()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { updateContributorMerkleTree };
