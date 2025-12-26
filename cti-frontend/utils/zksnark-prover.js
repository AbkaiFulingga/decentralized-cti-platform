// utils/zksnark-prover.js
/**
 * Browser-based zkSNARK Proof Generation (DIRECTION1 Compliant)
 * 
 * Generates Groth16 zkSNARK proofs in the browser using snarkjs.
 * Proves that a contributor is registered without revealing their identity.
 * 
 * DIRECTION1 Requirements:
 * - Poseidon hashing for zkSNARK-friendly Merkle trees
 * - 20-level tree depth (supports 1,048,576 contributors)
 * - Browser-based proof generation (~10 seconds)
 * - Commitment = Poseidon(address, nonce)
 * 
 * Circuit Inputs:
 *   - Public: commitment (hash of address + nonce), merkleRoot
 *   - Private: address, nonce, merkleProof[], merklePathIndices[]
 * 
 * Output: Groth16 proof compatible with Groth16Verifier.sol
 */

import { ethers } from 'ethers';

// Configuration constants
const CONFIG = {
  MERKLE_TREE_LEVELS: 20,           // DIRECTION1: Supports 1M+ contributors
  TREE_STALENESS_WARNING_HOURS: 2,  // Warn if tree older than 2 hours (rebuilds every 60s)
  TREE_STALENESS_ERROR_HOURS: 48,   // Error if tree older than 48 hours
  DEBUG_LOGGING: false,              // Set to true for verbose console output
  PROOF_GENERATION_TIMEOUT_MS: 60000 // 60 second timeout
};

/**
 * Logger utility with configurable levels
 */
class Logger {
  constructor(enabled = CONFIG.DEBUG_LOGGING) {
    this.enabled = enabled;
  }

  log(...args) {
    if (this.enabled) console.log(...args);
  }

  warn(...args) {
    console.warn(...args);
  }

  error(...args) {
    console.error(...args);
  }

  info(...args) {
    console.log(...args); // Always show info
  }
}

const logger = new Logger();

/**
 * Validation utilities
 */
class Validator {
  static isValidEthereumAddress(address) {
    return typeof address === 'string' && 
           /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static isValidHexString(str) {
    return typeof str === 'string' && 
           /^0x[a-fA-F0-9]+$/.test(str);
  }

  static isNonEmptyArray(arr) {
    return Array.isArray(arr) && arr.length > 0;
  }

  static isValidContributorTree(tree) {
    if (!tree || typeof tree !== 'object') return false;
    if (!this.isValidHexString(tree.root)) return false;
    
    // ✅ FIX: Support both array formats:
    // - Simple array: ["0x123...", "0x456..."]
    // - Object array: [{address: "0x123...", leafIndex: 0, isRealContributor: true}, ...]
    if (!this.isNonEmptyArray(tree.contributors)) return false;
    
    // Validate first contributor element format
    const firstContributor = tree.contributors[0];
    if (typeof firstContributor === 'string') {
      // Simple string array format (legacy)
      if (!this.isValidEthereumAddress(firstContributor)) return false;
    } else if (typeof firstContributor === 'object' && firstContributor.address) {
      // Object array format (current)
      if (!this.isValidEthereumAddress(firstContributor.address)) return false;
    } else {
      // Invalid format
      return false;
    }
    
    if (!this.isNonEmptyArray(tree.proofs)) return false;
    if (typeof tree.contributorCount !== 'number') return false;
    return true;
  }
}

/**
 * Main zkSNARK Prover class
 */
export class ZKSnarkProver {
  // Class constants
  static MERKLE_TREE_LEVELS = CONFIG.MERKLE_TREE_LEVELS;
  static STALENESS_WARNING_HOURS = CONFIG.TREE_STALENESS_WARNING_HOURS;
  static STALENESS_ERROR_HOURS = CONFIG.TREE_STALENESS_ERROR_HOURS;

  constructor() {
    this.wasmPath = '/circuits/contributor-proof.wasm';
    this.zkeyPath = '/circuits/contributor-proof_final.zkey';
    this.vkeyPath = '/circuits/verification_key.json';
    
    this.contributorTree = null;
    this.poseidonCache = null;
    this.snarkjsPromise = null;
    
    // Pre-initialize snarkjs in browser environment
    if (typeof window !== 'undefined') {
      this.snarkjsPromise = this._initializeSnarkjs();
    }
  }

