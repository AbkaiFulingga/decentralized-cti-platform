// utils/zksnark-prover.js
/**
 * Browser-based zkSNARK Proof Generation
 * 
 * This module generates Groth16 zkSNARK proofs in the browser using snarkjs.
 * Proves that a contributor is registered without revealing their identity.
 * 
 * Circuit Inputs:
 *   - Public: commitment (hash of address + nonce), merkleRoot
 *   - Private: address, nonce, merkleProof[], merklePathIndices[]
 * 
 * Output: Groth16 proof compatible with Groth16Verifier.sol
 */

import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

// Dynamic import for snarkjs (only works in browser)
let snarkjs = null;
if (typeof window !== 'undefined') {
  import('snarkjs').then(module => {
    snarkjs = module;
  }).catch(err => {
    console.error('Failed to load snarkjs:', err);
  });
}

export class ZKSnarkProver {
  constructor() {
    this.wasmPath = '/circuits/contributor-proof.wasm';
    this.zkeyPath = '/circuits/contributor-proof_final.zkey';
    this.circuitLoaded = false;
    this.contributorTree = null;
    this.poseidonCache = null;
  }

  /**
   * Build Poseidon hash function (same as used in circuit)
   * Caches the result for performance
   */
  async buildPoseidon() {
    if (this.poseidonCache) {
      return this.poseidonCache;
    }
    
    // Use poseidon from circomlibjs (same library used by circuits)
    const poseidonModule = await import('circomlibjs');
    this.poseidonCache = await poseidonModule.buildPoseidon();
    return this.poseidonCache;
  }

  /**
   * Load contributor Merkle tree from backend API
   * Required before proof generation to get Merkle proof
   */
  async loadContributorTree() {
    try {
      console.log('📡 Loading contributor Merkle tree...');
      
      const response = await fetch('/api/contributor-tree');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load tree');
      }
      
      this.contributorTree = result;
      
      console.log('✅ Contributor tree loaded:');
      console.log(`   - ${result.contributorCount} contributors in tree`);
      console.log(`   - Contributors:`, result.contributors);
      console.log(`   - Merkle root: ${result.root}`);
      console.log(`   - Last update: ${new Date(result.timestamp).toLocaleString()}`);
      
      // Check freshness
      const ageHours = parseFloat(result.freshness?.ageHours || 0);
      if (ageHours > 48) {
        console.warn(`⚠️  Tree is ${ageHours.toFixed(1)} hours old - may be stale`);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load contributor tree:', error);
      return false;
    }
  }

  /**
   * Check if address is in the contributor tree
   */
  isAddressInTree(address) {
    if (!this.contributorTree) {
      throw new Error('Contributor tree not loaded');
    }
    
    // Convert address to leaf format (lowercase, then hash with Poseidon would be done in circuit)
    // For now, check if address hash exists in leaves
    const addressLower = address.toLowerCase();
    
    // The leaves are stored as hashes, so we need to check if our address hash matches
    // In production, this should use the same hash function as the circuit (Poseidon)
    // For now, we use keccak256 as a placeholder
    const leaf = ethers.keccak256(ethers.toUtf8Bytes(addressLower));
    
    return this.contributorTree.leaves.includes(leaf);
  }

