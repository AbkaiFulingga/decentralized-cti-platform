// scripts/oracle-service.js (COMPLETE REPLACEMENT)
const ethers = require('ethers');
const axios = require('axios');
const cron = require('node-cron');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
require('dotenv').config();

// Configuration
const ARBITRUM_SEPOLIA_RPC = process.env.ARBITRUM_RPC || "https://sepolia-rollup.arbitrum.io/rpc";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const ORACLE_FEED_ADDRESS = process.env.ORACLE_FEED_ADDRESS;
const ABUSEIPDB_KEY = process.env.ABUSEIPDB_KEY;
const PINATA_JWT = process.env.PINATA_JWT;

if (!PINATA_JWT) {
  console.error('❌ PINATA_JWT not found in .env!');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
const oracleWallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);

console.log(`🤖 Oracle Bot Address: ${oracleWallet.address}`);

const oracleContract = new ethers.Contract(
  ORACLE_FEED_ADDRESS,
  [
    "function submitFeed(string memory feedName, string memory cid, bytes32 merkleRoot, uint256 iocCount) external",
    "function feeds(string) external view returns (string name, uint256 lastUpdate, uint256 totalUpdates, uint256 totalIOCs, bool active)"
  ],
  oracleWallet
);

// ============================================
// FEED: AbuseIPDB Blacklist
// ============================================
async function fetchAbuseIPDB() {
  try {
    console.log('🔄 Fetching AbuseIPDB blacklist...');
    
    if (!ABUSEIPDB_KEY || ABUSEIPDB_KEY === '') {
      console.error('❌ AbuseIPDB API key not configured!');
      console.log('   Get free key: https://www.abuseipdb.com/account/api');
      return [];
    }
    
    const response = await axios.get('https://api.abuseipdb.com/api/v2/blacklist', {
      headers: {
        'Key': ABUSEIPDB_KEY,
        'Accept': 'application/json'
      },
      params: {
        confidenceMinimum: 90,
        limit: 10000
      },
      timeout: 30000
    });
    
    if (!response.data || !response.data.data) {
      console.error('❌ Invalid response from AbuseIPDB');
      return [];
    }
    
    const iocs = response.data.data.map(entry => entry.ipAddress);
    console.log(`✅ Fetched ${iocs.length} malicious IPs from AbuseIPDB`);
    
    return iocs;
    
  } catch (error) {
    if (error.response) {
      console.error(`❌ AbuseIPDB API error: ${error.response.status} - ${error.response.data?.errors?.[0]?.detail || error.message}`);
      
      if (error.response.status === 401) {
        console.log('   → API key invalid or missing');
      } else if (error.response.status === 429) {
        console.log('   → Rate limit exceeded (resets at midnight UTC)');
      }
    } else {
      console.error('❌ AbuseIPDB fetch failed:', error.message);
    }
    return [];
  }
}

