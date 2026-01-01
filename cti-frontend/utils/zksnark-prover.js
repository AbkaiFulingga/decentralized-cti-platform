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

// Circom circuit depth is fixed at build time (see `circuits/contributor-proof.circom` -> `ContributorProof(20)`).
// The backend tree builder may choose to build a smaller tree (e.g., depth 8) for speed.
// In that case, we MUST pad the proof/indices up to CIRCUIT_LEVELS so witness generation succeeds.
const CIRCUIT_LEVELS = CONFIG.MERKLE_TREE_LEVELS;

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
    if (!tree || typeof tree !== 'object') {
      console.warn('Validator: tree is null or not an object');
      return false;
    }
    
    if (!this.isValidHexString(tree.root)) {
      console.warn('Validator: invalid root:', tree.root);
      return false;
    }
    
    // ✅ FIX: Support both array formats:
    // - Simple array: ["0x123...", "0x456..."]
    // - Object array: [{address: "0x123...", leafIndex: 0, isRealContributor: true}, ...]
    if (!this.isNonEmptyArray(tree.contributors)) {
      console.warn('Validator: contributors not a non-empty array:', tree.contributors);
      return false;
    }
    
    // Validate first contributor element format
    const firstContributor = tree.contributors[0];
    if (typeof firstContributor === 'string') {
      // Simple string array format (legacy)
      if (!this.isValidEthereumAddress(firstContributor)) {
        console.warn('Validator: first contributor not valid address (string format):', firstContributor);
        return false;
      }
    } else if (typeof firstContributor === 'object' && firstContributor !== null) {
      // Object array format (current) - check if it has address field
      if (!firstContributor.address || !this.isValidEthereumAddress(firstContributor.address)) {
        console.warn('Validator: first contributor missing or invalid address (object format):', firstContributor);
        return false;
      }
    } else {
      // Invalid format
      console.warn('Validator: first contributor has invalid format (not string or object):', typeof firstContributor, firstContributor);
      return false;
    }
    
    // ✅ FIX: Make proofs optional for compatibility (will fail later if actually needed)
    if (tree.proofs !== undefined && !this.isNonEmptyArray(tree.proofs)) {
      console.warn('Validator: proofs exists but is not a non-empty array:', tree.proofs);
      return false;
    }
    
    // ✅ FIX: Accept contributorCount as number or calculate from array
    if (tree.contributorCount !== undefined && typeof tree.contributorCount !== 'number') {
      console.warn('Validator: contributorCount exists but not a number:', tree.contributorCount, typeof tree.contributorCount);
      return false;
    }
    
    // If no contributorCount field, calculate it from contributors array
    if (tree.contributorCount === undefined) {
      console.log('Validator: contributorCount not provided, will use contributors.length');
    }
    
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

    // NOTE: Do not pre-initialize snarkjs at module load / construction time.
    // This avoids noisy runtime errors on pages that import this module, but don't
    // actually need zkSNARK functionality immediately.
    // snarkjs will be loaded lazily via _ensureSnarkjs() when a proof is generated.
  }

  /**
   * Initialize snarkjs library (async, cached)
   * ✅ FIX: Proper async initialization, no race conditions
   */
  async _initializeSnarkjs() {
    if (this.snarkjs) return this.snarkjs;

    // zkSNARK proving must only run in the browser.
    // If this gets called during SSR / RSC evaluation, fail fast with a clear message.
    if (typeof window === 'undefined') {
      throw new Error('snarkjs initialization attempted on the server (SSR). Anonymous proving is browser-only.');
    }

    // Avoid dynamic `import('snarkjs')` in Next dev (can trigger encode-uri-path `.split` crash).
    // Instead, rely on CommonJS `require` which webpack/Next safely bundles.
    // This is still browser-only (guarded above).
    let snarkjs;
    try {
      // eslint-disable-next-line global-require
      snarkjs = require('snarkjs');
    } catch (e) {
      throw new Error(`snarkjs require() failed: ${e?.message || String(e)}`);
    }

    if (!snarkjs?.groth16?.fullProve || !snarkjs?.groth16?.verify) {
      throw new Error('snarkjs loaded but API surface is missing (groth16.fullProve/verify)');
    }

    this.snarkjs = snarkjs;
    return this.snarkjs;
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
   * Compute Poseidon(2) "zero subtree" roots for padding a shorter Merkle proof
   * (e.g. depth 8) up to the circuit's fixed depth (e.g. 20).
   *
   * z[0] = 0
   * z[i+1] = H(z[i], z[i])
   */
  async _getZeroSubtreeRoots(levels = CIRCUIT_LEVELS) {
    const poseidon = await this.buildPoseidon();
    const F = poseidon.F;

    const zeros = [0n];
    for (let i = 0; i < levels; i++) {
      const prev = zeros[i];
      const out = poseidon([prev, prev]);
      zeros.push(BigInt(F.toString(out)));
    }
    return zeros;
  }

  /**
   * Compute a Poseidon Merkle root in JS using the same left/right selection
   * as the circom `MerkleTreeInclusionProof` template.
   *
   * Circuit logic per level i:
   *   if pathIndex == 0: hash(left=current, right=pathElement)
   *   if pathIndex == 1: hash(left=pathElement, right=current)
   */
  async _computeMerkleRootFromProof({ leaf, pathElements, pathIndices }) {
    const poseidon = await this.buildPoseidon();

    let cur = ethers.toBigInt(leaf);
    const n = Math.min(pathElements.length, pathIndices.length);

    for (let i = 0; i < n; i++) {
      const sib = ethers.toBigInt(pathElements[i]);
      const idx = Number(pathIndices[i]);
      if (idx !== 0 && idx !== 1) {
        throw new Error(`Invalid Merkle path index at depth ${i}: ${pathIndices[i]} (expected 0/1)`);
      }

      const left = idx === 0 ? cur : sib;
      const right = idx === 0 ? sib : cur;

      const out = poseidon([left, right]);
      const outDec = poseidon.F.toString(out);
      cur = BigInt(outDec);
    }

    return cur; // BigInt (field element)
  }

  /**
   * The anonymity circuit hashes the private `address` into the Merkle leaf as:
   *   leaf = Poseidon(1)(address)
   * See `circuits/contributor-proof.circom` -> `leafHasher = Poseidon(1)`.
   */
  async _computeCircuitLeafFromAddress(addressBigInt) {
    const poseidon = await this.buildPoseidon();
    const out = poseidon([addressBigInt]);
    return BigInt(poseidon.F.toString(out));
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
      
      // ✅ FIX: Robust validation with detailed error reporting
      if (!Validator.isValidContributorTree(result)) {
        // Debug: Show what's actually wrong
        const debugInfo = {
          hasRoot: !!result.root,
          rootValid: Validator.isValidHexString(result.root),
          hasContributors: !!result.contributors,
          contributorsIsArray: Array.isArray(result.contributors),
          contributorsLength: result.contributors?.length || 0,
          firstContributorType: result.contributors?.[0] ? typeof result.contributors[0] : 'undefined',
          firstContributor: result.contributors?.[0],
          hasProofs: !!result.proofs,
          proofsIsArray: Array.isArray(result.proofs),
          proofsLength: result.proofs?.length || 0,
          hasContributorCount: typeof result.contributorCount === 'number',
          contributorCount: result.contributorCount
        };
        console.error('Tree validation failed. Debug info:', debugInfo);
        throw new Error(`Invalid tree structure received from API. Debug: ${JSON.stringify(debugInfo, null, 2)}`);
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
    
    // Prefer the precomputed `pathIndices` from the Poseidon tree builder.
    // However, we've seen some environments produce `pathIndices` that are missing
    // or degenerate (e.g. all zeros). In those cases, deterministically derive the
    // indices from the leaf index (low-bit first) to match circuit orientation.
    const normalizeBits = (bits) =>
      bits
        .map((v) => (typeof v === 'bigint' ? Number(v) : Number(v)))
        .map((n) => (n ? 1 : 0));

    const derivedIndices = (() => {
      const bits = [];
      let idx = leafIndex;
      for (let i = 0; i < ZKSnarkProver.MERKLE_TREE_LEVELS; i++) {
        bits.push(Number(idx & 1));
        idx = idx >> 1;
      }
      return normalizeBits(bits);
    })();

    const providedIndices = Array.isArray(proofData.pathIndices)
      ? normalizeBits(proofData.pathIndices)
      : null;

    // If provided indices are missing OR clearly suspicious (all zeros), override.
    // For a single-leaf set, the correct indices are all 0 anyway, so this is safe.
    // For multi-leaf trees, this restores correct left/right orientation.
    const shouldDerive =
      !providedIndices ||
      providedIndices.length === 0 ||
      (providedIndices.length > 0 && providedIndices.every((b) => b === 0));

    const pathIndices = shouldDerive ? derivedIndices : providedIndices;
    
    // ✅ FIX: Validate all required fields exist
    const result = {
      pathElements: proofData.proof,
      pathIndices: pathIndices,
      // New schema: proof includes `leaf` directly. Legacy schema: tree may include `leaves[]`.
      leaf: proofData.leaf ?? this.contributorTree.leaves?.[leafIndex],
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

    // Helpful warning when server emits smaller trees than the circuit expects.
    // This is OK as long as we pad to CIRCUIT_LEVELS during witness generation.
    if (result.pathElements.length !== CIRCUIT_LEVELS) {
      logger.warn(
        `⚠️  Merkle proof depth (${result.pathElements.length}) does not match circuit depth (${CIRCUIT_LEVELS}). ` +
          'The prover will pad with zeros. If witness generation fails, regenerate the contributor tree or rebuild the circuit.'
      );
    }
    
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

      // The circuit expects fixed-size arrays of length CIRCUIT_LEVELS.
      // However, the backend can emit shorter proofs (e.g. depth 8). We'll pad deterministically.
      const proofDepth = merkleProofData.pathElements.length;

  // Compute the circuit leaf (Poseidon(address)) — this is what the circuit uses internally.
  const circuitLeaf = await this._computeCircuitLeafFromAddress(addressBigInt);

      if (!Array.isArray(merkleProofData.pathIndices) || merkleProofData.pathIndices.length === 0) {
        throw new Error(
          'Merkle path indices missing from contributor tree proof. ' +
            'Rebuild the contributor tree JSON so each proof includes `pathIndices`.'
        );
      }

      if (proofDepth === 0) {
        throw new Error('Merkle proof is empty. Rebuild the contributor tree JSON.');
      }

      // Convert Merkle proof (siblings) to BigInt for internal checks.
      const paddedProof = merkleProofData.pathElements.map((p) => {
        try {
          return ethers.toBigInt(p);
        } catch (error) {
          throw new Error(`Invalid path element: ${p}`);
        }
      });

      // Indices should exist; we keep them aligned with siblings.
      const paddedIndices = [...merkleProofData.pathIndices];

      // Truncate if a backend ever emits more than the circuit supports.
      if (paddedProof.length > CIRCUIT_LEVELS) paddedProof.splice(CIRCUIT_LEVELS);
      if (paddedIndices.length > CIRCUIT_LEVELS) paddedIndices.splice(CIRCUIT_LEVELS);

      // Pad up to the circuit depth.
      // IMPORTANT: We can't pad sibling hashes with literal 0.
      // In a Poseidon Merkle tree, the sibling above the real depth is the root of an
      // all-zero subtree and must be computed as:
      //   z[0]=0, z[i+1]=Poseidon(z[i], z[i])
      // Otherwise the circuit recomputed root will not match.
      const zeroSubtreeRoots = await this._getZeroSubtreeRoots(CIRCUIT_LEVELS);
      while (paddedProof.length < CIRCUIT_LEVELS) {
        const level = paddedProof.length; // 0-based level index
        paddedProof.push(zeroSubtreeRoots[level]);
        // For the padded region our branch is always on the left (index 0)
        // because we padded leaves by appending zeros.
        paddedIndices.push(0);
      }

      // If the backend proofDepth is shorter, we should also ensure indices are padded.
      while (paddedIndices.length < CIRCUIT_LEVELS) {
        paddedIndices.push(0);
      }

      // ✅ Extra diagnostic: recompute root exactly like the circuit does.
      // If this fails, the circom assert at line ~97 is guaranteed to fail too.
      const jsComputedRoot = await this._computeMerkleRootFromProof({
        // The circuit proves inclusion of leafHasher(address) (Poseidon(1)).
        // Some older/newer tree JSONs may include `leaf`, but that value can be
        // either:
        //   - raw address (legacy) OR
        //   - Poseidon(address) (desired)
        // To stay correct w.r.t the circuit, always use the circuitLeaf here.
        leaf: circuitLeaf,
        // IMPORTANT: recompute using only the real proof depth, not padded zeros.
        pathElements: paddedProof.slice(0, proofDepth),
        pathIndices: paddedIndices.slice(0, proofDepth)
      });
      const expectedRoot = ethers.toBigInt(contributorTreeRoot);
      if (jsComputedRoot !== expectedRoot) {
        const computedHex = '0x' + jsComputedRoot.toString(16).padStart(64, '0');
        throw new Error(
          'Merkle proof does not verify (JS recompute mismatch). ' +
          'This will trigger circom assert at merkleRoot === merkleChecker.root.\n' +
          `  computedRoot: ${computedHex}\n` +
          `  expectedRoot: ${contributorTreeRoot}\n` +
          `  note: likely pathIndices order/bit-endianness or proof element ordering mismatch.`
        );
      }
      
      // ✅ FIX: Validate all circuit inputs before proof generation
      if (paddedProof.length !== CIRCUIT_LEVELS) {
        throw new Error(`Invalid proof length: ${paddedProof.length} (expected ${CIRCUIT_LEVELS})`);
      }

      if (paddedIndices.length !== CIRCUIT_LEVELS) {
        throw new Error(`Invalid indices length: ${paddedIndices.length} (expected ${CIRCUIT_LEVELS})`);
      }

      const circuitInputs = {
        // Public inputs
        // NOTE: snarkjs + circom witness calculator expects inputs as
        // JSON-serializable values (string/number/array). Passing BigInt can
        // trigger subtle runtime issues depending on bundler/polyfills.
        // Use decimal strings consistently.
        commitment: ethers.toBigInt(commitment).toString(),
        merkleRoot: ethers.toBigInt(contributorTreeRoot).toString(),
        
        // Private inputs
        address: addressBigInt.toString(),
        nonce: nonce.toString(),
        merkleProof: paddedProof.map(p => p.toString()),
        merklePathIndices: paddedIndices.map((v) => Number(v))
      };

      logger.info('   ✅ Circuit inputs validated');
      logger.log(
        `   - Proof depth: ${proofDepth} (padded to ${CIRCUIT_LEVELS})\n` +
        `   - Indices sample: ${paddedIndices.slice(0, 6).join(', ')}\n` +
        `   - Root (hex): ${contributorTreeRoot}\n` +
        `   - Root (dec): ${circuitInputs.merkleRoot}`
      );

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
