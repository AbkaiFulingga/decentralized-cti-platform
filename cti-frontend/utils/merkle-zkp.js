// utils/merkle-zkp.js
import { ethers } from 'ethers';
import { buildPoseidon } from 'circomlibjs';

export class MerkleZKProver {
  constructor() {
    this.contributorTree = null;
    this.treeData = null;
    this.loaded = false;
  }
  
  async loadContributorTree() {
    try {
      console.log('📡 Loading contributor Merkle tree...');
      
      const response = await fetch('/api/contributor-tree');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load tree');
      }
      
      this.treeData = result;
      
      console.log(`✅ Loaded tree with ${this.treeData.contributorCount || this.treeData.contributors?.length || 0} contributors`);
      console.log(`   Root: ${this.treeData.root}`);
      console.log(`   Depth: ${this.treeData.treeDepth}`);
      
      if (this.treeData.generatedAt) {
        const ageHours = (Date.now() - new Date(this.treeData.generatedAt).getTime()) / (1000 * 60 * 60);
        if (ageHours > 48) {
          console.warn(`⚠️  Tree is ${ageHours.toFixed(1)} hours old - may be stale`);
        }
      }
      
      this.loaded = true;
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load contributor tree:', error);
      this.loaded = false;
      return false;
    }
  }

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
    // Use generatedAt field for timestamp
    const timestamp = this.treeData.generatedAt ? new Date(this.treeData.generatedAt).getTime() : Date.now();
    return {
      leaf: leafHexStr,
      leafIndex: leafIdx,
      anonymitySetSize: this.treeData.contributorCount,
      treeAge: Date.now() - timestamp
    };
  }

  isInTree(walletAddress) {
    if (!this.treeData) return false;
    const lowerAddr = walletAddress.toLowerCase();
    const leafHexStr = ethers.keccak256(Buffer.from(lowerAddr, 'utf8'));
    return this.treeData.leaves.some(l => l.toLowerCase() === leafHexStr.toLowerCase());
  }

  getAnonymitySetSize() {
    return this.treeData?.contributorCount || 0;
  }

  getTreeFreshness() {
    if (!this.treeData) {
      return { age: 0, isStale: true, lastUpdate: null };
    }
    // Use generatedAt field consistently
    const timestamp = this.treeData.generatedAt ? new Date(this.treeData.generatedAt).getTime() : Date.now();
    const ageMs = Date.now() - timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);
    const isStale = ageHours > 48;
    return {
      age: ageMs,
      ageHours: ageHours.toFixed(1),
      isStale: isStale,
      lastUpdate: this.treeData.generatedAt || 'Unknown'
    };
  }
}

export const zkProver = new MerkleZKProver();
