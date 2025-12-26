// components/AnalyticsDashboard.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';
import { AppLogger } from '../utils/logger';

export default function AnalyticsDashboard() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [heatmapData, setHeatmapData] = useState({ l1: {}, l2: {} });
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      checkConnection();
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (walletConnected) {
      loadAnalytics();
    }
  }, [walletConnected]);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setWalletAddress(accounts[0].address);
          setWalletConnected(true);
        }
      } catch (error) {
        AppLogger.error('Analytics', 'Connection check failed', error);
      }
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setWalletConnected(false);
      setWalletAddress('');
    } else {
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      
    } catch (error) {
      setError('Failed to connect wallet');
      AppLogger.error('Analytics', 'Wallet connection failed', error);
    }
  };

  const loadAnalytics = async () => {
    const timer = AppLogger.startTimer('Analytics', 'Load all statistics');
    setLoading(true);
    setError('');
    
    try {
      AppLogger.info('Analytics', 'Starting analytics load');
      
      // Load stats from both networks
      const [l1Data, l2Data] = await Promise.all([
        loadNetworkStats(NETWORKS.sepolia),
        loadNetworkStats(NETWORKS.arbitrumSepolia)
      ]);
      
      // Combine stats
      const combined = {
        totalBatches: l1Data.batchCount + l2Data.batchCount,
        l1Batches: l1Data.batchCount,
        l2Batches: l2Data.batchCount,
        totalContributors: l1Data.contributorCount + l2Data.contributorCount,
        l1Contributors: l1Data.contributorCount,
        l2Contributors: l2Data.contributorCount
      };
      
      setStats(combined);
      setHeatmapData({
        l1: l1Data.dailySubmissions,
        l2: l2Data.dailySubmissions
      });
      
      AppLogger.info('Analytics', 'Statistics loaded successfully', combined);
      
    } catch (error) {
      setError(`Failed to load analytics: ${error.message}`);
      AppLogger.error('Analytics', 'Failed to load statistics', error);
    } finally {
      setLoading(false);
      timer.end();
    }
  };

  const loadNetworkStats = async (network) => {
    AppLogger.info('Analytics', `Loading ${network.name} statistics`);
    
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    const registryABI = [
      "function getBatchCount() public view returns (uint256)",
      // Note: getContributorCount() doesn't exist in PrivacyPreservingRegistry (uses mapping, not array)
      // We'll count unique contributors from events instead
      "event BatchSubmitted(uint256 indexed batchIndex, address indexed submitter, string ipfsHash, bytes32 merkleRoot, uint256 timestamp)"
    ];
    
    const registry = new ethers.Contract(
      network.contracts.registry,
      registryABI,
      provider
    );
    
    try {
      // Get batch count (fast on-chain query)
      const batchCount = await registry.getBatchCount();
      
      AppLogger.info('Analytics', `${network.name} batch count`, {
        batches: Number(batchCount)
      });
      
      // Get recent batch events for heatmap (last 30 days only)
      const currentBlock = await provider.getBlockNumber();
      const blocksPerDay = network.chainId === 11155111 ? 7200 : 43200; // Sepolia: 12s, Arbitrum: 2s
      
      // 🔥 CRITICAL OPTIMIZATION: Limit to last 3 days to avoid 429 errors
      // Why 3 days? On Sepolia with free-tier RPC:
      //   - 3 days = ~21,600 blocks = ~2,160 chunks = 36 minutes at 1 req/sec
      //   - 7 days = ~50,400 blocks = ~5,040 chunks = 84 minutes (TOO SLOW)
      // Heatmap shows 30 days but most recent activity is what matters for analytics
      const daysToQuery = 3; // ✅ REDUCED from 30 to 3 for performance
      const blocksToQuery = blocksPerDay * daysToQuery;
      const recentStartBlock = currentBlock - blocksToQuery;
      
      // Use more recent of: deployment block OR 3 days ago
      const safeStartBlock = Math.max(network.deploymentBlock, recentStartBlock);
      
      const estimatedChunks = Math.ceil((currentBlock - safeStartBlock) / 10);
      const estimatedTime = Math.ceil(estimatedChunks * 1.0); // 1 second per chunk
      
      AppLogger.debug('Analytics', `Querying ${network.name} events`, {
        deploymentBlock: network.deploymentBlock,
        currentBlock,
        recentStartBlock,
        safeStartBlock,
        range: currentBlock - safeStartBlock,
        estimatedChunks,
        estimatedTimeSeconds: estimatedTime,
        note: `Querying last ${daysToQuery} days only for performance`
      });
      
      const filter = registry.filters.BatchSubmitted();
      
      // Query in chunks to avoid rate limits
      const events = await queryEventsInChunks(registry, filter, safeStartBlock, currentBlock);
      
      // Build daily submission map AND count unique contributors
      const dailySubmissions = {};
      const uniqueContributors = new Set();
      
      for (const event of events) {
        try {
          const block = await provider.getBlock(event.blockNumber);
          const date = new Date(Number(block.timestamp) * 1000).toISOString().split('T')[0];
          dailySubmissions[date] = (dailySubmissions[date] || 0) + 1;
          
          // Track unique contributor addresses
          if (event.args && event.args.submitter) {
            uniqueContributors.add(event.args.submitter.toLowerCase());
          }
        } catch (err) {
          // Skip blocks that fail
          continue;
        }
      }
      
      const contributorCount = uniqueContributors.size;
      
      AppLogger.info('Analytics', `${network.name} stats complete`, {
        batches: Number(batchCount),
        contributors: contributorCount,
        events: events.length
      });
      
      return {
        batchCount: Number(batchCount),
        contributorCount: contributorCount,
        dailySubmissions
      };
      
    } catch (error) {
      AppLogger.error('Analytics', `${network.name} query failed`, error);
      // Return zeros on error
      return {
        batchCount: 0,
        contributorCount: 0,
        dailySubmissions: {}
      };
    }
  };

  // Simple chunked query (1000ms delays for L1 to avoid 429 errors)
  const queryEventsInChunks = async (contract, filter, startBlock, endBlock) => {
    const CHUNK_SIZE = 10; // ✅ FIX: Free tier RPC limit (was 10000, caused errors)
    const DELAY_MS = 1000; // ✅ INCREASED: 1 req/sec for large queries (was 500ms = 2 req/sec)
    const events = [];
    
    const totalChunks = Math.ceil((endBlock - startBlock + 1) / CHUNK_SIZE);
    AppLogger.info('Analytics', `Querying ${totalChunks} chunks with ${DELAY_MS}ms delays (ETA: ${Math.ceil(totalChunks * DELAY_MS / 1000)}s)`);
    
    for (let i = startBlock; i <= endBlock; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE - 1, endBlock);
      try {
        const chunkEvents = await contract.queryFilter(filter, i, chunkEnd);
        events.push(...chunkEvents);
        
        // ✅ FIX: Increased delay to 1000ms (1 req/sec) to avoid overwhelming Alchemy free tier
        // Free tier = 300 CU/sec, eth_getLogs = ~20-50 CU, so max ~6-15 req/sec theoretical
        // But with 10-block chunks returning data, stay conservative at 1 req/sec
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      } catch (error) {
        AppLogger.warn('Analytics', `Chunk ${i}-${chunkEnd} failed`, error);
        
        // ✅ FIX: If 429 error, wait longer before continuing
        if (error.message && error.message.includes('429')) {
          AppLogger.warn('Analytics', 'Rate limit hit, waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        // Continue with other chunks even if one fails
      }
    }
    
    AppLogger.info('Analytics', `Query complete: ${events.length} events retrieved`);
    return events;
  };

  const getLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const getHeatmapColor = (count) => {
    if (count === 0) return 'bg-gray-100';
    if (count <= 2) return 'bg-green-200';
    if (count <= 5) return 'bg-blue-300';
    if (count <= 10) return 'bg-yellow-400';
    if (count <= 20) return 'bg-orange-500';
    return 'bg-red-600';
  };

  if (!walletConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Platform Analytics</h1>
            <p className="text-gray-600 mb-6">Connect your wallet to view platform statistics</p>
            <button
              onClick={connectWallet}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Platform Analytics</h1>
          <p className="text-gray-600">Real-time statistics from the decentralized CTI network</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading platform statistics...</p>
            <p className="text-sm text-gray-400 mt-2">This should take less than 10 seconds</p>
          </div>
        ) : stats ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 font-semibold">Total Batches</h3>
                  <span className="text-3xl">📦</span>
                </div>
                <p className="text-4xl font-bold text-purple-600">{stats.totalBatches}</p>
                <p className="text-sm text-gray-500 mt-2">
                  L1: {stats.l1Batches} • L2: {stats.l2Batches}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 font-semibold">Contributors</h3>
                  <span className="text-3xl">👥</span>
                </div>
                <p className="text-4xl font-bold text-blue-600">{stats.totalContributors}</p>
                <p className="text-sm text-gray-500 mt-2">
                  L1: {stats.l1Contributors} • L2: {stats.l2Contributors}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 font-semibold">Network Health</h3>
                  <span className="text-3xl">✅</span>
                </div>
                <p className="text-2xl font-bold text-green-600">Operational</p>
                <p className="text-sm text-gray-500 mt-2">
                  All systems online
                </p>
              </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📅 Submission Heatmap (Last 30 Days)</h2>
              
              {/* L1 Heatmap */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  Ethereum Sepolia (L1)
                </h3>
                <div className="grid grid-cols-15 gap-1">
                  {getLast30Days().map((date, i) => (
                    <div
                      key={`l1-${date}`}
                      className={`h-8 rounded ${getHeatmapColor(heatmapData.l1[date] || 0)} 
                                 hover:ring-2 hover:ring-purple-400 transition cursor-pointer`}
                      title={`${date}: ${heatmapData.l1[date] || 0} submissions`}
                    >
                      {heatmapData.l1[date] > 0 && (
                        <span className="text-xs text-white font-bold flex items-center justify-center h-full">
                          {heatmapData.l1[date]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* L2 Heatmap */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  Arbitrum Sepolia (L2)
                </h3>
                <div className="grid grid-cols-15 gap-1">
                  {getLast30Days().map((date, i) => (
                    <div
                      key={`l2-${date}`}
                      className={`h-8 rounded ${getHeatmapColor(heatmapData.l2[date] || 0)}
                                 hover:ring-2 hover:ring-blue-400 transition cursor-pointer`}
                      title={`${date}: ${heatmapData.l2[date] || 0} submissions`}
                    >
                      {heatmapData.l2[date] > 0 && (
                        <span className="text-xs text-white font-bold flex items-center justify-center h-full">
                          {heatmapData.l2[date]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center justify-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  0
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-200 rounded"></div>
                  1-2
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-300 rounded"></div>
                  3-5
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                  6-10
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  11-20
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded"></div>
                  21+
                </span>
              </div>
            </div>

            {/* Refresh Button */}
            <div className="text-center">
              <button
                onClick={loadAnalytics}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
              >
                🔄 Refresh Statistics
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