  /**
   * Get Merkle proof for an address
   * Uses Poseidon hash (same as circuit) to reconstruct tree
   * Returns the path elements and indices needed for circuit
   */
  async getMerkleProof(address) {
    if (!this.contributorTree) {
      throw new Error('Contributor tree not loaded');
    }

    const addressBigInt = ethers.toBigInt(address);
    const addressHex = '0x' + addressBigInt.toString(16).padStart(64, '0');
    
    console.log('🔍 Debug getMerkleProof:');
    console.log('   Address:', address);
    console.log('   Address as BigInt:', addressBigInt.toString());
    console.log('   Tree leaves:', this.contributorTree.leaves);
    console.log('   Tree contributors:', this.contributorTree.contributors);
    
    // Find leaf index
    const leafIndex = this.contributorTree.leaves.indexOf(addressHex.toLowerCase());
    if (leafIndex === -1) {
      console.error('❌ Address not found!');
      console.error('   Your address:', address);
      console.error('   Addresses in tree:', this.contributorTree.contributors);
      throw new Error('Address not found in contributor tree');
    }

    // Use precomputed proof from tree data (tree was built with Poseidon)
    if (this.contributorTree.proofs && this.contributorTree.proofs[leafIndex]) {
      const proofData = this.contributorTree.proofs[leafIndex];
      console.log('✅ Using precomputed Poseidon proof');
      return {
        proof: proofData.proof,
        pathIndices: proofData.pathIndices,
        leaf: proofData.leaf,
        root: this.contributorTree.root
      };
    }

    throw new Error('Proof not found in tree data - tree needs to be rebuilt with proofs');
  }