  /**
   * Initialize snarkjs library (async, cached)
   * ✅ FIX: Proper async initialization, no race conditions
   */
  async _initializeSnarkjs() {
    if (this.snarkjs) return this.snarkjs;
    
    try {
      logger.log('📦 Loading snarkjs library...');
      this.snarkjs = await import('snarkjs');
      logger.log('✅ snarkjs loaded successfully');
      return this.snarkjs;
    } catch (error) {
      logger.error('❌ Failed to load snarkjs:', error);
      throw new Error(`snarkjs initialization failed: ${error.message}`);
    }
  }

  /**
   * Ensure snarkjs is loaded before use
   */
  async _ensureSnarkjs() {
    if (!this.snarkjs) {
      await this._initializeSnarkjs();
    }
    return this.snarkjs;
  }

  /**
   * Build Poseidon hash function (same as used in circuit)
   * ✅ FIX: Proper error handling and validation
   */
  async buildPoseidon() {
    if (this.poseidonCache) {
      return this.poseidonCache;
    }
    
    try {
      logger.log('⚙️  Initializing Poseidon hash function...');
      const poseidonModule = await import('circomlibjs');
      this.poseidonCache = await poseidonModule.buildPoseidon();
      logger.log('✅ Poseidon initialized');
      return this.poseidonCache;
    } catch (error) {
      logger.error('❌ Failed to build Poseidon:', error);
      throw new Error(`Poseidon initialization failed: ${error.message}`);
    }
  }

  /**
   * Load contributor Merkle tree from backend API
   * ✅ FIX: Comprehensive validation and error handling
   */
  async loadContributorTree() {
    try {
      logger.info('📡 Loading contributor Merkle tree from /api/contributor-tree...');
      
      const response = await fetch('/api/contributor-tree');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API returned success=false');
      }
      
      // ✅ FIX: Robust validation
      if (!Validator.isValidContributorTree(result)) {
        throw new Error('Invalid tree structure received from API');
      }
      
      this.contributorTree = result;
      
      logger.info('✅ Contributor tree loaded successfully:');
      logger.info(`   - ${result.contributorCount} contributors in tree`);
      logger.info(`   - Merkle root: ${result.root}`);
      logger.info(`   - Last update: ${new Date(result.timestamp).toLocaleString()}`);
      
      // ✅ FIX: Improved freshness checking
      const ageHours = parseFloat(result.freshness?.ageHours || 0);
      if (ageHours > ZKSnarkProver.STALENESS_ERROR_HOURS) {
        throw new Error(`Tree is critically stale (${ageHours.toFixed(1)} hours old). Rebuilder may be down.`);
      } else if (ageHours > ZKSnarkProver.STALENESS_WARNING_HOURS) {
        logger.warn(`⚠️  Tree is ${ageHours.toFixed(1)} hours old (expected <2h with 60s rebuild interval)`);
      } else {
        logger.log(`✅ Tree freshness: ${ageHours.toFixed(1)} hours (good)`);
      }
      
      return true;
      
    } catch (error) {
      logger.error('❌ Failed to load contributor tree:', error);
      this.contributorTree = null;
      throw new Error(`Tree loading failed: ${error.message}`);
    }
  }

  /**
   * Check if address is in the contributor tree
   * ✅ FIX: Proper validation and type checking
   */
  isAddressInTree(address) {
    if (!this.contributorTree) {
      throw new Error('Contributor tree not loaded - call loadContributorTree() first');
    }
    
    // ✅ FIX: Validate address format
    if (!Validator.isValidEthereumAddress(address)) {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }
    
    const addressLower = address.toLowerCase();
    
    // Check if contributors array exists and is valid
    if (!Validator.isNonEmptyArray(this.contributorTree.contributors)) {
      return false;
    }
    
    // ✅ FIX: Safe iteration with type checking
    return this.contributorTree.contributors.some(contributor => {
      // Handle both object format {address: "0x..."} and string format
      if (typeof contributor === 'string') {
        return contributor.toLowerCase() === addressLower;
      }
      
      if (contributor && 
          typeof contributor.address === 'string' && 
          Validator.isValidEthereumAddress(contributor.address)) {
        return contributor.address.toLowerCase() === addressLower;
      }
      
      return false;
    });
  }

