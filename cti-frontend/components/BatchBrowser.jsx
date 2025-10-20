// components/BatchBrowser.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function BatchBrowser() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, approved
  const [privacyFilter, setPrivacyFilter] = useState('all'); // all, public, anonymous
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const registryAddress = "0xD63e502605B0B48626bF979c66B68026a35DbA36";

  useEffect(() => {
    loadBatches();
    const interval = setInterval(loadBatches, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const loadBatches = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask to browse batches');
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      
      // Check network
      const network = await provider.getNetwork();
      if (network.chainId.toString() !== "11155111") {
        setError('Please switch to Ethereum Sepolia testnet');
        setLoading(false);
        return;
      }
      
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (string, bytes32, uint256, bool, bytes32, bool, uint256, uint256)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      const batchCount = await registry.getBatchCount();

      const batchArray = [];
      for (let i = 0; i < Number(batchCount); i++) {
        const batch = await registry.getBatch(i);
        
        // Fetch IOC count from IPFS
        let iocCount = 0;
        try {
          const response = await fetch(`https://gateway.pinata.cloud/ipfs/${batch[0]}`);
          const iocData = await response.json();
          iocCount = iocData.iocs?.length || iocData.flatIOCs?.length || 0;
        } catch (err) {
          console.error(`Failed to fetch IOC count for batch ${i}:`, err);
        }
        
        batchArray.push({
          index: i,
          cid: batch[0],
          merkleRoot: batch[1],
          timestamp: Number(batch[2]),
          accepted: batch[3],
          contributorHash: batch[4],
          isPublic: batch[5],
          confirmations: Number(batch[6]),
          falsePositives: Number(batch[7]),
          iocCount: iocCount,
          contributor: batch[5] ? ethers.getAddress('0x' + batch[4].slice(26)) : 'Anonymous'
        });
      }
      
      batchArray.reverse(); // Newest first
      setBatches(batchArray);
      setLoading(false);
      setError('');
    } catch (error) {
      console.error('Error loading batches:', error);
      setError(`Failed to load batches: ${error.message}`);
      setLoading(false);
    }
  };

  const searchIOCAcrossAllBatches = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter an IOC to search');
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (string, bytes32, uint256, bool, bytes32, bool, uint256, uint256)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      const batchCount = await registry.getBatchCount();

      const results = [];
      const searchLower = searchQuery.toLowerCase().trim();

      // Search through all batches
      for (let i = 0; i < Number(batchCount); i++) {
        try {
          const batch = await registry.getBatch(i);
          const cid = batch[0];

          // Fetch IOC data from IPFS
          const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
            signal: AbortSignal.timeout(5000) // 5 second timeout per batch
          });
          const iocData = await response.json();

          // Search through IOCs (case-insensitive)
          const iocs = iocData.iocs || iocData.flatIOCs || [];
          const matchingIOCs = iocs.filter(ioc => 
            ioc.toLowerCase().includes(searchLower)
          );

          if (matchingIOCs.length > 0) {
            results.push({
              batchIndex: i,
              cid: cid,
              timestamp: Number(batch[2]),
              accepted: batch[3],
              isPublic: batch[5],
              matchingIOCs: matchingIOCs
            });
          }
        } catch (err) {
          console.error(`Failed to search batch ${i}:`, err);
          // Continue searching other batches
        }
      }

      setSearchResults(results);

      if (results.length === 0) {
        alert(`No results found for "${searchQuery}"`);
      }

    } catch (error) {
      console.error('Search error:', error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setSearching(false);
    }
  };

  const filteredBatches = batches.filter(batch => {
    if (filter === 'pending' && batch.accepted) return false;
    if (filter === 'approved' && !batch.accepted) return false;
    if (privacyFilter === 'public' && !batch.isPublic) return false;
    if (privacyFilter === 'anonymous' && batch.isPublic) return false;
    return true;
  });

  const toggleExpand = (index) => {
    setExpandedBatch(expandedBatch === index ? null : index);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            <p>Loading batches...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30">
          <p className="text-red-300">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-12">
      <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <span>📚</span> Browse IOC Batches
        </h2>

        {/* Search Section */}
        <div className="mb-6 p-6 bg-purple-950/50 rounded-xl border border-purple-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>🔍</span> Search for Specific IOC
          </h3>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter IOC to search (e.g., malicious.com, 192.168.1.1)"
              className="flex-1 px-4 py-3 bg-purple-900/70 border border-purple-600/50 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-purple-500"
              disabled={searching}
            />
            
            <button
              onClick={searchIOCAcrossAllBatches}
              disabled={searching}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                searching
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {searching ? '⏳ Searching...' : '🔍 Search All Batches'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-semibold text-gray-400">
                Found in {searchResults.length} batch(es):
              </h4>
              
              {searchResults.map((result) => (
                <div key={result.batchIndex} className="bg-purple-900/30 rounded-lg p-4 border border-purple-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-white font-bold">Batch #{result.batchIndex}</span>
                      <span className="ml-3 text-gray-400 text-sm">
                        {new Date(result.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      result.accepted
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {result.accepted ? '✅ Approved' : '⏳ Pending'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Matching IOCs:</p>
                    {result.matchingIOCs.map((ioc, idx) => (
                      <div key={idx} className="bg-purple-950/50 rounded px-3 py-2 font-mono text-sm text-purple-300">
                        {ioc}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${result.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm"
                    >
                      📁 View on IPFS
                    </a>
                    <button
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        alert(`Use IOC Verification with Batch #${result.batchIndex}`);
                      }}
                      className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm"
                    >
                      🔍 Verify This IOC
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-purple-950/70 border border-purple-600/50 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Batches</option>
            <option value="pending">⏳ Pending Only</option>
            <option value="approved">✅ Approved Only</option>
          </select>

          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="px-4 py-2 bg-purple-950/70 border border-purple-600/50 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Privacy Modes</option>
            <option value="public">🌐 Public Only</option>
            <option value="anonymous">👤 Anonymous Only</option>
          </select>

          <div className="flex-1 text-right">
            <span className="text-gray-400 text-sm">
              Total: <span className="text-purple-400 font-bold">{filteredBatches.length}</span> batches
            </span>
          </div>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 text-lg">No batches found matching filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((batch) => (
              <div
                key={batch.index}
                className="bg-purple-950/50 rounded-xl p-5 border border-purple-700/50 hover:border-purple-600/70 transition-all"
              >
                {/* Batch Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {batch.accepted ? '✅' : '⏳'}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        Batch #{batch.index}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {new Date(batch.timestamp * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      batch.accepted
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {batch.accepted ? 'Approved' : 'Pending'}
                    </span>
                    
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      batch.isPublic
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {batch.isPublic ? '🌐 Public' : '👤 Anonymous'}
                    </span>
                  </div>
                </div>

                {/* Batch Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                    <p className="text-gray-400 text-xs mb-1">IOC Count</p>
                    <p className="text-purple-300 font-bold">{batch.iocCount}</p>
                  </div>

                  <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                    <p className="text-gray-400 text-xs mb-1">CID</p>
                    <p className="text-blue-400 font-mono text-xs truncate">{batch.cid}</p>
                  </div>

                  {batch.isPublic && (
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                      <p className="text-gray-400 text-xs mb-1">Contributor</p>
                      <p className="text-green-400 font-mono text-xs truncate">
                        {batch.contributor.substring(0, 10)}...
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleExpand(batch.index)}
                    className="flex-1 text-center py-2 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-all"
                  >
                    {expandedBatch === batch.index ? '▲ Hide Details' : '▼ View Details'}
                  </button>
                  
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${batch.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm transition-all"
                  >
                    📁 View on IPFS
                  </a>
                  
                  <a
                    href={`https://sepolia.etherscan.io/address/${registryAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-4 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 rounded-lg text-pink-300 text-sm transition-all"
                  >
                    🔗 View on Etherscan
                  </a>
                </div>

                {/* Expanded Details */}
                {expandedBatch === batch.index && (
                  <div className="mt-4 pt-4 border-t border-purple-700/50 space-y-3">
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                      <p className="text-gray-400 text-xs mb-1">Full CID</p>
                      <p className="text-blue-400 text-xs break-all font-mono">{batch.cid}</p>
                    </div>
                    
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                      <p className="text-gray-400 text-xs mb-1">Merkle Root</p>
                      <p className="text-purple-400 text-xs break-all font-mono">{batch.merkleRoot}</p>
                    </div>

                    {!batch.isPublic && (
                      <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                        <p className="text-gray-400 text-xs mb-1">Contributor Hash (256-bit)</p>
                        <p className="text-pink-400 text-xs break-all font-mono">{batch.contributorHash}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
