/**
 * Enhanced Entropy Collector for zkSNARK Randomness
 * 
 * Collects entropy from multiple sources to strengthen randomness
 * used in zkSNARK proof generation.
 * 
 * Sources:
 * - Browser crypto.getRandomValues() (primary)
 * - User interaction timing (mouse movements, clicks)
 * - Performance timing API
 * - Device characteristics
 */

export class EntropyCollector {
    constructor() {
        this.entropy = [];
        this.mouseMovements = [];
        this.startTime = performance.now();
        this.maxEntropy = 1000; // Maximum entropy samples to collect
        
        this.initializeListeners();
    }

    /**
     * Initialize event listeners for entropy collection
     */
    initializeListeners() {
        if (typeof window === 'undefined') return;

        // Mouse movement entropy
        document.addEventListener('mousemove', (e) => {
            if (this.mouseMovements.length < 100) {
                this.mouseMovements.push({
                    x: e.clientX,
                    y: e.clientY,
                    time: performance.now()
                });
            }
        });

        // Click timing entropy
        document.addEventListener('click', () => {
            this.addEntropy(performance.now());
        });

        // Keyboard timing entropy
        document.addEventListener('keypress', () => {
            this.addEntropy(performance.now());
        });
    }

    /**
     * Add entropy sample
     */
    addEntropy(value) {
        if (this.entropy.length < this.maxEntropy) {
            this.entropy.push(value);
        }
    }

    /**
     * Generate high-quality random bytes with mixed entropy
     * @param {number} length - Number of random bytes to generate
     * @returns {Uint8Array} Random bytes
     */
    getRandomBytes(length) {
        // Primary source: crypto.getRandomValues (cryptographically secure)
        const primaryRandom = new Uint8Array(length);
        crypto.getRandomValues(primaryRandom);

        // Additional entropy sources
        const additionalEntropy = this.collectAdditionalEntropy();
        
        // Mix entropy using XOR
        const mixed = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            mixed[i] = primaryRandom[i] ^ (additionalEntropy[i % additionalEntropy.length] || 0);
        }

        return mixed;
    }

    /**
     * Collect additional entropy from various sources
     * @returns {Uint8Array} Additional entropy bytes
     */
    collectAdditionalEntropy() {
        const entropy = [];

        // Performance timing
        entropy.push(...this.hashNumber(performance.now()));

        // Mouse movement patterns
        if (this.mouseMovements.length > 0) {
            for (const move of this.mouseMovements.slice(-10)) {
                entropy.push(...this.hashNumber(move.x));
                entropy.push(...this.hashNumber(move.y));
                entropy.push(...this.hashNumber(move.time));
            }
        }

        // Memory usage (if available)
        if (performance.memory) {
            entropy.push(...this.hashNumber(performance.memory.usedJSHeapSize));
        }

        // Navigation timing
        if (performance.timing) {
            entropy.push(...this.hashNumber(performance.timing.domContentLoadedEventEnd));
            entropy.push(...this.hashNumber(performance.timing.loadEventEnd));
        }

        // Device characteristics
        entropy.push(...this.hashNumber(screen.width));
        entropy.push(...this.hashNumber(screen.height));
        entropy.push(...this.hashNumber(screen.colorDepth));

        // User agent hash
        const uaHash = this.simpleHash(navigator.userAgent);
        entropy.push(...this.numberToBytes(uaHash));

        // Random entropy samples collected
        for (const sample of this.entropy.slice(-20)) {
            entropy.push(...this.hashNumber(sample));
        }

        return new Uint8Array(entropy.slice(0, 256)); // Limit to 256 bytes
    }

    /**
     * Hash a number to bytes
     */
    hashNumber(num) {
        const bytes = [];
        let n = Math.floor(Math.abs(num));
        while (n > 0) {
            bytes.push(n & 0xFF);
            n = Math.floor(n / 256);
        }
        return bytes.length > 0 ? bytes : [0];
    }

    /**
     * Convert number to bytes
     */
    numberToBytes(num) {
        const bytes = [];
        for (let i = 0; i < 4; i++) {
            bytes.push((num >> (i * 8)) & 0xFF);
        }
        return bytes;
    }

    /**
     * Simple hash function for strings
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Generate nonce with enhanced randomness
     * @returns {bigint} Random nonce
     */
    generateNonce() {
        const randomBytes = this.getRandomBytes(32);
        
        // Convert bytes to bigint
        let nonce = 0n;
        for (let i = 0; i < randomBytes.length; i++) {
            nonce = (nonce << 8n) | BigInt(randomBytes[i]);
        }

        // Ensure nonce is within reasonable bounds (64 bits)
        nonce = nonce % (2n ** 64n);

        return nonce;
    }

    /**
     * Get entropy quality metrics
     * @returns {object} Entropy statistics
     */
    getEntropyStats() {
        return {
            mouseMovements: this.mouseMovements.length,
            entropySamples: this.entropy.length,
            collectionTime: performance.now() - this.startTime,
            quality: this.entropy.length > 50 ? 'high' : (this.entropy.length > 10 ? 'medium' : 'low')
        };
    }

    /**
     * Test randomness quality
     * Generates multiple samples and checks for patterns
     */
    async testRandomness() {
        const samples = [];
        const sampleCount = 1000;

        console.log('🧪 Testing randomness quality...');

        // Generate samples
        for (let i = 0; i < sampleCount; i++) {
            const nonce = this.generateNonce();
            samples.push(Number(nonce % 256n)); // Take lowest byte for distribution test
        }

        // Chi-square test for uniformity
        const bins = new Array(256).fill(0);
        for (const sample of samples) {
            bins[sample]++;
        }

        const expected = sampleCount / 256;
        let chiSquare = 0;
        for (const observed of bins) {
            chiSquare += Math.pow(observed - expected, 2) / expected;
        }

        // Chi-square critical value for 255 degrees of freedom at 0.05 significance
        const criticalValue = 293.2478; // Approximate

        const passed = chiSquare < criticalValue;
        
        console.log(`   Chi-square statistic: ${chiSquare.toFixed(2)}`);
        console.log(`   Critical value (0.05): ${criticalValue}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'} - Randomness is ${passed ? 'uniform' : 'non-uniform'}`);

        return {
            chiSquare,
            criticalValue,
            passed,
            samples: samples.slice(0, 10) // First 10 samples for inspection
        };
    }
}

// Singleton instance
let entropyCollectorInstance = null;

/**
 * Get or create entropy collector instance
 */
export function getEntropyCollector() {
    if (!entropyCollectorInstance && typeof window !== 'undefined') {
        entropyCollectorInstance = new EntropyCollector();
    }
    return entropyCollectorInstance;
}
