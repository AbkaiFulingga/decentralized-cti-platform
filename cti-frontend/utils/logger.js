/**
 * Comprehensive Logging Utility for Decentralized CTI Platform
 * 
 * Provides centralized logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Component-based categorization
 * - Performance tracking
 * - Transaction tracking
 * - IPFS request tracking
 * - RPC request tracking
 * - Optional backend logging
 * - Browser console formatting with emojis
 * 
 * Usage:
 *   import { AppLogger } from '@/utils/logger';
 *   AppLogger.info('Analytics', 'Loading batch data', { batchId: 123 });
 *   AppLogger.error('Admin', 'Transaction failed', { error: err.message });
 *   const timer = AppLogger.startTimer('Analytics', 'Fetch IPFS data');
 *   // ... do work ...
 *   timer.end(); // Logs duration
 */

export class AppLogger {
  // Log levels
  static levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };
  
  // Current log level (can be changed dynamically)
  static currentLevel = typeof window !== 'undefined' && 
    localStorage.getItem('logLevel') ? 
    parseInt(localStorage.getItem('logLevel')) : 
    AppLogger.levels.INFO;
  
  // Performance tracking storage
  static performanceMetrics = new Map();
  
  // RPC request tracking
  static rpcRequestCount = 0;
  static rpcErrorCount = 0;
  static rpcLastReset = Date.now();
  
  // IPFS request tracking
  static ipfsRequestCount = 0;
  static ipfsErrorCount = 0;
  static ipfsLastReset = Date.now();
  
  /**
   * Set log level dynamically
   * @param {string} level - 'DEBUG', 'INFO', 'WARN', or 'ERROR'
   */
  static setLogLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.INFO;
    if (typeof window !== 'undefined') {
      localStorage.setItem('logLevel', this.currentLevel);
    }
    console.log(`🔧 Log level set to: ${level}`);
  }
  
  /**
   * Format timestamp
   */
  static getTimestamp() {
    return new Date().toISOString().split('T')[1].split('.')[0];
  }
  
  /**
   * Log debug message
   */
  static debug(component, message, data = null) {
    if (this.currentLevel <= this.levels.DEBUG) {
      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] 🐛 [${component}] ${message}`, data || '');
    }
  }
  
  /**
   * Log info message
   */
  static info(component, message, data = null) {
    if (this.currentLevel <= this.levels.INFO) {
      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] ℹ️  [${component}] ${message}`, data || '');
    }
  }
  
  /**
   * Log warning message
   */
  static warn(component, message, data = null) {
    if (this.currentLevel <= this.levels.WARN) {
      const timestamp = this.getTimestamp();
      console.warn(`[${timestamp}] ⚠️  [${component}] ${message}`, data || '');
    }
  }
  
  /**
   * Log error message
   */
  static error(component, message, error = null) {
    if (this.currentLevel <= this.levels.ERROR) {
      const timestamp = this.getTimestamp();
      console.error(`[${timestamp}] ❌ [${component}] ${message}`, error || '');
      
      // Extract detailed error info
      if (error) {
        const errorDetails = {
          message: error.message,
          code: error.code,
          stack: error.stack?.split('\n').slice(0, 3),
          data: error.data,
          reason: error.reason
        };
        console.error(`   Error details:`, errorDetails);
      }
    }
  }
  
  /**
   * Log transaction attempt
   */
  static transaction(component, action, txData) {
    const timestamp = this.getTimestamp();
    console.log(`[${timestamp}] 💸 [${component}] Transaction: ${action}`, {
      to: txData.to,
      from: txData.from,
      value: txData.value,
      gasLimit: txData.gasLimit
    });
  }
  
  /**
   * Log transaction result
   */
  static transactionResult(component, action, receipt) {
    const timestamp = this.getTimestamp();
    const success = receipt.status === 1;
    const emoji = success ? '✅' : '❌';
    
    console.log(`[${timestamp}] ${emoji} [${component}] Transaction ${success ? 'confirmed' : 'reverted'}: ${action}`, {
      hash: receipt.hash,
      status: receipt.status,
      gasUsed: receipt.gasUsed?.toString(),
      blockNumber: receipt.blockNumber,
      logsCount: receipt.logs?.length || 0
    });
    
    if (!success) {
      console.error(`   Transaction reverted with no logs (early revert)`);
    }
  }
  
  /**
   * Log RPC request
   */
  static rpcRequest(component, method, params = null) {
    this.rpcRequestCount++;
    
    // Reset counter every minute
    if (Date.now() - this.rpcLastReset > 60000) {
      this.debug('RPC', `Request stats (last minute): ${this.rpcRequestCount} requests, ${this.rpcErrorCount} errors`);
      this.rpcRequestCount = 0;
      this.rpcErrorCount = 0;
      this.rpcLastReset = Date.now();
    }
    
    this.debug(component, `RPC: ${method}`, params);
  }
  
  /**
   * Log RPC error
   */
  static rpcError(component, method, error) {
    this.rpcErrorCount++;
    
    const is429 = error.code === 429 || 
                  error.code === -32005 ||
                  error.message?.includes('429') ||
                  error.message?.includes('rate limit');
    
    if (is429) {
      this.warn(component, `RPC rate limit hit: ${method}`, {
        code: error.code,
        message: error.message,
        requestCount: this.rpcRequestCount,
        errorCount: this.rpcErrorCount
      });
    } else {
      this.error(component, `RPC error: ${method}`, error);
    }
  }
  
  /**
   * Log IPFS request
   */
  static ipfsRequest(component, cid, cached = false) {
    this.ipfsRequestCount++;
    
    // Reset counter every minute
    if (Date.now() - this.ipfsLastReset > 60000) {
      this.debug('IPFS', `Request stats (last minute): ${this.ipfsRequestCount} requests, ${this.ipfsErrorCount} errors`);
      this.ipfsRequestCount = 0;
      this.ipfsErrorCount = 0;
      this.ipfsLastReset = Date.now();
    }
    
    const status = cached ? '(cached)' : '(fetching)';
    this.debug(component, `IPFS: ${cid} ${status}`);
  }
  
  /**
   * Log IPFS error
   */
  static ipfsError(component, cid, error) {
    this.ipfsErrorCount++;
    
    const is429 = error.status === 429 || 
                  error.message?.includes('429') ||
                  error.message?.includes('rate limit');
    
    if (is429) {
      this.warn(component, `IPFS rate limit hit: ${cid}`, {
        status: error.status,
        message: error.message,
        requestCount: this.ipfsRequestCount,
        errorCount: this.ipfsErrorCount
      });
    } else {
      this.error(component, `IPFS error: ${cid}`, error);
    }
  }
  
  /**
   * Start performance timer
   * @param {string} component - Component name
   * @param {string} operation - Operation description
   * @returns {Object} Timer object with end() method
   */
  static startTimer(component, operation) {
    const startTime = performance.now();
    const timestamp = this.getTimestamp();
    
    this.debug(component, `⏱️  Started: ${operation}`);
    
    return {
      end: () => {
        const duration = Math.round(performance.now() - startTime);
        const emoji = duration < 1000 ? '⚡' : duration < 5000 ? '⏱️' : '🐌';
        
        console.log(`[${timestamp}] ${emoji} [${component}] Completed: ${operation} (${duration}ms)`);
        
        // Store metric
        const key = `${component}:${operation}`;
        if (!this.performanceMetrics.has(key)) {
          this.performanceMetrics.set(key, []);
        }
        this.performanceMetrics.get(key).push(duration);
        
        return duration;
      }
    };
  }
  
  /**
   * Get performance statistics
   */
  static getPerformanceStats() {
    const stats = {};
    
    for (const [key, durations] of this.performanceMetrics.entries()) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      
      stats[key] = {
        count: durations.length,
        avg: Math.round(avg),
        min,
        max
      };
    }
    
    return stats;
  }
  
  /**
   * Print performance summary
   */
  static printPerformanceStats() {
    console.log('📊 Performance Statistics:');
    console.table(this.getPerformanceStats());
  }
  
  /**
   * Log zkSNARK proof generation
   */
  static zksnark(component, step, data = null) {
    const timestamp = this.getTimestamp();
    console.log(`[${timestamp}] 🔐 [${component}] zkSNARK: ${step}`, data || '');
  }
  
  /**
   * Log governance action
   */
  static governance(component, action, data) {
    const timestamp = this.getTimestamp();
    console.log(`[${timestamp}] 🏛️  [${component}] Governance: ${action}`, data);
  }
  
  /**
   * Clear all logs and metrics (for testing)
   */
  static clear() {
    this.performanceMetrics.clear();
    this.rpcRequestCount = 0;
    this.rpcErrorCount = 0;
    this.ipfsRequestCount = 0;
    this.ipfsErrorCount = 0;
    console.clear();
    console.log('🧹 Logger cleared');
  }
}

// Export convenience functions
export const debug = AppLogger.debug.bind(AppLogger);
export const info = AppLogger.info.bind(AppLogger);
export const warn = AppLogger.warn.bind(AppLogger);
export const error = AppLogger.error.bind(AppLogger);
export const startTimer = AppLogger.startTimer.bind(AppLogger);

// Make logger accessible globally for debugging
if (typeof window !== 'undefined') {
  window.AppLogger = AppLogger;
  console.log('💡 Tip: Use window.AppLogger.setLogLevel("DEBUG") to see detailed logs');
  console.log('💡 Tip: Use window.AppLogger.printPerformanceStats() to see performance metrics');
}
