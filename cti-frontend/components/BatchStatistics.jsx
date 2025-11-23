// components/BatchStatistics.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function BatchStatistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(typeof window !== 'undefined');
  }, []);

  useEffect(() => {
    if (isBrowser) {
      loadStatistics();
      const interval = setInterval(loadStatistics, 15000);
      return () => clearInterval(interval);
    }
  }, [isBrowser]);

  const loadStatistics = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask');
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      
      let registryAddress;
      if (chainId === "11155111") {
        registryAddress = NETWORKS.sepolia.contracts.registry;
      } else if (chainId === "421614") {
        registryAddress = NETWORKS.arbitrumSepolia.contracts.registry;
      }

      if (!registryAddress) {
        setError('Contracts not deployed on this network');
        setLoading(false);
        return;
      }

      const registryABI = [
        "function getPlatformStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256) public view returns (string, bytes32, uint256, bool, bytes32, bool, uint256, uint256)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      const platformStats = await registry.getPlatformStats();
      const batchCount = Number(platformStats[0]);

      let totalIOCs = 0;
      let avgIOCsPerBatch = 0;

      // Fetch IOC counts from IPFS
      for (let i = 0; i < batchCount && i < 20; i++) { // Limit to 20 recent batches for performance
        try {
          const batch = await registry.getBatch(i);
          const response = await fetch(`https://gateway.pinata.cloud/ipfs/${batch[0]}`);
          const iocData = await response.json();
          const count = iocData.iocs ? iocData.iocs.length : 0;
          totalIOCs += count;
        } catch (error) {
          console.log(`Could not fetch batch ${i}`);
        }
      }

      avgIOCsPerBatch = batchCount > 0 ? Math.round(totalIOCs / batchCount) : 0;

      setStats({
        totalBatches: Number(platformStats[0]),
        totalAccepted: Number(platformStats[1]),
        publicBatches: Number(platformStats[2]),
        anonymousBatches: Number(platformStats[3]),
        publicContributors: Number(platformStats[4]),
        anonymousContributors: Number(platformStats[5]),
        totalStaked: ethers.formatEther(platformStats[6]),
        totalIOCs: totalIOCs,
        avgIOCsPerBatch: avgIOCsPerBatch
      });

      setLoading(false);
      setError('');
    } catch (err) {
      console.error('Statistics error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (!isBrowser) {
    return <div className="max-w-6xl mx-auto mb-12"><div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50"><p className="text-gray-400 text-center">Loading...</p></div></div>;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mb-12">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            Loading statistics...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto mb-12">
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30">
          <p className="text-red-300 text-center">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mb-12">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Batch Statistics
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Live
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-6">
            <div className="text-blue-400 text-3xl mb-2">📦</div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalBatches}</div>
            <div className="text-sm text-gray-400">Total Batches</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl p-6">
            <div className="text-green-400 text-3xl mb-2">✅</div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalAccepted}</div>
            <div className="text-sm text-gray-400">Accepted</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-6">
            <div className="text-purple-400 text-3xl mb-2">🔢</div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalIOCs}</div>
            <div className="text-sm text-gray-400">Total IOCs</div>
          </div>

          <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/30 rounded-xl p-6">
            <div className="text-pink-400 text-3xl mb-2">📊</div>
            <div className="text-3xl font-bold text-white mb-1">{stats.avgIOCsPerBatch}</div>
            <div className="text-sm text-gray-400">Avg IOCs/Batch</div>
          </div>
        </div>

      </div>
    </div>
  );
}
