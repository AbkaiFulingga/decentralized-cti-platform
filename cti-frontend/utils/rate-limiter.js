// utils/rate-limiter.js
/**
 * Global Rate Limiter for IPFS Gateway Requests
 * 
 * Pinata Free Tier: ~30-50 requests per minute
 * This utility ensures all IPFS requests are throttled globally across components
 * to prevent hitting rate limits and causing slow page loads.
 * 
 * Features:
 * - Queue-based request management
 * - Configurable requests per minute limit
 * - Automatic retry with exponential backoff
 * - Request caching to reduce duplicate fetches
 * - Priority queue for critical requests
 */

class RateLimiter {
  constructor(requestsPerMinute = 30, cacheDurationMs = 60000) {
    this.requestsPerMinute = requestsPerMinute;
    this.requestIntervalMs = (60 * 1000) / requestsPerMinute; // Time between requests
    this.queue = [];
    this.activeRequests = 0;
    this.lastRequestTime = 0;
    this.cache = new Map(); // Simple cache for recent requests
    this.cacheDurationMs = cacheDurationMs;
    this.isProcessing = false;
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Async function that performs the request
   * @param {string} cacheKey - Optional cache key for deduplication
   * @param {number} priority - Higher numbers = higher priority (default: 0)
   * @returns {Promise} - Resolves with request result
   */
  async enqueue(requestFn, cacheKey = null, priority = 0) {
    // Check cache first
    if (cacheKey) {
      const cached = this.getCached(cacheKey);
      if (cached !== null) {
        console.log(`📦 Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        cacheKey,
        priority,
        resolve,
        reject,
        retries: 0,
        maxRetries: 3
      });

      // Sort queue by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Wait if we need to throttle
      if (timeSinceLastRequest < this.requestIntervalMs) {
        const waitTime = this.requestIntervalMs - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const item = this.queue.shift();
      this.activeRequests++;
      this.lastRequestTime = Date.now();

      try {
        console.log(`🔄 Processing request (${this.queue.length} remaining, ${this.activeRequests} active)`);
        
        const result = await item.requestFn();

        // Cache successful result
        if (item.cacheKey) {
          this.setCached(item.cacheKey, result);
        }

        item.resolve(result);
        this.activeRequests--;

      } catch (error) {
        console.error(`❌ Request failed:`, error.message);

        // Retry logic
        if (item.retries < item.maxRetries) {
          item.retries++;
          console.log(`   🔄 Retry ${item.retries}/${item.maxRetries}...`);
          
          // Re-add to queue with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, item.retries)));
          this.queue.unshift(item); // Add to front of queue
        } else {
          item.reject(error);
          this.activeRequests--;
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get cached result if available and not expired
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheDurationMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache a result
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limit cache size to 100 entries
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      cacheSize: this.cache.size,
      requestsPerMinute: this.requestsPerMinute
    };
  }
}

// Global singleton instance
// 30 requests per minute = 1 request every 2 seconds (safe for Pinata free tier)
const globalRateLimiter = new RateLimiter(30, 60000);

/**
 * Fetch IPFS content with rate limiting and caching
 * @param {string} cid - IPFS CID to fetch
 * @param {number} priority - Priority level (0-10, higher = more urgent)
 * @returns {Promise} - Resolves with IPFS data
 */
export async function fetchIPFSWithRateLimit(cid, priority = 0) {
  if (!cid || cid.startsWith('0x') || cid.length < 10) {
    throw new Error('Invalid CID format');
  }

  const requestFn = async () => {
    const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'IPFS fetch failed');
    }

    return result.data;
  };

  return globalRateLimiter.enqueue(requestFn, `ipfs:${cid}`, priority);
}

/**
 * Batch fetch multiple CIDs with controlled concurrency
 * @param {string[]} cids - Array of CIDs to fetch
 * @param {number} concurrency - Max concurrent requests (default: 5)
 * @param {Function} onProgress - Optional progress callback (current, total)
 * @returns {Promise<Array>} - Array of results (null for failed fetches)
 */
export async function batchFetchIPFS(cids, concurrency = 5, onProgress = null) {
  const results = new Array(cids.length).fill(null);
  let completed = 0;

  // Process in batches
  for (let i = 0; i < cids.length; i += concurrency) {
    const batch = cids.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (cid, batchIndex) => {
      const globalIndex = i + batchIndex;
      
      try {
        const data = await fetchIPFSWithRateLimit(cid, 5); // Medium priority
        results[globalIndex] = data;
      } catch (error) {
        console.error(`Failed to fetch CID ${cid}:`, error.message);
        results[globalIndex] = null;
      }
      
      completed++;
      if (onProgress) {
        onProgress(completed, cids.length);
      }
    });

    await Promise.all(batchPromises);
  }

  return results;
}

/**
 * Get rate limiter stats (for debugging)
 */
export function getRateLimiterStats() {
  return globalRateLimiter.getStats();
}

/**
 * Clear IPFS cache
 */
export function clearIPFSCache() {
  globalRateLimiter.clearCache();
}

export default globalRateLimiter;