  /**
   * Get Merkle proof for an address
   * ✅ FIX: Comprehensive error handling and validation
   */
  getMerkleProof(address) {
    if (!this.contributorTree) {
      throw new Error('Contributor tree not loaded');
    }

    // ✅ FIX: Validate inputs
    if (!Validator.isValidEthereumAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }

    const normalizedAddress = address.toLowerCase();
    
    logger.log('🔍 Getting Merkle proof for:', normalizedAddress);
    
    // ✅ FIX: Proper findIndex check (returns -1 when not found, never undefined)
    const leafIndex = this.contributorTree.contributors?.findIndex(contributor => {
      const addr = typeof contributor === 'string' 
        ? contributor 
        : contributor?.address;
      return addr && addr.toLowerCase() === normalizedAddress;
    });
    
    if (leafIndex === -1) {
      logger.error('❌ Address not found in tree!');
      logger.error('   Your address:', normalizedAddress);
      logger.error('   Tree has', this.contributorTree.contributors?.length || 0, 'contributors');
      throw new Error(`Address ${normalizedAddress} not found in contributor tree`);
    }
    
    logger.log('✅ Found address at leaf index:', leafIndex);

    // ✅ FIX: Validate proofs array exists
    if (!Validator.isNonEmptyArray(this.contributorTree.proofs)) {
      throw new Error('Tree proofs array is missing or empty - tree needs rebuild');
    }
    
    // Find precomputed proof
    const proofData = this.contributorTree.proofs.find(p => {
      const proofAddr = typeof p.address === 'string' ? p.address.toLowerCase() : null;
      return p.leafIndex === leafIndex || proofAddr === normalizedAddress;
    });
    
    if (!proofData || !Validator.isNonEmptyArray(proofData.proof)) {
      throw new Error(`Proof data not found for address at index ${leafIndex}`);
    }
    
    logger.log('✅ Using precomputed Poseidon proof (depth:', proofData.proof.length, ')');
    
    // Generate path indices from leaf index (binary representation)
    const pathIndices = [];
    let idx = leafIndex;
    for (let i = 0; i < proofData.proof.length; i++) {
      pathIndices.push(idx % 2);
      idx = Math.floor(idx / 2);
    }
    
    // ✅ FIX: Validate all required fields exist
    const result = {
      pathElements: proofData.proof,
      pathIndices: pathIndices,
      leaf: this.contributorTree.leaves?.[leafIndex],
      root: this.contributorTree.root
    };
    
    // ✅ FIX: Explicit validation
    if (!Validator.isValidHexString(result.root)) {
      throw new Error('Invalid or missing tree root');
    }
    
    if (!Validator.isNonEmptyArray(result.pathElements)) {
      throw new Error('Invalid or missing path elements');
    }
    
    logger.log('✅ Merkle proof ready:', {
      pathElementsCount: result.pathElements.length,
      pathIndicesCount: result.pathIndices.length,
      root: result.root
    });
    
    return result;
  }

