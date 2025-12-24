// components/AnalyticsDashboard.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';
import { smartQueryEvents } from '../utils/infura-helpers';

export default function AnalyticsDashboard() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [l1Stats, setL1Stats] = useState(null);
  const [l2Stats, setL2Stats] = useState(null);
  const [combinedStats, setCombinedStats] = useState(null);
  const [topContributors, setTopContributors] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [iocTypeBreakdown, setIocTypeBreakdown] = useState({});
  const [error, setError] = useState('');
  const [loadingProgress, setLoadingProgress] = useState('');

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
      loadAllAnalytics();
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
        console.error('Connection check failed:', error);
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
    }
  };

  const loadStatsFromNetwork = async (network) => {
    try {
      setLoadingProgress(`Analyzing ${network.name}...`);
      
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      // ✅ CORRECT ABI matching your actual contract
      const registryABI = [
        "function getPlatformStats() external view returns (uint256 totalBatches, uint256 totalAccepted, uint256 publicBatches, uint256 anonymousBatches, uint256 totalPublicContrib, uint256 totalAnonContrib, uint256 totalStaked)",
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
      ];
      
      const registry = new ethers.Contract(
        network.contracts.registry,
        registryABI,
        provider
      );
      
      const stats = await registry.getPlatformStats();
      const countBigInt = await registry.getBatchCount();
      const count = Number(countBigInt);
      
      // ✅ Parse according to ACTUAL contract return values
      const totalBatches = Number(stats[0]);
      const totalAccepted = Number(stats[1]);
      const publicBatches = Number(stats[2]);
      const anonymousBatches = Number(stats[3]);
      const totalPublicContributors = Number(stats[4]);
      const totalAnonContributors = Number(stats[5]);
      const totalStakedWei = stats[6];
      
      const pendingBatches = totalBatches - totalAccepted;
      
      // Fetch event CIDs first
      const batchAddedFilter = registry.filters.BatchAdded();
      const events = await smartQueryEvents(registry, batchAddedFilter, 0, 'latest', provider, network.deploymentBlock);
      const cidMap = {};
      events.forEach(event => {
        const batchIndex = Number(event.args.index);
        cidMap[batchIndex] = event.args.cid;
      });
      
      // Calculate total IOCs by fetching from IPFS using actual CIDs (not commitments)
      let totalIOCs = 0;
      for (let i = 0; i < Math.min(count, 20); i++) {
        try {
          const cid = cidMap[i];
          
          // Skip if no CID or if it's a hex string (commitment, not actual IPFS CID)
          if (!cid || cid.startsWith('0x') || cid.length < 10) {
            continue;
          }
          
          const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
          const result = await response.json();
          if (result.success && result.data.iocs) {
            totalIOCs += result.data.iocs.length;
          }
        } catch (error) {
          console.error(`Error counting IOCs in batch ${i}`);
        }
      }
      
      const networkStats = {
        network: network.name,
        totalBatches: totalBatches,
        totalIOCs: totalIOCs,
        totalContributors: totalPublicContributors + totalAnonContributors,
        publicContributors: totalPublicContributors,
        anonContributors: totalAnonContributors,
        totalStaked: ethers.formatEther(totalStakedWei),
        approvedBatches: totalAccepted,
        pendingBatches: pendingBatches,
        publicBatches: publicBatches,
        anonymousBatches: anonymousBatches
      };
      
      console.log(`✅ Loaded stats from ${network.name}:`, networkStats);
      return networkStats;
      
    } catch (error) {
      console.error(`Error loading stats from ${network.name}:`, error);
      return null;
    }
  };

  const loadTopContributors = async () => {
    try {
      setLoadingProgress('Loading top contributors...');
      
      const contributors = new Map();
      
      for (const network of [NETWORKS.sepolia, NETWORKS.arbitrumSepolia]) {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        
        const registryABI = [
          "function getBatchCount() public view returns (uint256)",
          "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)"
        ];
        
        const registry = new ethers.Contract(
          network.contracts.registry,
          registryABI,
          provider
        );
        
        const countBigInt = await registry.getBatchCount();
        const count = Number(countBigInt);
        
        for (let i = 0; i < count; i++) {
          try {
            const batch = await registry.getBatch(i);
            const contributorHash = batch[4];
            
            if (!contributors.has(contributorHash)) {
              contributors.set(contributorHash, {
                hash: contributorHash,
                submissions: 0,
                approvedSubmissions: 0,
                totalConfirmations: 0,
                networks: new Set()
              });
            }
            
            const contrib = contributors.get(contributorHash);
            contrib.submissions++;
            contrib.networks.add(network.name);
            contrib.totalConfirmations += Number(batch[6]);
            if (batch[3]) contrib.approvedSubmissions++;
            
          } catch (error) {
            console.error(`Error loading batch ${i}:`, error.message);
          }
        }
      }
      
      const topList = Array.from(contributors.values())
        .sort((a, b) => b.totalConfirmations - a.totalConfirmations)
        .slice(0, 10)
        .map((c, idx) => ({
          rank: idx + 1,
          ...c,
          networks: Array.from(c.networks)
        }));
      
      setTopContributors(topList);
      
    } catch (error) {
      console.error('Error loading top contributors:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      setLoadingProgress('Loading recent activity...');
      
      const activity = [];
      
      for (const network of [NETWORKS.sepolia, NETWORKS.arbitrumSepolia]) {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        
        const registryABI = [
          "function getBatchCount() public view returns (uint256)",
          "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
          "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
        ];
        
        const registry = new ethers.Contract(
          network.contracts.registry,
          registryABI,
          provider
        );
        
        const countBigInt = await registry.getBatchCount();
        const count = Number(countBigInt);
        const recentCount = Math.min(count, 10);
        
        // Query events to get CIDs with smart chunked queries
        console.log(`📊 Fetching events for ${network.name}...`);
        const batchAddedFilter = registry.filters.BatchAdded();
        const events = await smartQueryEvents(registry, batchAddedFilter, 0, 'latest', provider, network.deploymentBlock);
        console.log(`✅ Fetched ${events.length} events from ${network.name}`);
        
        const cidMap = {};
        events.forEach(event => {
          const batchIndex = Number(event.args.index);
          cidMap[batchIndex] = event.args.cid;
        });
        
        for (let i = count - 1; i >= count - recentCount && i >= 0; i--) {
          try {
            const batch = await registry.getBatch(i);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const cid = cidMap[i];
            let iocCount = 0;
            
            // Only fetch from IPFS if we have a valid CID
            if (cid && !cid.startsWith('0x')) {
              try {
                const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
                const result = await response.json();
                
                if (result.success && result.data.iocs) {
                  iocCount = result.data.iocs.length;
                }
              } catch (error) {
                console.log(`⚠️ Could not fetch IOC count for batch ${i}:`, error.message);
              }
            } else {
              console.log(`⚠️ No valid CID found for batch ${i} (cidCommitment: ${batch.cidCommitment.slice(0, 10)}...)`);
            }
            
            activity.push({
              batchId: i,
              network: network.name,
              networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
              timestamp: Number(batch.timestamp),
              approved: batch.accepted,
              iocCount: iocCount,
              confirmations: Number(batch.confirmations)
            });
          } catch (error) {
            console.error(`Error loading batch ${i}:`, error.message);
          }
        }
      }
      
      setRecentActivity(activity.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15));
      
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const analyzeIOCTypes = async () => {
    try {
      setLoadingProgress('Analyzing IOC types...');
      
      const types = {
        domains: 0,
        ips: 0,
        hashes: 0,
        urls: 0,
        other: 0
      };
      
      for (const network of [NETWORKS.sepolia, NETWORKS.arbitrumSepolia]) {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        
        const registryABI = [
          "function getBatchCount() public view returns (uint256)",
          "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)"
        ];
        
        const registry = new ethers.Contract(
          network.contracts.registry,
          registryABI,
          provider
        );
        
        const countBigInt = await registry.getBatchCount();
        const count = Number(countBigInt);
        
        for (let i = 0; i < count; i++) {
          try {
            const batch = await registry.getBatch(i);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const response = await fetch(`/api/ipfs-fetch?cid=${batch[0]}`);
            const result = await response.json();
            
            if (result.success && result.data.iocs) {
              result.data.iocs.forEach(ioc => {
                if (/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/.test(ioc)) {
                  types.ips++;
                } else if (/^[a-f0-9]{32,64}$/i.test(ioc)) {
                  types.hashes++;
                } else if (/^https?:\/\//.test(ioc)) {
                  types.urls++;
                } else if (/\.[a-z]{2,}$/i.test(ioc)) {
                  types.domains++;
                } else {
                  types.other++;
                }
              });
            }
          } catch (error) {
            console.error(`Error analyzing batch ${i}:`, error.message);
          }
        }
      }
      
      setIocTypeBreakdown(types);
      
    } catch (error) {
      console.error('Error analyzing IOC types:', error);
    }
  };

  const loadAllAnalytics = async () => {
    setLoading(true);
    setError('');
    setLoadingProgress('Starting...');
    
    try {
      const [sepoliaStats, arbitrumStats] = await Promise.all([
        loadStatsFromNetwork(NETWORKS.sepolia),
        loadStatsFromNetwork(NETWORKS.arbitrumSepolia)
      ]);
      
      setL1Stats(sepoliaStats);
      setL2Stats(arbitrumStats);
      
      if (sepoliaStats && arbitrumStats) {
        setCombinedStats({
          totalBatches: sepoliaStats.totalBatches + arbitrumStats.totalBatches,
          totalIOCs: sepoliaStats.totalIOCs + arbitrumStats.totalIOCs,
          totalContributors: sepoliaStats.totalContributors + arbitrumStats.totalContributors,
          totalStaked: (parseFloat(sepoliaStats.totalStaked) + parseFloat(arbitrumStats.totalStaked)).toFixed(4),
          approvedBatches: sepoliaStats.approvedBatches + arbitrumStats.approvedBatches,
          pendingBatches: sepoliaStats.pendingBatches + arbitrumStats.pendingBatches
        });
      }
      
      await Promise.all([
        loadTopContributors(),
        loadRecentActivity(),
        analyzeIOCTypes()
      ]);
      
      setLoadingProgress('Complete!');
      
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">📊 Platform Analytics</h2>
            <p className="text-gray-400">Cross-chain threat intelligence statistics</p>
          </div>
          
          <button
            onClick={loadAllAnalytics}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {!walletConnected ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400">Connect MetaMask to view platform analytics</p>
            </div>
            
            <button
              onClick={connectWallet}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Connect MetaMask Wallet
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">{loadingProgress}</p>
            <p className="text-gray-500 text-sm mt-2">This may take a minute...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                ❌ {error}
              </div>
            )}

            {combinedStats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl border border-purple-700/50 p-4">
                  <div className="text-purple-400 text-3xl mb-2">📦</div>
                  <p className="text-3xl font-bold text-white">{combinedStats.totalBatches}</p>
                  <p className="text-gray-400 text-sm">Total Batches</p>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl border border-blue-700/50 p-4">
                  <div className="text-blue-400 text-3xl mb-2">🎯</div>
                  <p className="text-3xl font-bold text-white">{combinedStats.totalIOCs}</p>
                  <p className="text-gray-400 text-sm">Total IOCs</p>
                </div>

                <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl border border-green-700/50 p-4">
                  <div className="text-green-400 text-3xl mb-2">👥</div>
                  <p className="text-3xl font-bold text-white">{combinedStats.totalContributors}</p>
                  <p className="text-gray-400 text-sm">Contributors</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-xl border border-yellow-700/50 p-4">
                  <div className="text-yellow-400 text-3xl mb-2">💰</div>
                  <p className="text-3xl font-bold text-white">{parseFloat(combinedStats.totalStaked).toFixed(2)}</p>
                  <p className="text-gray-400 text-sm">ETH Staked</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-xl border border-emerald-700/50 p-4">
                  <div className="text-emerald-400 text-3xl mb-2">✅</div>
                  <p className="text-3xl font-bold text-white">{combinedStats.approvedBatches}</p>
                  <p className="text-gray-400 text-sm">Approved</p>
                </div>

                <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl border border-orange-700/50 p-4">
                  <div className="text-orange-400 text-3xl mb-2">⏳</div>
                  <p className="text-3xl font-bold text-white">{combinedStats.pendingBatches}</p>
                  <p className="text-gray-400 text-sm">Pending</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {l1Stats && (
                <div className="bg-gray-900/50 rounded-xl border border-blue-700/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">🌐</span>
                    <h3 className="text-xl font-bold text-white">Ethereum Sepolia (L1)</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Batches:</span>
                      <span className="text-white font-bold">{l1Stats.totalBatches}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total IOCs:</span>
                      <span className="text-blue-400 font-bold">{l1Stats.totalIOCs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Contributors:</span>
                      <span className="text-purple-400 font-bold">{l1Stats.totalContributors}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Public:</span>
                      <span className="text-blue-400 font-bold">{l1Stats.publicContributors}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Anonymous:</span>
                      <span className="text-purple-400 font-bold">{l1Stats.anonContributors}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Approved:</span>
                      <span className="text-emerald-400 font-bold">{l1Stats.approvedBatches}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Pending:</span>
                      <span className="text-orange-400 font-bold">{l1Stats.pendingBatches}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Staked:</span>
                      <span className="text-yellow-400 font-bold">{parseFloat(l1Stats.totalStaked).toFixed(3)} ETH</span>
                    </div>
                  </div>
                </div>
              )}

              {l2Stats && (
                <div className="bg-gray-900/50 rounded-xl border border-purple-700/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">⚡</span>
                    <h3 className="text-xl font-bold text-white">Arbitrum Sepolia (L2)</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Batches:</span>
                      <span className="text-white font-bold">{l2Stats.totalBatches}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total IOCs:</span>
                      <span className="text-blue-400 font-bold">{l2Stats.totalIOCs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Contributors:</span>
                      <span className="text-purple-400 font-bold">{l2Stats.totalContributors}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Public:</span>
                      <span className="text-blue-400 font-bold">{l2Stats.publicContributors}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Anonymous:</span>
                      <span className="text-purple-400 font-bold">{l2Stats.anonContributors}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Approved:</span>
                      <span className="text-emerald-400 font-bold">{l2Stats.approvedBatches}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Pending:</span>
                      <span className="text-orange-400 font-bold">{l2Stats.pendingBatches}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Staked:</span>
                      <span className="text-yellow-400 font-bold">{parseFloat(l2Stats.totalStaked).toFixed(3)} ETH</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {Object.keys(iocTypeBreakdown).length > 0 && (
              <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">🎯 IOC Type Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-950/50 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">🌐</div>
                    <p className="text-2xl font-bold text-blue-400">{iocTypeBreakdown.domains || 0}</p>
                    <p className="text-gray-400 text-sm">Domains</p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">📍</div>
                    <p className="text-2xl font-bold text-green-400">{iocTypeBreakdown.ips || 0}</p>
                    <p className="text-gray-400 text-sm">IP Addresses</p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">🔐</div>
                    <p className="text-2xl font-bold text-purple-400">{iocTypeBreakdown.hashes || 0}</p>
                    <p className="text-gray-400 text-sm">Hashes</p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">🔗</div>
                    <p className="text-2xl font-bold text-yellow-400">{iocTypeBreakdown.urls || 0}</p>
                    <p className="text-gray-400 text-sm">URLs</p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">📋</div>
                    <p className="text-2xl font-bold text-pink-400">{iocTypeBreakdown.other || 0}</p>
                    <p className="text-gray-400 text-sm">Other</p>
                  </div>
                </div>
              </div>
            )}

            {topContributors.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">🏆 Top Contributors</h3>
                <div className="space-y-2">
                  {topContributors.map((contributor) => (
                    <div
                      key={contributor.hash}
                      className="bg-gray-950/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-900/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          contributor.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                          contributor.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                          contributor.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-700/50 text-gray-400'
                        }`}>
                          {contributor.rank === 1 ? '🥇' :
                           contributor.rank === 2 ? '🥈' :
                           contributor.rank === 3 ? '🥉' :
                           `#${contributor.rank}`}
                        </div>
                        <div>
                          <p className="text-white font-mono text-sm">
                            {contributor.hash.substring(0, 10)}...{contributor.hash.substring(58)}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {contributor.networks.map(net => (
                              <span key={net} className={`text-xs px-2 py-0.5 rounded ${
                                net.includes('Ethereum')
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}>
                                {net.includes('Ethereum') ? '🌐 L1' : '⚡ L2'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">{contributor.totalConfirmations}</p>
                        <p className="text-gray-500 text-xs">Confirmations</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {contributor.submissions} batches • {contributor.approvedSubmissions} approved
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentActivity.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">⚡ Recent Activity</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentActivity.map((activity) => (
                    <div
                      key={`${activity.network}-${activity.batchId}`}
                      className="bg-gray-950/50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-900/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{activity.networkIcon}</span>
                        <div>
                          <p className="text-white text-sm font-semibold">
                            Batch #{activity.batchId} {activity.approved && <span className="text-green-400">✓</span>}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(activity.timestamp * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-400 font-bold">{activity.iocCount}</p>
                        <p className="text-gray-500 text-xs">IOCs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 p-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl border border-purple-700/30">
              <h3 className="font-bold text-white mb-4">📈 Network Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {l1Stats && l2Stats && combinedStats && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🌐</span>
                        <p className="text-blue-300 font-semibold">Ethereum L1</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Batch Share:</span>
                          <span className="text-white font-semibold">
                            {combinedStats.totalBatches > 0 ? 
                              Math.round((l1Stats.totalBatches / combinedStats.totalBatches) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">IOC Share:</span>
                          <span className="text-white font-semibold">
                            {combinedStats.totalIOCs > 0 ? 
                              Math.round((l1Stats.totalIOCs / combinedStats.totalIOCs) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Approval Rate:</span>
                          <span className="text-green-400 font-semibold">
                            {l1Stats.totalBatches > 0 ? 
                              Math.round((l1Stats.approvedBatches / l1Stats.totalBatches) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Public Batches:</span>
                          <span className="text-blue-400 font-semibold">{l1Stats.publicBatches}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Anonymous Batches:</span>
                          <span className="text-purple-400 font-semibold">{l1Stats.anonymousBatches}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">⚡</span>
                        <p className="text-purple-300 font-semibold">Arbitrum L2</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Batch Share:</span>
                          <span className="text-white font-semibold">
                            {combinedStats.totalBatches > 0 ? 
                              Math.round((l2Stats.totalBatches / combinedStats.totalBatches) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">IOC Share:</span>
                          <span className="text-white font-semibold">
                            {combinedStats.totalIOCs > 0 ? 
                              Math.round((l2Stats.totalIOCs / combinedStats.totalIOCs) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Approval Rate:</span>
                          <span className="text-green-400 font-semibold">
                            {l2Stats.totalBatches > 0 ? 
                              Math.round((l2Stats.approvedBatches / l2Stats.totalBatches) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Public Batches:</span>
                          <span className="text-blue-400 font-semibold">{l2Stats.publicBatches}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Anonymous Batches:</span>
                          <span className="text-purple-400 font-semibold">{l2Stats.anonymousBatches}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 text-xl">ℹ️</span>
                <div className="text-sm text-gray-400">
                  <p className="font-semibold text-blue-300 mb-1">Real-Time Analytics</p>
                  <p>Statistics are aggregated from both Ethereum Sepolia (L1) and Arbitrum Sepolia (L2) testnets. The contract tracks public vs anonymous contributions separately. Data refreshes on page load or manual refresh.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
