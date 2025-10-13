// components/PlatformDashboard.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function PlatformDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install a Web3 wallet');
        setLoading(false);
        return;
      }

      // Create fresh provider with cache-busting
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      
      // Force fresh network query
      await provider.send("eth_chainId", []);
      
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      
      console.log("=== NETWORK DEBUG ===");
      console.log("Connected Chain ID:", chainId);
      console.log("Expected Chain ID: 11155111");
      
      if (chainId !== "11155111") {
        setError(`Wrong network! Your wallet is connected to Chain ID ${chainId}. Please switch to Ethereum Sepolia (Chain ID 11155111)`);
        setLoading(false);
        return;
      }

      const registryAddress = "0xD63e502605B0B48626bF979c66B68026a35DbA36";
      const registryABI = [
        "function getPlatformStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      const result = await registry.getPlatformStats();

      console.log("=== RAW CONTRACT RESULT ===");
      console.log("result[0] (totalBatches):", result[0].toString());
      console.log("result[1] (totalAccepted):", result[1].toString());
      console.log("result[2] (publicBatches):", result[2].toString());
      console.log("result[6] (totalStaked):", ethers.formatEther(result[6]));

      setStats({
        totalBatches: Number(result[0] || 0),
        totalAccepted: Number(result[1] || 0),
        publicBatches: Number(result[2] || 0),
        anonymousBatches: Number(result[3] || 0),
        publicContributors: Number(result[4] || 0),
        anonymousContributors: Number(result[5] || 0),
        totalStaked: result[6] ? ethers.formatEther(result[6]) : "0.0"
      });

      setLoading(false);
      setError('');
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mb-12">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            Loading platform statistics...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto mb-12">
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30">
          <p className="text-red-300 whitespace-pre-wrap">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mb-12">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📊</span> Platform Statistics
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Live
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-6">
            <div className="text-blue-400 text-3xl mb-2">📦</div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalBatches}</div>
            <div className="text-sm text-gray-400">Total Batches</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl p-6">
            <div className="text-green-400 text-3xl mb-2">✅</div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalAccepted}</div>
            <div className="text-sm text-gray-400">Accepted Batches</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-6">
            <div className="text-purple-400 text-3xl mb-2">👥</div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats.publicContributors + stats.anonymousContributors}
            </div>
            <div className="text-sm text-gray-400">Total Contributors</div>
          </div>

          <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/30 rounded-xl p-6">
            <div className="text-pink-400 text-3xl mb-2">💎</div>
            <div className="text-3xl font-bold text-white mb-1">{parseFloat(stats.totalStaked).toFixed(2)}</div>
            <div className="text-sm text-gray-400">ETH Staked</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">🔒 Submission Privacy</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Public Batches</span>
                <span className="text-blue-400 font-mono font-bold">{stats.publicBatches}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Anonymous Batches</span>
                <span className="text-purple-400 font-mono font-bold">{stats.anonymousBatches}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <div 
                    className="h-2 rounded-full bg-blue-500" 
                    style={{ width: `${stats.totalBatches > 0 ? (stats.publicBatches / stats.totalBatches * 100) : 0}%` }}
                  ></div>
                  <div 
                    className="h-2 rounded-full bg-purple-500" 
                    style={{ width: `${stats.totalBatches > 0 ? (stats.anonymousBatches / stats.totalBatches * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">👤 Contributors</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Public Contributors</span>
                <span className="text-green-400 font-mono font-bold">{stats.publicContributors}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Anonymous Contributors</span>
                <span className="text-pink-400 font-mono font-bold">{stats.anonymousContributors}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-500">
                  256-bit cryptographic protection active
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
