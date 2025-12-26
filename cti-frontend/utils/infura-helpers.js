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
export async function queryEventsInChunks(contract, filter, startBlock, endBlock, provider) {
  const CHUNK_SIZE = 10; // Free tier RPC limit
  const RATE_LIMIT_DELAY = 300; // 300ms delay between chunks (was 100ms)
  const events = [];
  
  // Get latest block if endBlock is 'latest'
  const latestBlock = endBlock === 'latest' ? await provider.getBlockNumber() : endBlock;
  
  console.log(`🔍 Querying events from block ${startBlock} to ${latestBlock} in ${CHUNK_SIZE}-block chunks...`);
  
  let currentStart = startBlock;
  let retries = 0;
  const MAX_RETRIES = 5; // Increased from 3
  
  while (currentStart <= latestBlock) {
    const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, latestBlock);
    
    try {
      const chunkEvents = await contract.queryFilter(filter, currentStart, currentEnd);
      events.push(...chunkEvents);
      
      if (chunkEvents.length > 0) {
        console.log(`   ✅ Blocks ${currentStart}-${currentEnd}: ${chunkEvents.length} events`);
      }
      
      currentStart = currentEnd + 1;
      retries = 0; // Reset retries on success
      
      // Rate limiting - wait 300ms between chunks to avoid RPC provider compute unit limits
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
    } catch (error) {
      const errorStr = JSON.stringify(error);
      const isRateLimitError = 
        error.code === 429 || 
        errorStr.includes('"code":429') ||
        errorStr.includes('compute units') ||
        errorStr.includes('rate limit');
      
      if (isRateLimitError) {
        console.warn(`   ⏳ Rate limit hit on blocks ${currentStart}-${currentEnd}, waiting longer...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retries + 1))); // Wait 2-10 seconds
      } else {
        console.error(`   ❌ Error querying blocks ${currentStart}-${currentEnd}:`, error.message);
      }
      
      retries++;
      if (retries >= MAX_RETRIES) {
        console.error(`   ⚠️  Max retries reached, skipping blocks ${currentStart}-${currentEnd}`);
        currentStart = currentEnd + 1;
        retries = 0;
      } else {
        console.log(`   🔄 Retry ${retries}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
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
export async function smartQueryEvents(contract, filter, fromBlock, toBlock, provider, deploymentBlock = null) {
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
      return await queryEventsInChunks(contract, filter, fromBlock, toBlock, provider);
    } else {
      console.error(`❌ Unexpected error:`, error.message);
      throw error;
    }
  }
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
