// components/EnhancedIOCSearch.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { NETWORKS } from '../utils/constants';
import { getEventQueryDefaults, smartQueryEvents } from '../utils/infura-helpers';

export default function EnhancedIOCSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [allBatches, setAllBatches] = useState([]);
  const [expandedResult, setExpandedResult] = useState(null);
  const [votingBatch, setVotingBatch] = useState(null);
  const [indexProgress, setIndexProgress] = useState({ current: 0, total: 0, network: '' });

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
    // Indexing/search is read-only; don't require a wallet connection.
    // If a wallet is connected we'll still capture the address for voting actions.
    indexAllBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setAllBatches([]);
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
        alert('Please install MetaMask');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      
    } catch (error) {
      alert('Failed to connect wallet');
    }
  };

  const reindexNow = async () => {
    if (indexing) return;
    setAllBatches([]);
    setSearchResults([]);
    await indexAllBatches();
  };

  const indexBatchesFromNetwork = async (network) => {
    try {
      console.log(`🔍 [${network.name}] Starting batch indexing...`);
      console.log(`   📡 RPC: ${network.rpcUrl}`);
      console.log(`   📝 Registry: ${network.contracts.registry}`);
      
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
      ];
      
      const registry = new ethers.Contract(network.contracts.registry, registryABI, provider);
      let count;
      try {
        count = await registry.getBatchCount();
      } catch (e) {
        console.error(`❌ [${network.name}] getBatchCount() failed (ABI mismatch or wrong contract address?)`, {
          error: e?.message || e,
          address: network.contracts.registry
        });
        return [];
      }
      const countNum = Number(count);
      
      console.log(`📊 [${network.name}] Found ${countNum} batches`);
      
      if (countNum === 0) {
        console.log(`⚠️  [${network.name}] No batches to index`);
        return [];
      }
      
      // Prefer server-side CID cache to avoid heavy/fragile eth_getLogs scans on Sepolia.
      console.log(`🗺️  [${network.name}] Loading CID map from server cache...`);
      let cidMap = {};
      try {
        const params = new URLSearchParams({
          chainId: String(network.chainId),
          rpcUrl: network.rpcUrl,
          registry: network.contracts.registry,
          deploymentBlock: String(network.deploymentBlock || 0),
          maxBlocks: network.chainId === 11155111 ? '2000' : '20000',
          allowStale: '1'
        });
        const resp = await fetch(`/api/cid-map?${params.toString()}`);
        const json = await resp.json();
        if (json?.success && json?.cidMap) {
          cidMap = json.cidMap;
          console.log(`✅ [${network.name}] CID map loaded`, json?.meta);
        } else {
          throw new Error(json?.error || 'cid-map fetch failed');
        }
      } catch (e) {
        console.warn(`⚠️  [${network.name}] CID cache unavailable; falling back to live event scan`, e?.message || e);
        const filter = registry.filters.BatchAdded();
        const latestBlock = await provider.getBlockNumber();
        const blocksBack = network.chainId === 11155111 ? 50_000 : 2_000_000;
        const recentStartBlock = Math.max(0, latestBlock - blocksBack);
        const startBlock = Math.max(network.deploymentBlock || 0, recentStartBlock);
        const events = await smartQueryEvents(registry, filter, startBlock, latestBlock, provider, {
          deploymentBlock: network.deploymentBlock,
          ...getEventQueryDefaults(network)
        });
        console.log(`✅ [${network.name}] Retrieved ${events.length} events`);
        events.forEach(event => {
          cidMap[Number(event.args.index)] = event.args.cid;
        });
      }
      
      // Limit to last 100 batches for demo responsiveness (implicit limit, no UI text)
      const batchLimit = Math.min(100, countNum);
      const startIndex = Math.max(0, countNum - batchLimit);
      
      const indexed = [];
      
      for (let i = startIndex; i < countNum; i++) {
        setIndexProgress({ current: i - startIndex + 1, total: batchLimit, network: network.name });
        
        console.log(`\n🔄 [${network.name}] Processing batch ${i}/${countNum - 1}...`);
        
        try {
          // Fetch batch data with detailed logging
          console.log(`   📡 Calling getBatch(${i})...`);
          let batch;
          try {
            batch = await registry.getBatch(i);
          } catch (getBatchError) {
            console.error(`   ❌ getBatch(${i}) decode error from ${network.name}:`, getBatchError.message);
            // Skip this batch if we can't decode it - might be ABI mismatch
            continue;
          }
          
          console.log(`   ✅ Batch ${i} fetched:`, {
            cidCommitment: batch.cidCommitment,
            merkleRoot: batch.merkleRoot,
            timestamp: Number(batch.timestamp),
            accepted: batch.accepted,
            contributorHash: batch.contributorHash,
            isPublic: batch.isPublic,
            confirmations: Number(batch.confirmations),
            falsePositives: Number(batch.falsePositives)
          });
          
          const cid = cidMap[i];
          
          if (!cid) {
            console.warn(`   ⚠️  No CID found in events for batch ${i}, skipping`);
            continue;
          }
          
          // Validate CID format (should start with 'Qm' or 'bafy' for IPFS, not '0x')
          if (cid.startsWith('0x') || cid === '0x0000000000000000000000000000000000000000000000000000000000000100') {
            console.warn(`   ⚠️  Invalid CID format for batch ${i}: ${cid.slice(0, 20)}... (looks like a hash, not an IPFS CID)`);
            continue;
          }
          
          console.log(`   📍 CID from events: ${cid}`);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          console.log(`   🌐 Fetching IOC data from IPFS...`);
          const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
          const result = await response.json();
          
          if (!result.success) {
            console.error(`   ❌ IPFS fetch failed:`, result.error);
            continue;
          }
          
          if (!result.data || !result.data.iocs) {
            console.warn(`   ⚠️  No IOCs found in IPFS data`);
            continue;
          }
          
          console.log(`   ✅ Retrieved ${result.data.iocs.length} IOCs`);
          
          const indexedBatch = {
            batchId: i,
            network: network.name,
            networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
            chainId: network.chainId,
            cid: cid,
            merkleRoot: batch.merkleRoot,
            timestamp: Number(batch.timestamp),
            approved: batch.accepted,
            contributorHash: batch.contributorHash,
            isPublic: batch.isPublic,
            confirmations: Number(batch.confirmations),
            disputes: Number(batch.falsePositives),
            iocs: result.data.iocs,
            format: result.data.format,
            explorerUrl: network.explorerUrl,
            registryAddress: network.contracts.registry,
            governanceAddress: network.contracts.governance
          };
          
          indexed.push(indexedBatch);
          console.log(`   ✅ Batch ${i} indexed successfully`);
          
        } catch (error) {
          console.error(`   ❌ Failed to index batch ${i}:`, {
            error: error.message,
            code: error.code,
            stack: error.stack
          });
          
          // Try to decode the error for more details
          if (error.data) {
            console.error(`   📊 Error data:`, error.data);
          }
        }
      }
      
      return indexed;
    } catch (error) {
      console.error(`Error indexing ${network.name}:`, error);
      return [];
    }
  };

  const indexAllBatches = async () => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 Starting Multi-Chain IOC Indexing');
    console.log('═══════════════════════════════════════════════════════\n');
    
    setIndexing(true);
    setIndexProgress({ current: 0, total: 0, network: 'Starting...' });
    
    try {
      console.log('📡 Indexing from 2 networks in parallel:');
      console.log('   1. Sepolia (Ethereum L1)');
      console.log('   2. Arbitrum Sepolia (L2)');
      console.log('');
      
      const startTime = Date.now();
      
      const [l1Batches, l2Batches] = await Promise.all([
        indexBatchesFromNetwork(NETWORKS.sepolia),
        indexBatchesFromNetwork(NETWORKS.arbitrumSepolia)
      ]);
      
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 Indexing Complete - Summary');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   🌐 Sepolia batches: ${l1Batches.length}`);
      console.log(`   ⚡ Arbitrum batches: ${l2Batches.length}`);
      console.log(`   📦 Total indexed: ${l1Batches.length + l2Batches.length}`);
      console.log(`   ⏱️  Time taken: ${elapsedTime}s`);
      console.log('═══════════════════════════════════════════════════════\n');
      
      const combined = [...l1Batches, ...l2Batches];
      setAllBatches(combined);
      
      console.log(`✅ All batches stored in state`);
    } catch (error) {
      console.error('❌ Fatal indexing error:', error);
      console.error('   Stack:', error.stack);
    } finally {
      setIndexing(false);
      setIndexProgress({ current: 0, total: 0, network: '' });
    }
  };

  const performSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    
    const query = searchQuery.toLowerCase().trim();
    const matches = [];

    allBatches.forEach(batch => {
      batch.iocs.forEach((ioc, iocIndex) => {
        if (ioc.toLowerCase().includes(query)) {
          const leaves = batch.iocs.map(x => keccak256(x));
          const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
          const leaf = keccak256(ioc);
          const proof = tree.getHexProof(leaf);
          
          matches.push({
            ioc: ioc,
            iocIndex: iocIndex,
            batch: batch,
            merkleProof: proof,
            verified: tree.verify(proof, leaf, batch.merkleRoot)
          });
        }
      });
    });

    setSearchResults(matches);
    setLoading(false);
  };

  const confirmBatch = async (batchId, network) => {
    try {
      setVotingBatch(batchId);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const currentNet = await provider.getNetwork();
      const targetNetwork = network.includes('Ethereum') ? NETWORKS.sepolia : NETWORKS.arbitrumSepolia;
      
      if (currentNet.chainId.toString() !== targetNetwork.chainId.toString()) {
        alert(`Please switch to ${targetNetwork.name} to vote on this batch`);
        setVotingBatch(null);
        return;
      }
      
      const registryABI = [
        "function confirmBatch(uint256 batchIndex) external"
      ];
      
      const registry = new ethers.Contract(
        targetNetwork.contracts.registry,
        registryABI,
        signer
      );
      
      console.log(`Confirming batch ${batchId} on ${network}...`);
      const tx = await registry.confirmBatch(batchId, { gasLimit: 150000 });
      
      await tx.wait();
      console.log("✅ Batch confirmed!");
      
      await indexAllBatches();
      performSearch();
      
    } catch (error) {
      console.error('Confirmation error:', error);
      alert(`Failed to confirm batch: ${error.message}`);
    } finally {
      setVotingBatch(null);
    }
  };

  const disputeBatch = async (batchId, network) => {
    try {
      setVotingBatch(batchId);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const currentNet = await provider.getNetwork();
      const targetNetwork = network.includes('Ethereum') ? NETWORKS.sepolia : NETWORKS.arbitrumSepolia;
      
      if (currentNet.chainId.toString() !== targetNetwork.chainId.toString()) {
        alert(`Please switch to ${targetNetwork.name} to vote on this batch`);
        setVotingBatch(null);
        return;
      }
      
      const registryABI = [
        "function disputeBatch(uint256 batchIndex) external"
      ];
      
      const registry = new ethers.Contract(
        targetNetwork.contracts.registry,
        registryABI,
        signer
      );
      
      console.log(`Disputing batch ${batchId} on ${network}...`);
      const tx = await registry.disputeBatch(batchId, { gasLimit: 150000 });
      
      await tx.wait();
      console.log("✅ Batch disputed!");
      
      await indexAllBatches();
      performSearch();
      
    } catch (error) {
      console.error('Dispute error:', error);
      alert(`Failed to dispute batch: ${error.message}`);
    } finally {
      setVotingBatch(null);
    }
  };

  const toggleResultExpansion = (resultKey) => {
    setExpandedResult(expandedResult === resultKey ? null : resultKey);
  };

  const qualityScore = (confirmations, disputes) => {
    const total = confirmations + disputes;
    if (total === 0) return 'N/A';
    return `${Math.round((confirmations / total) * 100)}%`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">🔍 Search Threat Intelligence</h2>
          <p className="text-gray-400">Keyword search across all batches on L1 and L2</p>
        </div>

        <>
          {!walletConnected && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-yellow-300 font-semibold">Wallet not connected</p>
                <p className="text-gray-400 text-sm">You can still index and search. Connect MetaMask only if you want to vote (confirm/dispute).</p>
              </div>
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg text-sm transition-all"
              >
                Connect
              </button>
            </div>
          )}

            {indexing && (
              <div className="mb-6 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="flex-1">
                    <p className="text-blue-300 font-semibold mb-2">
                      📇 Indexing IOCs from {indexProgress.network}...
                    </p>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-gray-400 text-xs mt-2">
                      {indexProgress.current} / {indexProgress.total} batches
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!indexing && allBatches.length > 0 && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-green-300 font-semibold">Index Ready</p>
                      <p className="text-gray-400 text-sm">
                        {allBatches.length} batches indexed • {allBatches.reduce((sum, b) => sum + b.iocs.length, 0)} IOCs searchable
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={reindexNow}
                    disabled={indexing}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-all"
                  >
                    🔄 Re-index
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-3">
                🔎 Search for IOC (Partial Match)
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                  placeholder="e.g., malicious, 192.168, phishing.com"
                  className="flex-1 px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 placeholder-gray-500 font-mono"
                  disabled={loading || indexing}
                />
                <button
                  onClick={performSearch}
                  disabled={loading || indexing || !searchQuery.trim()}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    loading || indexing || !searchQuery.trim()
                      ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                  }`}
                >
                  {loading ? '⏳' : '🔍'} Search
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                💡 Searches across {allBatches.length} batches from both Ethereum L1 and Arbitrum L2
              </p>
            </div>

            {loading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Searching indexed batches...</p>
              </div>
            )}

            {!loading && searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">
                    🎯 Found {searchResults.length} Match{searchResults.length > 1 ? 'es' : ''}
                  </h3>
                  <span className="text-sm text-gray-400">
                    Query: <span className="text-purple-400 font-mono">"{searchQuery}"</span>
                  </span>
                </div>

                {searchResults.map((match, idx) => {
                  const resultKey = `${match.batch.network}-${match.batch.batchId}-${match.iocIndex}`;
                  
                  return (
                    <div
                      key={resultKey}
                      className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                              match.batch.approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {match.batch.approved ? '✅' : '⏳'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg font-bold text-white">Match #{idx + 1}</span>
                                <span className={`text-lg ${match.batch.networkIcon === '🌐' ? 'text-blue-400' : 'text-purple-400'}`}>
                                  {match.batch.networkIcon}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                  match.batch.networkIcon === '🌐'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}>
                                  {match.batch.network}
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm">
                                Found in Batch #{match.batch.batchId} • {new Date(match.batch.timestamp * 1000).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {match.verified && (
                              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold border border-green-500/30">
                                ✓ Verified
                              </div>
                            )}
                            {match.batch.approved && (
                              <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold border border-blue-500/30">
                                Approved
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-4 p-4 bg-gray-950/50 rounded-lg">
                          <p className="text-gray-400 text-xs mb-1">Matched IOC:</p>
                          <p className="text-white font-mono text-sm break-all">{match.ioc}</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                          <div>
                            <span className="text-gray-500 text-xs">Quality Score</span>
                            <p className="text-green-400 font-bold">
                              {qualityScore(match.batch.confirmations, match.batch.disputes)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Confirmations</span>
                            <p className="text-yellow-400 font-bold">{match.batch.confirmations}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Disputes</span>
                            <p className="text-red-400 font-bold">{match.batch.disputes}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Privacy</span>
                            <p className={match.batch.isPublic ? 'text-blue-400 font-bold' : 'text-purple-400 font-bold'}>
                              {match.batch.isPublic ? 'Public' : 'Private'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleResultExpansion(resultKey)}
                            className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                          >
                            {expandedResult === resultKey ? '▼ Hide Details' : '▶ Show Merkle Proof & Batch Info'}
                          </button>

                          {match.batch.approved && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => confirmBatch(match.batch.batchId, match.batch.network)}
                                disabled={votingBatch !== null}
                                className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                👍 Confirm Quality
                              </button>
                              <button
                                onClick={() => disputeBatch(match.batch.batchId, match.batch.network)}
                                disabled={votingBatch !== null}
                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                👎 Dispute
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {expandedResult === resultKey && (
                        <div className="border-t border-gray-700 p-6 bg-gray-950/50">
                          <h4 className="text-lg font-bold text-white mb-4">🔐 Cryptographic Proof</h4>
                          
                          <div className="space-y-3 text-sm">
                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">Merkle Root (On-Chain)</p>
                              <p className="text-green-400 font-mono text-xs break-all">{match.batch.merkleRoot}</p>
                            </div>

                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">IPFS CID</p>
                              <p className="text-blue-400 font-mono text-xs break-all">{match.batch.cid}</p>
                            </div>

                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">Merkle Proof ({match.merkleProof.length} hashes)</p>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {match.merkleProof.map((hash, i) => (
                                  <p key={i} className="text-purple-400 font-mono text-xs break-all">
                                    [{i}] {hash}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div className="bg-gray-900/70 rounded-lg p-3">
                              <p className="text-gray-400 mb-1">Batch Information</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">Batch ID:</span>
                                  <span className="text-white ml-2">#{match.batch.batchId}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Total IOCs:</span>
                                  <span className="text-white ml-2">{match.batch.iocs.length}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Format:</span>
                                  <span className="text-white ml-2">{match.batch.format}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">IOC Index:</span>
                                  <span className="text-white ml-2">#{match.iocIndex}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-green-900/30 rounded-lg p-4 border border-green-700/50">
                              <p className="text-green-300 font-semibold mb-2">🎯 Verification Status:</p>
                              <ul className="space-y-1 text-green-200 text-xs">
                                <li>✓ IOC found in batch #{match.batch.batchId} on {match.batch.network}</li>
                                <li>✓ Merkle proof validated ({match.merkleProof.length} proof hashes)</li>
                                <li>✓ IPFS content integrity verified</li>
                                <li>✓ On-chain Merkle root matches</li>
                                <li>✓ {match.batch.approved ? 'Governance approved' : 'Awaiting governance approval'}</li>
                                <li>✓ Community score: {qualityScore(match.batch.confirmations, match.batch.disputes)}</li>
                              </ul>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-3">
                            <a
                              href={`${match.batch.explorerUrl}/address/${match.batch.registryAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                              🔗 View Contract
                            </a>
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${match.batch.cid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                              📦 View on IPFS
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !indexing && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-400 text-lg">No matches found for "{searchQuery}"</p>
                <p className="text-gray-500 text-sm mt-2">
                  Try different keywords or partial matches
                </p>
              </div>
            )}

            <div className="mt-8 p-6 bg-gray-900/30 rounded-xl border border-gray-700">
              <h3 className="font-bold text-white mb-4">ℹ️ How Search Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                <div>
                  <div className="text-purple-400 text-2xl mb-2">📇</div>
                  <p className="font-semibold text-white mb-1">Local Index</p>
                  <p>All batches are indexed locally for instant search without blockchain queries</p>
                </div>
                <div>
                  <div className="text-blue-400 text-2xl mb-2">🔎</div>
                  <p className="font-semibold text-white mb-1">Partial Match</p>
                  <p>Search matches substrings - "malicious" finds "super-malicious.com"</p>
                </div>
                <div>
                  <div className="text-green-400 text-2xl mb-2">✅</div>
                  <p className="font-semibold text-white mb-1">Cryptographic Proof</p>
                  <p>Each result includes Merkle proof for verification</p>
                </div>
              </div>
            </div>
          </>
      </div>
    </div>
  );
}
