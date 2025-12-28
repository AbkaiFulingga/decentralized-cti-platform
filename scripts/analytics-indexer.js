/**
 * Analytics Background Indexer
 * 
 * Runs as PM2 daemon to continuously index blockchain events and cache
 * statistics for instant Analytics page loading.
 * 
 * Usage:
 *   pm2 start scripts/analytics-indexer.js --name analytics-indexer
 *   pm2 logs analytics-indexer
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const NETWORKS = {
  sepolia: {
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    addressFile: 'test-addresses.json',
    blocksPerDay: 7200,
    deploymentBlock: 7340000
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia', 
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
    addressFile: 'test-addresses-arbitrum.json',
    blocksPerDay: 28800,
    deploymentBlock: 96000000
  }
};

const CACHE_DIR = path.join(__dirname, '../cti-frontend/public/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'analytics-cache.json');
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HISTORY_DAYS = 7; // Last 7 days for heatmap

// Registry ABI (only events we need)
const REGISTRY_ABI = [
  'event BatchSubmitted(uint256 indexed batchIndex, address indexed submitter, string ipfsCid, bytes32 merkleRoot)',
  'function getBatchCount() view returns (uint256)'
];

class AnalyticsIndexer {
  constructor() {
    this.cache = {
      timestamp: Date.now(),
      sepolia: { batches: 0, contributors: new Set(), dailyStats: {} },
      arbitrumSepolia: { batches: 0, contributors: new Set(), dailyStats: {} }
    };
  }

  async initialize() {
    console.log('🚀 Analytics Indexer Starting...');
    console.log(`   Update interval: ${UPDATE_INTERVAL / 1000}s`);
    console.log(`   History window: ${HISTORY_DAYS} days`);
    
    // Ensure cache directory exists
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      console.log(`✅ Cache directory ready: ${CACHE_DIR}`);
    } catch (error) {
      console.error('❌ Failed to create cache directory:', error);
    }

    // Load existing cache if available
    try {
      const cached = await fs.readFile(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(cached);
      
      // Convert Set back from array
      this.cache = {
        ...parsed,
        sepolia: {
          ...parsed.sepolia,
          contributors: new Set(parsed.sepolia.contributors)
        },
        arbitrumSepolia: {
          ...parsed.arbitrumSepolia,
          contributors: new Set(parsed.arbitrumSepolia.contributors)
        }
      };
      
      const age = Math.floor((Date.now() - this.cache.timestamp) / 60000);
      console.log(`✅ Loaded cache from ${age} minutes ago`);
    } catch (error) {
      console.log('📝 No existing cache, starting fresh');
    }

    // Start update loop
    this.startUpdateLoop();
  }

  startUpdateLoop() {
    // Update immediately
    this.updateStats().catch(console.error);
    
    // Then update periodically
    setInterval(() => {
      this.updateStats().catch(console.error);
    }, UPDATE_INTERVAL);
  }

  async updateStats() {
    console.log('\n🔄 Updating analytics cache...');
    const startTime = Date.now();

    try {
      // Update both networks in parallel
      await Promise.all([
        this.updateNetworkStats('sepolia'),
        this.updateNetworkStats('arbitrumSepolia')
      ]);

      // Save cache
      await this.saveCache();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Cache updated in ${duration}s`);
      console.log(`   - Sepolia: ${this.cache.sepolia.batches} batches, ${this.cache.sepolia.contributors.size} contributors`);
      console.log(`   - Arbitrum: ${this.cache.arbitrumSepolia.batches} batches, ${this.cache.arbitrumSepolia.contributors.size} contributors`);

    } catch (error) {
      console.error('❌ Update failed:', error.message);
    }
  }

  async updateNetworkStats(networkKey) {
    const network = NETWORKS[networkKey];
    console.log(`📊 Indexing ${network.name}...`);

    try {
      // Load contract address
      const addressFile = path.join(__dirname, '..', network.addressFile);
      const addresses = JSON.parse(await fs.readFile(addressFile, 'utf8'));

      // Connect to provider
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const registry = new ethers.Contract(addresses.registry, REGISTRY_ABI, provider);

      // Get current block
      const currentBlock = await provider.getBlockNumber();
      
      // Calculate block range (last 7 days only)
      const blocksToQuery = network.blocksPerDay * HISTORY_DAYS;
      const fromBlock = Math.max(network.deploymentBlock, currentBlock - blocksToQuery);

      console.log(`   Querying blocks ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)`);

      // Query events in chunks to avoid rate limits
      const CHUNK_SIZE = 10000; // Query 10k blocks at a time
      const events = [];
      
      for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, currentBlock);
        console.log(`   Chunk: ${start}-${end}`);
        
        const filter = registry.filters.BatchSubmitted();
        const chunkEvents = await registry.queryFilter(filter, start, end);
        events.push(...chunkEvents);
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`   Found ${events.length} BatchSubmitted events`);

      // Process events
      const contributors = new Set();
      const dailyStats = {};

      for (const event of events) {
        // Track contributor
        if (event.args?.submitter) {
          contributors.add(event.args.submitter.toLowerCase());
        }

        // Track daily submissions for heatmap
        if (event.blockNumber) {
          try {
            const block = await provider.getBlock(event.blockNumber);
            const date = new Date(block.timestamp * 1000).toISOString().split('T')[0];
            dailyStats[date] = (dailyStats[date] || 0) + 1;
          } catch (blockError) {
            console.warn(`   ⚠️  Failed to get block ${event.blockNumber}:`, blockError.message);
          }
        }
      }

      // Get total batch count
      const totalBatches = await registry.getBatchCount();

      // Update cache
      this.cache[networkKey] = {
        batches: Number(totalBatches),
        contributors: contributors,
        dailyStats: dailyStats,
        lastUpdate: Date.now()
      };

      console.log(`   ✅ ${network.name} indexed: ${contributors.size} contributors, ${Object.keys(dailyStats).length} days`);

    } catch (error) {
      console.error(`   ❌ ${network.name} indexing failed:`, error.message);
      throw error;
    }
  }

  async saveCache() {
    // Convert Sets to arrays for JSON serialization
    const serializable = {
      timestamp: Date.now(),
      sepolia: {
        batches: this.cache.sepolia.batches,
        contributors: Array.from(this.cache.sepolia.contributors),
        dailyStats: this.cache.sepolia.dailyStats,
        lastUpdate: this.cache.sepolia.lastUpdate
      },
      arbitrumSepolia: {
        batches: this.cache.arbitrumSepolia.batches,
        contributors: Array.from(this.cache.arbitrumSepolia.contributors),
        dailyStats: this.cache.arbitrumSepolia.dailyStats,
        lastUpdate: this.cache.arbitrumSepolia.lastUpdate
      }
    };

    await fs.writeFile(CACHE_FILE, JSON.stringify(serializable, null, 2));
    console.log(`💾 Cache saved to ${CACHE_FILE}`);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
});

// Start indexer
const indexer = new AnalyticsIndexer();
indexer.initialize().catch((error) => {
  console.error('💥 Failed to initialize:', error);
  process.exit(1);
});
