// components/OracleFeedDisplay.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function OracleFeedDisplay() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [feedStats, setFeedStats] = useState({});
  const [recentBatches, setRecentBatches] = useState([]);
  const [expandedFeed, setExpandedFeed] = useState(null);
  const [error, setError] = useState('');

  const FEED_INFO = {
    'AbuseIPDB': {
      icon: '🛡️',
      color: 'blue',
      description: 'IP addresses reported for malicious activity',
      website: 'https://www.abuseipdb.com'
    },
    'URLhaus': {
      icon: '🔗',
      color: 'red',
      description: 'Malware distribution sites and malicious URLs',
      website: 'https://urlhaus.abuse.ch'
    },
    'MalwareBazaar': {
      icon: '🦠',
      color: 'purple',
      description: 'Malware sample hashes and indicators',
      website: 'https://bazaar.abuse.ch'
    },
    'PhishTank': {
      icon: '🎣',
      color: 'orange',
      description: 'Verified phishing websites and scam domains',
      website: 'https://www.phishtank.com'
    }
  };

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
      loadOracleFeeds();
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

  const loadOracleFeeds = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new ethers.JsonRpcProvider(NETWORKS.arbitrumSepolia.rpcUrl);
      
      const oracleABI = [
        "function getActiveFeeds() external view returns (string[] memory)",
        "function getFeedInfo(string memory feedName) external view returns (string name, uint256 lastUpdate, uint256 totalUpdates, uint256 totalIOCs, bool active)",
        "function getFeedBatches(string memory feedName) external view returns (uint256[] memory)"
      ];
      
      const oracleContract = new ethers.Contract(
        NETWORKS.arbitrumSepolia.contracts.oracleFeed,
        oracleABI,
        provider
      );
      
      const activeFeedNames = await oracleContract.getActiveFeeds();
      console.log(`Loading ${activeFeedNames.length} oracle feeds...`);
      
      const feedsData = [];
      const stats = {};
      
      for (const feedName of activeFeedNames) {
        try {
          const info = await oracleContract.getFeedInfo(feedName);
          const batchIds = await oracleContract.getFeedBatches(feedName);
          
          const feedData = {
            name: info[0],
            lastUpdate: Number(info[1]),
            lastUpdateFormatted: info[1] > 0 ? new Date(Number(info[1]) * 1000).toLocaleString() : 'Never',
            totalUpdates: Number(info[2]),
            totalIOCs: Number(info[3]),
            active: info[4],
            batchCount: batchIds.length,
            ...FEED_INFO[feedName]
          };
          
          feedsData.push(feedData);
          stats[feedName] = feedData;
          
        } catch (error) {
          console.error(`Error loading feed ${feedName}:`, error.message);
        }
      }
      
      setFeeds(feedsData);
      setFeedStats(stats);
      
      await loadRecentOracleBatches();
      
      console.log(`✅ Loaded ${feedsData.length} oracle feeds`);
      
    } catch (error) {
      console.error('Error loading oracle feeds:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentOracleBatches = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(NETWORKS.arbitrumSepolia.rpcUrl);
      
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        // Modern registry returns CID commitment + plaintext ipfsCID
        // (anonymous batches won't have a usable ipfsCID)
        "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, string ipfsCID, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)"
      ];
      
      const registry = new ethers.Contract(
        NETWORKS.arbitrumSepolia.contracts.registry,
        registryABI,
        provider
      );
      
      const countBigInt = await registry.getBatchCount();
      const count = Number(countBigInt);
      
      const recent = [];
      const oracleHashes = [
        ethers.keccak256(ethers.toUtf8Bytes('ORACLE_AbuseIPDB')),
        ethers.keccak256(ethers.toUtf8Bytes('ORACLE_URLhaus')),
        ethers.keccak256(ethers.toUtf8Bytes('ORACLE_MalwareBazaar')),
        ethers.keccak256(ethers.toUtf8Bytes('ORACLE_PhishTank'))
      ];
      
      for (let i = count - 1; i >= Math.max(0, count - 20); i--) {
        try {
          const batch = await registry.getBatch(i);
          
          // contributorHash is a bytes32 hex string in ethers v6
          if (oracleHashes.includes(batch[5])) {
            const ipfsCID = batch[1];

            // Oracle submissions should be public and include an ipfsCID.
            // If it's missing, skip showing it in the “Recent Oracle Updates” list.
            if (!ipfsCID || ipfsCID === '0x00') {
              continue;
            }

            const response = await fetch(`/api/ipfs-fetch?cid=${encodeURIComponent(ipfsCID)}`);
            const result = await response.json();
            
            let feedName = 'Unknown';
            if (result.success && result.data.metadata?.feedName) {
              feedName = result.data.metadata.feedName;
            }
            
            recent.push({
              batchId: i,
              feedName: feedName,
              icon: FEED_INFO[feedName]?.icon || '📊',
              timestamp: Number(batch[3]),
              timestampFormatted: new Date(Number(batch[3]) * 1000).toLocaleString(),
              approved: batch[4],
              iocCount: result.success ? result.data.iocs.length : 0,
              cid: ipfsCID
            });
          }
        } catch (error) {
          console.error(`Error loading batch ${i}:`, error.message);
        }
      }
      
      setRecentBatches(recent);
      
    } catch (error) {
      console.error('Error loading recent oracle batches:', error);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-900/30 to-blue-800/20 border-blue-700/50',
      red: 'from-red-900/30 to-red-800/20 border-red-700/50',
      purple: 'from-purple-900/30 to-purple-800/20 border-purple-700/50',
      orange: 'from-orange-900/30 to-orange-800/20 border-orange-700/50'
    };
    return colors[color] || colors.blue;
  };

  const timeSinceUpdate = (lastUpdate) => {
    if (lastUpdate === 0) return 'Never';
    
    const now = Math.floor(Date.now() / 1000);
    const diff = now - lastUpdate;
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    return `${minutes}m ago`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">📡 Oracle Threat Feeds</h2>
            <p className="text-gray-400">Automated threat intelligence from trusted sources</p>
          </div>
          
          <button
            onClick={loadOracleFeeds}
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
              <p className="text-gray-400">Connect MetaMask to view oracle feeds</p>
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
            <p className="text-gray-400">Loading oracle feeds from Arbitrum L2...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                ❌ {error}
              </div>
            )}

            {/* Feed Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {feeds.map((feed) => (
                <div
                  key={feed.name}
                  className={`bg-gradient-to-br ${getColorClasses(feed.color)} rounded-xl border p-6 cursor-pointer hover:scale-105 transition-all`}
                  onClick={() => setExpandedFeed(expandedFeed === feed.name ? null : feed.name)}
                >
                  <div className="text-4xl mb-3">{feed.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feed.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total IOCs:</span>
                      <span className="text-white font-bold">{feed.totalIOCs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Updates:</span>
                      <span className="text-white font-bold">{feed.totalUpdates}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Update:</span>
                      <span className="text-green-400 font-semibold text-xs">
                        {timeSinceUpdate(feed.lastUpdate)}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`mt-3 px-2 py-1 rounded text-xs font-semibold text-center ${
                    feed.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {feed.active ? '🟢 Active' : '🔴 Inactive'}
                  </div>
                </div>
              ))}
            </div>

            {/* Expanded Feed Details */}
            {expandedFeed && feedStats[expandedFeed] && (
              <div className="mb-6 bg-gray-900/50 rounded-xl border border-gray-700 p-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{FEED_INFO[expandedFeed].icon}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{expandedFeed}</h3>
                      <p className="text-gray-400 text-sm">{FEED_INFO[expandedFeed].description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedFeed(null)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-950/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Total IOCs</p>
                    <p className="text-2xl font-bold text-white">
                      {feedStats[expandedFeed].totalIOCs.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Total Updates</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {feedStats[expandedFeed].totalUpdates}
                    </p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Batches</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {feedStats[expandedFeed].batchCount}
                    </p>
                  </div>
                  <div className="bg-gray-950/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Last Update</p>
                    <p className="text-sm font-bold text-green-400">
                      {timeSinceUpdate(feedStats[expandedFeed].lastUpdate)}
                    </p>
                  </div>
                </div>

                <a
                  href={FEED_INFO[expandedFeed].website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                >
                  🔗 Visit {expandedFeed} Website
                </a>
              </div>
            )}

            {/* Recent Oracle Updates */}
            {recentBatches.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">⚡ Recent Oracle Updates</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentBatches.map((batch) => (
                    <div
                      key={batch.batchId}
                      className="bg-gray-950/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-900/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{batch.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-semibold">
                              {batch.feedName}
                            </p>
                            {batch.approved && <span className="text-green-400">✓</span>}
                          </div>
                          <p className="text-gray-400 text-xs">
                            Batch #{batch.batchId} • {batch.timestampFormatted}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-400 font-bold text-lg">{batch.iocCount}</p>
                        <p className="text-gray-500 text-xs">IOCs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Platform Stats */}
            {feeds.length > 0 && (
              <div className="mt-6 p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-700/30">
                <h3 className="font-bold text-white mb-4">📊 Oracle Platform Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-purple-400">
                      {feeds.reduce((sum, f) => sum + f.totalIOCs, 0).toLocaleString()}
                    </p>
                    <p className="text-gray-400 text-sm">Total Oracle IOCs</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-blue-400">
                      {feeds.reduce((sum, f) => sum + f.totalUpdates, 0)}
                    </p>
                    <p className="text-gray-400 text-sm">Total Updates</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-400">
                      {feeds.filter(f => f.active).length}
                    </p>
                    <p className="text-gray-400 text-sm">Active Feeds</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-yellow-400">
                      {feeds.reduce((sum, f) => sum + f.batchCount, 0)}
                    </p>
                    <p className="text-gray-400 text-sm">Oracle Batches</p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 text-xl">ℹ️</span>
                <div className="text-sm text-gray-400">
                  <p className="font-semibold text-blue-300 mb-1">Automated Threat Intelligence</p>
                  <p>Oracle feeds automatically import IOCs from trusted security sources every 6-12 hours. All data is verified, hashed into Merkle trees, and stored on Arbitrum L2 for cost-efficiency. These feeds are maintained by the platform and do not require community approval.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
