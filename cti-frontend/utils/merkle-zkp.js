// utils/merkle-zkp.js
import { ethers } from 'ethers';
import { buildPoseidon } from 'circomlibjs';

// Helper to build a Poseidon Merkle tree (simple JS version)
function poseidonHash(left, right, poseidon) {
  return poseidon([
    BigInt('0x' + left.toString('hex')),
    BigInt('0x' + right.toString('hex'))
  ]);
}
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
          // Reconstruct Merkle tree from leaves using Poseidon
          const poseidon = await buildPoseidon();
          const leaves = this.treeData.leaves.map(leaf => Buffer.from(leaf.slice(2), 'hex'));
          let currentLevel = leaves;
          let treeDepth = this.treeData.treeDepth;
          for (let level = 0; level < treeDepth; level++) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
              const left = currentLevel[i];
              const right = currentLevel[i + 1] || Buffer.alloc(left.length);
              const hash = poseidonHash(left, right, poseidon);
              // Convert BigInt to Buffer
              const hashBuf = Buffer.from(hash.toString(16).padStart(64, '0'), 'hex');
              nextLevel.push(hashBuf);
            }
            currentLevel = nextLevel;
          }
          const computedRoot = '0x' + currentLevel[0].toString('hex');
          if (computedRoot !== this.treeData.root) {
            throw new Error('Tree root mismatch - data may be corrupted');
          }
      
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
        const lowerAddr = walletAddress.toLowerCase();
        const leafHexStr = ethers.keccak256(Buffer.from(lowerAddr, 'utf8'));
        const leafBuf = Buffer.from(leafHexStr.slice(2), 'hex');
        const leafIdx = this.treeData.leaves.findIndex(l => l.toLowerCase() === leafHexStr.toLowerCase());
        if (leafIdx === -1) {
          throw new Error('Address not found in contributor tree - you may need to wait for next tree update');
        }
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
    const lowerAddr = walletAddress.toLowerCase();
    const leafHexStr = ethers.keccak256(Buffer.from(lowerAddr, 'utf8'));
    return this.treeData.leaves.some(l => l.toLowerCase() === leafHexStr.toLowerCase());
  }
}

// Poseidon Merkle tree utilities for Next.js frontend
import { ethers } from 'ethers';
import { buildPoseidon } from 'circomlibjs';

function poseidonHash(left, right, poseidon) {
  return poseidon([
    BigInt('0x' + left.toString('hex')),
    BigInt('0x' + right.toString('hex'))
  ]);
}

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
      // Reconstruct Merkle tree from leaves using Poseidon
      const poseidon = await buildPoseidon();
      const leaves = this.treeData.leaves.map(leaf => Buffer.from(leaf.slice(2), 'hex'));
      let currentLevel = leaves;
      let treeDepth = this.treeData.treeDepth;
      for (let level = 0; level < treeDepth; level++) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
          const left = currentLevel[i];
          const right = currentLevel[i + 1] || Buffer.alloc(left.length);
          const hash = poseidonHash(left, right, poseidon);
          const hashBuf = Buffer.from(hash.toString(16).padStart(64, '0'), 'hex');
          nextLevel.push(hashBuf);
        }
        currentLevel = nextLevel;
      }
      const computedRoot = '0x' + currentLevel[0].toString('hex');
      if (computedRoot !== this.treeData.root) {
        throw new Error('Tree root mismatch - data may be corrupted');
      }
      // Check freshness
      const ageHours = (Date.now() - this.treeData.timestamp) / (1000 * 60 * 60);
      if (ageHours > 48) {
        console.warn(`⚠️  Tree is ${ageHours.toFixed(1)} hours old - may be stale`);
      }
      this.loaded = true;
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
    if (!this.loaded) {
      throw new Error('Contributor tree not loaded - call loadContributorTree() first');
    }
    const lowerAddr = walletAddress.toLowerCase();
    const leafHexStr = ethers.keccak256(Buffer.from(lowerAddr, 'utf8'));
    const leafIdx = this.treeData.leaves.findIndex(l => l.toLowerCase() === leafHexStr.toLowerCase());
    if (leafIdx === -1) {
      throw new Error('Address not found in contributor tree - you may need to wait for next tree update');
    }
    // Proof generation logic would go here (if needed)
    // For now, just return the leaf and index
    return {
      leaf: leafHexStr,
      leafIndex: leafIdx,
      anonymitySetSize: this.treeData.contributorCount,
      treeAge: Date.now() - this.treeData.timestamp
    };
  }

  /**
   * Check if user is in current tree
   * @param {string} walletAddress Address to check
   * @returns {boolean} True if in tree
   */
  isInTree(walletAddress) {
    if (!this.treeData) return false;
    const lowerAddr = walletAddress.toLowerCase();
    const leafHexStr = ethers.keccak256(Buffer.from(lowerAddr, 'utf8'));
    return this.treeData.leaves.some(l => l.toLowerCase() === leafHexStr.toLowerCase());
  }

  /**
   * Get anonymity set size
   */
  getAnonymitySetSize() {
    return this.treeData?.contributorCount || 0;
  }

  /**
   * Get tree freshness info
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
}

export const zkProver = new MerkleZKProver();