  /**
   * Generate Groth16 zkSNARK proof for anonymous submission
   * ✅ FIX: Comprehensive validation, timeout handling, better error messages
   * 
   * @param {string} address - Contributor's Ethereum address
   * @returns {Promise<Object>} Proof data: {pA, pB, pC, pubSignals, commitment, nonce}
   */
  async generateGroth16Proof(address) {
    const startTime = Date.now();
    
    try {
      // ✅ FIX: Ensure snarkjs is loaded (no race condition)
      const snarkjs = await this._ensureSnarkjs();
      
      // ✅ FIX: Validate prerequisites
      if (!this.contributorTree) {
        throw new Error('Contributor tree not loaded - call loadContributorTree() first');
      }
      
      if (!Validator.isValidEthereumAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }

      logger.info('🔐 Starting Groth16 zkSNARK proof generation...');
      logger.info(`   Address: ${address}`);
      logger.info(`   Anonymity set: ${this.contributorTree.contributorCount} contributors`);

      // Step 1: Get Merkle proof (with full validation)
      logger.info('📝 Step 1/5: Getting Merkle proof...');
      const merkleProofData = this.getMerkleProof(address);
      
      const contributorTreeRoot = this.contributorTree.root;
      
      // ✅ FIX: Explicit root validation
      if (!Validator.isValidHexString(contributorTreeRoot)) {
        throw new Error('Invalid contributor tree root');
      }
      
      if (merkleProofData.root.toLowerCase() !== contributorTreeRoot.toLowerCase()) {
        throw new Error(
          `Merkle root mismatch:\n` +
          `  Proof root: ${merkleProofData.root}\n` +
          `  Tree root:  ${contributorTreeRoot}`
        );
      }
      
      logger.info('   ✅ Merkle proof validated');

      // Step 2: Generate random nonce for commitment
      logger.info('🎲 Step 2/5: Generating commitment nonce...');
      let nonce;
      try {
        nonce = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
      } catch (error) {
        throw new Error(`Failed to generate nonce: ${error.message}`);
      }
      logger.log(`   ✅ Nonce: ${nonce.toString().substring(0, 20)}...`);

      // Step 3: Calculate commitment using Poseidon hash
      logger.info('🔐 Step 3/5: Computing Poseidon commitment...');
      const poseidon = await this.buildPoseidon();
      const addressBigInt = ethers.toBigInt(address);
      
      // ✅ FIX: Safe BigInt conversion with validation
      let commitment;
      try {
        const commitmentResult = poseidon([addressBigInt, nonce]);
        const commitmentHash = poseidon.F.toString(commitmentResult);
        
        // Validate hash is numeric string
        if (!/^\d+$/.test(commitmentHash)) {
          throw new Error(`Invalid Poseidon output format: ${commitmentHash}`);
        }
        
        const commitmentBigInt = BigInt(commitmentHash);
        commitment = '0x' + commitmentBigInt.toString(16).padStart(64, '0');
        
        // Ensure no truncation occurred
        if (commitment.length > 66) { // 0x + 64 chars
          throw new Error(`Commitment hash too large: ${commitment.length} chars`);
        }
        
      } catch (error) {
        throw new Error(`Commitment calculation failed: ${error.message}`);
      }
      
      logger.info(`   ✅ Commitment: ${commitment}`);

      // Step 4: Prepare circuit inputs
      logger.info('📋 Step 4/5: Preparing circuit inputs...');
      
      // ✅ FIX: Use class constant instead of magic number
      const LEVELS = ZKSnarkProver.MERKLE_TREE_LEVELS;
      
      // Convert and pad Merkle proof
      const paddedProof = merkleProofData.pathElements.map(p => {
        try {
          return ethers.toBigInt(p);
        } catch (error) {
          throw new Error(`Invalid path element: ${p}`);
        }
      });
      
      const paddedIndices = [...merkleProofData.pathIndices];
      
      // Pad with zeros to reach required depth
      while (paddedProof.length < LEVELS) {
        paddedProof.push(0n);
        paddedIndices.push(0);
      }
      
      // ✅ FIX: Validate all circuit inputs before proof generation
      if (paddedProof.length !== LEVELS) {
        throw new Error(`Invalid proof length: ${paddedProof.length} (expected ${LEVELS})`);
      }
      
      if (paddedIndices.length !== LEVELS) {
        throw new Error(`Invalid indices length: ${paddedIndices.length} (expected ${LEVELS})`);
      }

      const circuitInputs = {
        // Public inputs
        commitment: ethers.toBigInt(commitment),
        merkleRoot: ethers.toBigInt(contributorTreeRoot),
        
        // Private inputs
        address: addressBigInt,
        nonce: nonce,
        merkleProof: paddedProof.map(p => p.toString()),
        merklePathIndices: paddedIndices
      };

      logger.info('   ✅ Circuit inputs validated');
      logger.log(`   - Proof depth: ${merkleProofData.pathElements.length} (padded to ${LEVELS})`);

      // Step 5: Generate witness and proof with timeout
      logger.info('⚙️  Step 5/5: Computing witness and generating proof...');
      logger.info('   ⏱️  This typically takes 5-15 seconds...');
      
      const proofStartTime = Date.now();
      
      // ✅ FIX: Add timeout protection
      const proofPromise = snarkjs.groth16.fullProve(
        circuitInputs,
        this.wasmPath,
        this.zkeyPath
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Proof generation timeout (>${CONFIG.PROOF_GENERATION_TIMEOUT_MS}ms)`));
        }, CONFIG.PROOF_GENERATION_TIMEOUT_MS);
      });
      
      const { proof: fullProof, publicSignals } = await Promise.race([
        proofPromise,
        timeoutPromise
      ]);
      
      const proofTime = Date.now() - proofStartTime;
      logger.info(`   ✅ Proof computed in ${proofTime}ms`);

      // Step 6: Format proof for Solidity Groth16Verifier
      logger.info('📦 Formatting proof for Groth16Verifier.sol...');
      
      // ✅ FIX: Validate proof structure
      if (!fullProof || !fullProof.pi_a || !fullProof.pi_b || !fullProof.pi_c) {
        throw new Error('Invalid proof structure returned from snarkjs');
      }
      
      const pA = [fullProof.pi_a[0], fullProof.pi_a[1]];
      const pB = [
        [fullProof.pi_b[0][1], fullProof.pi_b[0][0]], // Reversed for Solidity
        [fullProof.pi_b[1][1], fullProof.pi_b[1][0]]
      ];
      const pC = [fullProof.pi_c[0], fullProof.pi_c[1]];

      logger.info('   ✅ Proof formatted for Solidity');

      // Final result
      const proofData = {
        pA,
        pB,
        pC,
        pubSignals: publicSignals,
        commitment,
        nonce: nonce.toString(),
        generationTime: proofTime,
        totalTime: Date.now() - startTime
      };

      logger.info('✅ Groth16 zkSNARK proof generation complete!');
      logger.info(`   Proof generation: ${proofTime}ms`);
      logger.info(`   Total time: ${proofData.totalTime}ms`);
      logger.info(`   Proof size: ~768 bytes (Groth16 constant)`);
      logger.info(`   Anonymity set: 1 in ${this.contributorTree.contributorCount}`);

      return proofData;

    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error('❌ zkSNARK proof generation failed:', error);
      logger.error(`   Time elapsed: ${elapsed}ms`);
      
      // Provide helpful error messages
      if (error.message.includes('not loaded')) {
        throw new Error('Setup required: Load contributor tree before generating proof');
      } else if (error.message.includes('not found')) {
        throw new Error('Address not registered: Register as contributor first');
      } else if (error.message.includes('timeout')) {
        throw new Error('Proof generation timeout: Browser may be too slow or circuit files missing');
      } else {
        throw new Error(`Proof generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Verify proof in browser before submitting (optional)
   * ✅ FIX: Better naming (was "verifyProofLocally" but fetches from network)
   */
  async verifyProofInBrowser(proof, publicSignals) {
    try {
      const snarkjs = await this._ensureSnarkjs();
      
      logger.info('🔍 Verifying proof in browser...');
      
      const vkeyResponse = await fetch(this.vkeyPath);
      if (!vkeyResponse.ok) {
        throw new Error(`Failed to load verification key: ${vkeyResponse.status}`);
      }
      
      const vkey = await vkeyResponse.json();
      
      const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      
      if (isValid) {
        logger.info('✅ Proof verified successfully!');
      } else {
        logger.error('❌ Proof verification failed!');
      }
      
      return isValid;
      
    } catch (error) {
      logger.error('❌ Browser verification error:', error);
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Get anonymity set information
   * ✅ FIX: Add validation
   */
  getAnonymitySetInfo() {
    if (!this.contributorTree) {
      return null;
    }

    const ageHours = parseFloat(this.contributorTree.freshness?.ageHours || 0);
    
    return {
      size: this.contributorTree.contributorCount,
      root: this.contributorTree.root,
      lastUpdate: new Date(this.contributorTree.timestamp).toLocaleString(),
      ageHours: ageHours,
      isStale: ageHours > ZKSnarkProver.STALENESS_WARNING_HOURS,
      isCriticallyStale: ageHours > ZKSnarkProver.STALENESS_ERROR_HOURS
    };
  }

  /**
   * Enable/disable debug logging
   */
  setDebugLogging(enabled) {
    logger.enabled = enabled;
  }
}

// Export singleton instance
export const zksnarkProver = new ZKSnarkProver();

// Export class for testing/custom instances
export default ZKSnarkProver;
