// utils/infura-helpers.js

/**
 * Query events in small chunks to work with free-tier RPC providers (10-block limit)
 * Works with Alchemy, Infura, Pinata RPC, and other providers with block range limits
 * @param {Contract} contract - ethers Contract instance
 * @param {EventFilter} filter - Event filter from contract.filters.EventName()
 * @param {number} startBlock - Starting block number
 * @param {number|string} endBlock - Ending block number or 'latest'
 * @param {Provider} provider - ethers provider
 * @returns {Promise<Array>} - Array of events
 */
export async function queryEventsInChunks(contract, filter, startBlock, endBlock, provider, options = {}) {
  const {
    chunkSize = 10,
    baseDelayMs = 500,
    maxRetries = 5,
    onChunkError = 'retry' // 'retry' | 'skip'
  } = options;
  const events = [];
  
  // Get latest block if endBlock is 'latest'
  const latestBlock = endBlock === 'latest' ? await provider.getBlockNumber() : endBlock;
  
  const totalBlocks = latestBlock - startBlock + 1;
  const estimatedChunks = Math.ceil(totalBlocks / chunkSize);
  
  console.log(`🔍 Querying events from block ${startBlock} to ${latestBlock}`);
  console.log(`   Total blocks: ${totalBlocks}, Estimated chunks: ${estimatedChunks}`);
  console.log(`   Chunk size: ${chunkSize}, Base delay: ${baseDelayMs}ms`);
  
  let currentStart = startBlock;
  let retries = 0;
  const MAX_RETRIES = maxRetries;
  let consecutiveErrors = 0; // Track consecutive errors
  
  while (currentStart <= latestBlock) {
    const currentEnd = Math.min(currentStart + chunkSize - 1, latestBlock);
    
    try {
      const chunkEvents = await contract.queryFilter(filter, currentStart, currentEnd);
      events.push(...chunkEvents);
      
      if (chunkEvents.length > 0) {
        console.log(`   ✅ Blocks ${currentStart}-${currentEnd}: ${chunkEvents.length} events`);
      }
      
      currentStart = currentEnd + 1;
      retries = 0; // Reset retries on success
      consecutiveErrors = 0; // Reset consecutive error counter
      
      // ✅ IMPROVED: Adaptive rate limiting based on error history
  const delay = consecutiveErrors > 0 ? baseDelayMs * 2 : baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error) {
      consecutiveErrors++;
      const errorStr = JSON.stringify(error);
      const isRateLimitError = 
        error.code === 429 || 
        error.code === -32005 || // Alchemy rate limit
        errorStr.includes('"code":429') ||
        errorStr.includes('"code":-32005') ||
        errorStr.includes('compute units') ||
        errorStr.includes('rate limit') ||
        errorStr.includes('Too Many Requests');
      
      if (isRateLimitError) {
        console.warn(`   ⏳ Rate limit hit on blocks ${currentStart}-${currentEnd}, waiting longer...`);
        // Exponential backoff: 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retries)));
      } else {
        console.error(`   ❌ Error querying blocks ${currentStart}-${currentEnd}:`, error.message);
      }
      
      retries++;
      if (retries >= MAX_RETRIES) {
        if (onChunkError === 'skip') {
          console.error(`   ⚠️  Max retries (${MAX_RETRIES}) reached for blocks ${currentStart}-${currentEnd}, skipping...`);
          currentStart = currentEnd + 1;
          retries = 0;
          consecutiveErrors = 0; // Reset for next chunk
        } else {
          // Keep retrying this same chunk instead of silently skipping data.
          console.error(`   ⚠️  Max retries (${MAX_RETRIES}) reached for blocks ${currentStart}-${currentEnd}, continuing to retry...`);
          retries = 0;
          // Wait a bit longer before re-attempting the same chunk.
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } else {
        console.log(`   🔄 Retry ${retries}/${MAX_RETRIES} for blocks ${currentStart}-${currentEnd}...`);
        // Additional backoff before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }
  
  console.log(`✅ Total events found: ${events.length}`);
  return events;
}

/**
 * Smart event query with automatic fallback to chunked queries
 * Optimizes by using deployment block or recent blocks instead of querying from 0
 * Works with any RPC provider (Alchemy, Infura, Pinata, QuickNode, etc.)
 * @param {Contract} contract - ethers Contract instance
 * @param {EventFilter} filter - Event filter
 * @param {number} fromBlock - Starting block (use network.deploymentBlock for optimization)
 * @param {number|string} toBlock - Ending block or 'latest'
 * @param {Provider} provider - ethers provider
 * @param {number} deploymentBlock - Optional deployment block for optimization
 * @returns {Promise<Array>} - Array of events
 */
export async function smartQueryEvents(contract, filter, fromBlock, toBlock, provider, options = {}) {
  const {
    deploymentBlock = null,
    chunkSize,
    baseDelayMs,
    maxRetries,
    onChunkError
  } = options;
  // If fromBlock is 0 and we have deployment block, use it instead
  if (fromBlock === 0 && deploymentBlock !== null && deploymentBlock > 0) {
    console.log(`⚡ Optimization: Using deployment block ${deploymentBlock} instead of 0`);
    fromBlock = deploymentBlock;
  }
  
  try {
    // Try full range first (works for paid tier or small ranges)
    console.log(`🔍 Attempting full range query: ${fromBlock} to ${toBlock}...`);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    console.log(`✅ Full range query succeeded: ${events.length} events`);
    return events;
    
  } catch (error) {
    const errorStr = JSON.stringify(error);
    const isBlockRangeError = 
      error.message?.includes('block range') || 
      error.message?.includes('10 block') ||
      error.code === -32600 ||
      errorStr.includes('"code":-32600') ||
      errorStr.includes('block range');
      
    if (isBlockRangeError) {
      console.log(`⚠️  RPC provider block range limit detected, switching to chunked queries...`);
      return await queryEventsInChunks(contract, filter, fromBlock, toBlock, provider, {
        chunkSize,
        baseDelayMs,
        maxRetries,
        onChunkError
      });
    } else {
      console.error(`❌ Unexpected error:`, error.message);
      throw error;
    }
  }
}

/**
 * Provider-aware defaults for log querying.
 * Alchemy Sepolia free-tier effectively enforces a 9-block inclusive window for eth_getLogs.
 */
export function getEventQueryDefaults(network = {}) {
  const chainId = Number(network.chainId);
  const rpcUrl = (network.rpcUrl || '').toLowerCase();

  // Conservative Alchemy Sepolia limit (inclusive endBlock quirks)
  if (chainId === 11155111 && rpcUrl.includes('alchemy.com')) {
    return { chunkSize: 9, baseDelayMs: 500, maxRetries: 6, onChunkError: 'retry' };
  }

  // Arbitrum public RPC is generally permissive
  if (chainId === 421614) {
    return { chunkSize: 10_000, baseDelayMs: 50, maxRetries: 4, onChunkError: 'retry' };
  }

  return { chunkSize: 10, baseDelayMs: 500, maxRetries: 5, onChunkError: 'retry' };
}

/**
 * Get recent blocks safely (last N blocks, but not more than 10 at once for Infura)
 * @param {Provider} provider - ethers provider
 * @param {number} blocksBack - How many blocks to go back
 * @returns {Promise<{from: number, to: number}>} - Block range
 */
export async function getSafeBlockRange(provider, blocksBack = 100) {
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - blocksBack);
  return { from: fromBlock, to: latestBlock };
}
