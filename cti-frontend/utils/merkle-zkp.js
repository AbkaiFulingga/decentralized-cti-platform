// utils/merkle-zkp.js
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'ethers';

export class MerkleZKProver {
  constructor() {
    this.contributorTree = null;
    this.treeData = null;
    this.loaded = false;
  }
  
  /**
   * Load contributor Merkle tree from backend API
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadContributorTree() {
    try {
      console.log('📡 Loading contributor Merkle tree...');
      
      const response = await fetch('/api/contributor-tree');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load tree');
      }
      
      this.treeData = result;
      
      // Reconstruct Merkle tree from leaves
      const leaves = this.treeData.leaves.map(leaf => Buffer.from(leaf.slice(2), 'hex'));
      this.contributorTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      
      // Verify root matches
      const computedRoot = '0x' + this.contributorTree.getRoot().toString('hex');
      if (computedRoot !== this.treeData.root) {
        throw new Error('Tree root mismatch - data may be corrupted');
      }
      
      this.loaded = true;
      
      console.log('✅ Contributor tree loaded:');
      console.log(`   - ${this.treeData.contributorCount} contributors`);
      console.log(`   - Tree depth: ${this.contributorTree.getDepth()}`);
      console.log(`   - Last update: ${new Date(this.treeData.timestamp).toLocaleString()}`);
      
      // Check freshness
      const ageHours = (Date.now() - this.treeData.timestamp) / (1000 * 60 * 60);
      if (ageHours > 48) {
        console.warn(`⚠️  Tree is ${ageHours.toFixed(1)} hours old - may be stale`);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load contributor tree:', error);
      this.loaded = false;
      return false;
    }
  }
  
  /**
   * Generate zero-knowledge proof for anonymous submission
   * @param {string} walletAddress User's Ethereum address
   * @returns {Object} Proof data for contract submission
   */
  generateProof(walletAddress) {
    if (!this.loaded || !this.contributorTree) {
      throw new Error('Contributor tree not loaded - call loadContributorTree() first');
    }
    
    // Generate leaf from address
    const leaf = keccak256(walletAddress.toLowerCase());
    const leafHex = '0x' + leaf.toString('hex');
    
    // Check if address is in the tree
    const leafIndex = this.treeData.leaves.indexOf(leafHex);
    if (leafIndex === -1) {
      throw new Error('Address not found in contributor tree - you may need to wait for next tree update');
    }
    
    console.log(`✅ Found address at leaf index ${leafIndex}`);
    
    // Generate Merkle proof
    const proof = this.contributorTree.getHexProof(leaf);
    
    console.log(`✅ Generated proof with ${proof.length} hashes`);
    
    // Generate unique commitment (prevents replay attacks)
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const timestamp = Date.now();
    
    const commitment = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'bytes32', 'uint256'],
        [leafHex, secret, timestamp]
      )
    );
    
    console.log('✅ Generated commitment:', commitment);
    
    return {
      commitment: commitment,
      proof: proof,
      leaf: leafHex,
      secret: secret,
      timestamp: timestamp,
      anonymitySetSize: this.treeData.contributorCount,
      treeAge: Date.now() - this.treeData.timestamp
    };
  }
  
  /**
   * Verify proof locally before submitting to blockchain
   * @param {Array} proof Merkle proof array
   * @param {string} leaf Leaf to verify
   * @param {string} root Expected Merkle root
   * @returns {boolean} True if proof is valid
   */
  verifyProofLocally(proof, leaf, root) {
    if (!this.contributorTree) {
      return false;
    }
    
    const leafBuffer = Buffer.from(leaf.slice(2), 'hex');
    const rootBuffer = Buffer.from(root.slice(2), 'hex');
    
    return this.contributorTree.verify(proof, leafBuffer, rootBuffer);
  }
  
  /**
   * Get anonymity set size (how many contributors you're hidden among)
   * @returns {number} Number of contributors in tree
   */
  getAnonymitySetSize() {
    return this.treeData?.contributorCount || 0;
  }
  
  /**
   * Get tree freshness info
   * @returns {Object} Age and staleness information
   */
  getTreeFreshness() {
    if (!this.treeData) {
      return { age: 0, isStale: true, lastUpdate: null };
    }
    
    const ageMs = Date.now() - this.treeData.timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);
    const isStale = ageHours > 48;
    
    return {
      age: ageMs,
      ageHours: ageHours.toFixed(1),
      isStale: isStale,
      lastUpdate: new Date(this.treeData.timestamp).toLocaleString()
    };
  }
  
  /**
   * Check if user is in current tree
   * @param {string} walletAddress Address to check
   * @returns {boolean} True if in tree
   */
  isInTree(walletAddress) {
    if (!this.treeData) return false;
    
    const leaf = '0x' + keccak256(walletAddress.toLowerCase()).toString('hex');
    return this.treeData.leaves.includes(leaf);
  }
}

// Singleton instance
export const zkProver = new MerkleZKProver();