  /**
   * Generate Groth16 zkSNARK proof for anonymous submission
   * 
   * @param {string} address - Contributor's Ethereum address
   * @returns {Promise<Object>} Proof data: {pA, pB, pC, pubSignals, commitment}
   */
  async generateGroth16Proof(address) {
    // Load snarkjs dynamically if not already loaded
    if (!snarkjs) {
      console.log('📦 Loading snarkjs library...');
      snarkjs = await import('snarkjs');
      console.log('✅ snarkjs loaded');
    }

    if (!this.contributorTree) {
      throw new Error('Contributor tree not loaded - call loadContributorTree() first');
    }

    console.log('🔐 Starting Groth16 zkSNARK proof generation...');
    console.log(`   Address: ${address}`);
    console.log(`   Contributor tree root: ${this.contributorTree.root}`);

    try {
      // Step 1: Get Merkle proof
      console.log('📝 Step 1: Getting Merkle proof...');
      const merkleProofData = this.getMerkleProof(address);
      
      console.log(`   ✅ Leaf: ${merkleProofData.leaf}`);
      console.log(`   ✅ Proof elements: ${merkleProofData.proof.length}`);
      console.log(`   ✅ Root: ${merkleProofData.root}`);

      // ✅ FIX: Use contributor tree root from loaded tree data
      const contributorTreeRoot = this.contributorTree.root;
      console.log(`   ✅ Contributor tree root: ${contributorTreeRoot}`);
      
      // Verify root matches
      if (merkleProofData.root.toLowerCase() !== contributorTreeRoot.toLowerCase()) {
        throw new Error(`Merkle root mismatch: ${merkleProofData.root} vs ${contributorTreeRoot}`);
      }

      // Step 2: Generate random nonce for commitment
      console.log('🎲 Step 2: Generating commitment nonce...');
      const nonce = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
      console.log(`   ✅ Nonce: ${nonce.toString().substring(0, 20)}...`);

      // Step 3: Calculate commitment using Poseidon hash
      // Commitment = Poseidon(address, nonce)
      console.log('🔐 Step 3: Computing Poseidon commitment...');
      const addressBigInt = ethers.toBigInt(address);
      
      // Use Poseidon hash from snarkjs (same as circuit)
      const poseidon = await this.buildPoseidon();
      const commitmentHash = poseidon.F.toString(poseidon([addressBigInt, nonce]));
      const commitment = '0x' + BigInt(commitmentHash).toString(16).padStart(64, '0');
      
      console.log(`   ✅ Commitment: ${commitment}`);

      // Step 4: Prepare circuit inputs
      console.log('📋 Step 3: Preparing circuit inputs...');
      
      // Pad Merkle proof to 20 levels (circuit expects fixed-size arrays)
      const MERKLE_TREE_LEVELS = 20;
      const paddedProof = merkleProofData.proof.map(p => ethers.toBigInt(p));
      const paddedIndices = merkleProofData.pathIndices;
      
      // Pad with zeros to reach required depth
      while (paddedProof.length < MERKLE_TREE_LEVELS) {
        paddedProof.push(0n);
        paddedIndices.push(0);
      }

      const circuitInputs = {
        // Public inputs
        commitment: ethers.toBigInt(commitment),
        merkleRoot: ethers.toBigInt(contributorTreeRoot), // ✅ FIX: Use contributorTreeRoot
        
        // Private inputs
        address: addressBigInt,
        nonce: nonce,
        merkleProof: paddedProof.map(p => p.toString()),
        merklePathIndices: paddedIndices
      };

      console.log('   ✅ Circuit inputs prepared');
      console.log(`   - Address: ${circuitInputs.address.toString().substring(0, 20)}...`);
      console.log(`   - Nonce: ${circuitInputs.nonce.toString().substring(0, 20)}...`);
      console.log(`   - Merkle proof depth: ${merkleProofData.proof.length}`);

      // Step 5: Generate witness
      console.log('⚙️  Step 4: Computing witness (calculating circuit)...');
      console.log('   ⏱️  This may take 5-10 seconds...');
      
      const startWitness = Date.now();
      
      const { proof: fullProof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInputs,
        this.wasmPath,
        this.zkeyPath
      );
      
      const witnessTime = Date.now() - startWitness;
      console.log(`   ✅ Witness computed in ${witnessTime}ms`);

      // Step 6: Format proof for Solidity
      console.log('📦 Step 5: Formatting proof for Groth16Verifier.sol...');
      
      const pA = [fullProof.pi_a[0], fullProof.pi_a[1]];
      const pB = [
        [fullProof.pi_b[0][1], fullProof.pi_b[0][0]], // Note: reversed order for Solidity
        [fullProof.pi_b[1][1], fullProof.pi_b[1][0]]
      ];
      const pC = [fullProof.pi_c[0], fullProof.pi_c[1]];

      console.log('   ✅ Proof formatted');
      console.log(`   - pA: [${pA[0].substring(0, 20)}..., ${pA[1].substring(0, 20)}...]`);
      console.log(`   - pB: 2x2 matrix`);
      console.log(`   - pC: [${pC[0].substring(0, 20)}..., ${pC[1].substring(0, 20)}...]`);
      console.log(`   - Public signals: ${publicSignals.length}`);

      // Step 7: Return formatted proof
      const proofData = {
        pA,
        pB,
        pC,
        pubSignals: publicSignals,
        commitment,
        nonce: nonce.toString(),
        generationTime: witnessTime
      };

      console.log('✅ Groth16 zkSNARK proof generation complete!');
      console.log(`   Total time: ${witnessTime}ms`);
      console.log(`   Proof size: ~768 bytes (Groth16)`);
      console.log(`   Anonymity set: ${this.contributorTree.contributorCount} contributors`);

      return proofData;

    } catch (error) {
      console.error('❌ zkSNARK proof generation failed:', error);
      throw new Error(`Proof generation failed: ${error.message}`);
    }
  }

  /**
   * Verify proof locally before submitting (optional)
   * Requires verification_key.json to be available
   */
  async verifyProofLocally(proof, publicSignals) {
    if (!snarkjs) {
      throw new Error('snarkjs not available');
    }

    try {
      console.log('🔍 Verifying proof locally...');
      
      const vkeyResponse = await fetch('/circuits/verification_key.json');
      const vkey = await vkeyResponse.json();
      
      const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      
      if (isValid) {
        console.log('✅ Proof verified successfully!');
      } else {
        console.error('❌ Proof verification failed!');
      }
      
      return isValid;
      
    } catch (error) {
      console.error('❌ Local verification error:', error);
      return false;
    }
  }

  /**
   * Get anonymity set information
   */
  getAnonymitySetInfo() {
    if (!this.contributorTree) {
      return null;
    }

    return {
      size: this.contributorTree.contributorCount,
      root: this.contributorTree.root,
      lastUpdate: new Date(this.contributorTree.timestamp).toLocaleString(),
      ageHours: parseFloat(this.contributorTree.freshness?.ageHours || 0),
      isStale: this.contributorTree.freshness?.isStale || false
    };
  }
}

// Export singleton instance
export const zksnarkProver = new ZKSnarkProver();