// ============================================
// Upload DIRECTLY to Pinata (No Frontend API)
// ============================================
async function uploadToIPFS(iocs, feedName) {
  const data = {
    version: "1.0",
    format: "cti-ioc-batch",
    timestamp: new Date().toISOString(),
    source: `Oracle:${feedName}`,
    iocs: iocs,
    metadata: {
      feedName: feedName,
      automated: true,
      oracleVersion: "1.0",
      iocCount: iocs.length,
      confidenceMinimum: 90
    }
  };
  
  try {
    console.log('📤 Uploading to Pinata (direct API)...');
    
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        pinataContent: data,
        pinataMetadata: {
          name: `oracle-${feedName}-${Date.now()}.json`,
          keyvalues: {
            type: 'oracle-feed',
            source: feedName,
            automated: 'true'
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`
        },
        timeout: 60000
      }
    );
    
    const cid = response.data.IpfsHash;
    console.log(`✅ Uploaded to IPFS: ${cid}`);
    console.log(`   URL: https://gateway.pinata.cloud/ipfs/${cid}`);
    return cid;
    
  } catch (error) {
    console.error('❌ Pinata upload failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// ============================================
// Submit Feed to Blockchain
// ============================================
async function submitToBlockchain(feedName, cid, iocs) {
  try {
    // Generate Merkle tree
    console.log('🌳 Generating Merkle tree...');
    const leaves = iocs.map(ioc => keccak256(ioc));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = '0x' + tree.getRoot().toString('hex');
    
    console.log(`📝 Merkle root: ${merkleRoot}`);
    
    // Check if feed can be updated
    const feedInfo = await oracleContract.feeds(feedName);
    const lastUpdate = Number(feedInfo[1]);
    const timeSinceUpdate = Math.floor(Date.now() / 1000) - lastUpdate;
    const updateInterval = 6 * 3600;
    
    if (lastUpdate > 0 && timeSinceUpdate < updateInterval) {
      const minutesRemaining = Math.floor((updateInterval - timeSinceUpdate) / 60);
      console.log(`⏳ ${feedName} was updated ${Math.floor(timeSinceUpdate / 60)} minutes ago`);
      console.log(`   Must wait ${minutesRemaining} more minutes before next update`);
      return;
    }
    
    // Submit to contract
    console.log(`🚀 Submitting ${feedName} to blockchain...`);
    const tx = await oracleContract.submitFeed(
      feedName,
      cid,
      merkleRoot,
      iocs.length,
      { gasLimit: 500000 }
    );
    
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    
    const gasCost = ethers.formatEther(receipt.gasUsed * receipt.gasPrice);
    
    console.log(`✅ ${feedName} feed updated on-chain!`);
    console.log(`   - IOCs: ${iocs.length}`);
    console.log(`   - CID: ${cid}`);
    console.log(`   - Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   - Cost: ${gasCost} ETH (~$${(parseFloat(gasCost) * 2500).toFixed(2)})`);
    console.log(`   - Tx: ${tx.hash}`);
    console.log(`   - Explorer: https://sepolia.arbiscan.io/tx/${tx.hash}`);
    
  } catch (error) {
    if (error.message.includes('Update too frequent')) {
      console.log('⏳ Update interval not reached yet, skipping...');
    } else {
      console.error(`❌ Blockchain submission failed for ${feedName}:`, error.message);
      throw error;
    }
  }
}

// ============================================
// Main Update Function
// ============================================
async function updateAbuseIPDB() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🔄 Starting AbuseIPDB update...`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  
  try {
    const iocs = await fetchAbuseIPDB();
    
    if (iocs.length === 0) {
      console.log(`⚠️  No IOCs fetched from AbuseIPDB, skipping...`);
      return;
    }
    
    const cid = await uploadToIPFS(iocs, 'AbuseIPDB');
    await submitToBlockchain('AbuseIPDB', cid, iocs);
    
    console.log(`✅ AbuseIPDB update complete!\n`);
    
  } catch (error) {
    console.error(`❌ AbuseIPDB update failed:`, error.message);
  }
}

// ============================================
// Check Oracle Balance
// ============================================
async function checkOracleBalance() {
  const balance = await provider.getBalance(oracleWallet.address);
  const ethBalance = ethers.formatEther(balance);
  
  console.log(`💰 Oracle wallet balance: ${ethBalance} ETH`);
  
  if (parseFloat(ethBalance) < 0.01) {
    console.log('⚠️  WARNING: Low balance! Please refill oracle wallet.');
    console.log(`   Send ETH to: ${oracleWallet.address}`);
  }
  
  return ethBalance;
}

// ============================================
// API Usage Statistics
// ============================================
async function showAPIUsage() {
  console.log('\n📊 API Usage Limits:');
  console.log('='.repeat(50));
  console.log('AbuseIPDB Free Tier:');
  console.log('  - Limit: 1,000 requests/day');
  console.log('  - Our usage: 4 requests/day (every 6 hours)');
  console.log('  - Percentage: 0.4% of daily limit ✅');
  console.log('  - IPs per request: Up to 10,000');
  console.log('  - Resets: Daily at midnight UTC');
  console.log('  - Cost: $0/month (free forever)');
  console.log('='.repeat(50) + '\n');
}

// ============================================
// Start Oracle Service
// ============================================
async function startOracleService() {
  console.log('🤖 CTI Oracle Service Starting...');
  console.log('='.repeat(50));
  console.log(`Oracle Bot: ${oracleWallet.address}`);
  console.log(`Network: Arbitrum Sepolia`);
  console.log(`Oracle Feed Contract: ${ORACLE_FEED_ADDRESS}`);
  console.log(`Pinata: Direct API (no frontend dependency)`);
  console.log('='.repeat(50));
  
  await checkOracleBalance();
  await showAPIUsage();
  
  console.log('🚀 Running initial AbuseIPDB update...\n');
  await updateAbuseIPDB();
  
  console.log('\n⏰ Scheduling recurring updates...');
  console.log('✅ AbuseIPDB: Every 6 hours (at 00:00, 06:00, 12:00, 18:00 UTC)');
  
  cron.schedule('0 */6 * * *', async () => {
    console.log('\n⏰ Scheduled update triggered');
    await updateAbuseIPDB();
  });
  
  cron.schedule('0 3,9,15,21 * * *', async () => {
    console.log('\n💰 Balance check...');
    await checkOracleBalance();
  });
  console.log('✅ Balance check: Every 6 hours (offset)');
  
  console.log('\n✅ Oracle service running! Press Ctrl+C to stop.\n');
  console.log('📋 Next update in 6 hours');
  console.log('🔗 View feeds: http://192.168.1.11:3000/news\n');
}

// ============================================
// Error Handling
// ============================================
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down oracle service...');
  await checkOracleBalance();
  console.log('✅ Oracle stopped gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
});

// Start service
startOracleService().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
