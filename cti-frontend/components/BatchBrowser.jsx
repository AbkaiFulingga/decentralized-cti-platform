// components/BatchBrowser.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';
import { IOCEncryption } from '../utils/encryption';

export default function BatchBrowser() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [viewMode, setViewMode] = useState('all');
  const [l1Batches, setL1Batches] = useState([]);
  const [l2Batches, setL2Batches] = useState([]);
  const [loadingL1, setLoadingL1] = useState(false);
  const [loadingL2, setLoadingL2] = useState(false);

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
      loadAllBatches();
    }
  }, [walletConnected]);

  useEffect(() => {
    if (viewMode === 'all') {
      setBatches([...l1Batches, ...l2Batches].sort((a, b) => b.timestampRaw - a.timestampRaw));
    } else if (viewMode === 'sepolia') {
      setBatches(l1Batches);
    } else if (viewMode === 'arbitrum') {
      setBatches(l2Batches);
    }
  }, [viewMode, l1Batches, l2Batches]);

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
      setBatches([]);
      setL1Batches([]);
      setL2Batches([]);
    } else {
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      loadAllBatches();
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

  const loadBatchesFromNetwork = async (network, setNetworkBatches, setNetworkLoading) => {
    setNetworkLoading(true);
    
    try {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      const registryAddress = network.contracts.registry;
      
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)",
        "event BatchAddedWithZKProof(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, uint256 commitment, uint256 contributorMerkleRoot)"
      ];
      
      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      
      console.log(`Querying ${network.name} at ${registryAddress}...`);
      const count = await registry.getBatchCount();
      
      console.log(`Loading ${count} batches from ${network.name}...`);
      
      // Fetch all batch events to get CIDs
      console.log(`🔍 Fetching events for CIDs from ${network.name}...`);
      const batchAddedFilter = registry.filters.BatchAdded();
      const batchZKFilter = registry.filters.BatchAddedWithZKProof();
      
      let batchAddedEvents = [];
      let batchZKEvents = [];
      
      // Try querying with Infura-safe fallback
      try {
        [batchAddedEvents, batchZKEvents] = await Promise.all([
          registry.queryFilter(batchAddedFilter, 0, 'latest'),
          registry.queryFilter(batchZKFilter, 0, 'latest')
        ]);
        console.log(`✅ Fetched ${batchAddedEvents.length + batchZKEvents.length} events from ${network.name}`);
      } catch (error) {
        const errorStr = JSON.stringify(error);
        const isBlockRangeError = 
          error.message?.includes('block range') || 
          error.message?.includes('10 block') ||
          error.code === -32600 ||
          errorStr.includes('"code":-32600') ||
          errorStr.includes('block range');
          
        if (isBlockRangeError) {
          console.log(`⚠️ Infura limit reached, fetching recent blocks only...`);
          const latestBlock = await provider.getBlockNumber();
          const fromBlock = Math.max(0, latestBlock - 1000);
          
          try {
            [batchAddedEvents, batchZKEvents] = await Promise.all([
              registry.queryFilter(batchAddedFilter, fromBlock, 'latest').catch(() => []),
              registry.queryFilter(batchZKFilter, fromBlock, 'latest').catch(() => [])
            ]);
            console.log(`✅ Fetched ${batchAddedEvents.length + batchZKEvents.length} events from blocks ${fromBlock} to ${latestBlock}`);
          } catch (fallbackError) {
            console.error(`❌ Fallback query failed:`, fallbackError.message);
            batchAddedEvents = [];
            batchZKEvents = [];
          }
        } else {
          console.error(`❌ Event query error:`, error.message);
          batchAddedEvents = [];
          batchZKEvents = [];
        }
      }
      
      // Combine and sort events by batch index
      const allEvents = [...batchAddedEvents, ...batchZKEvents];
      const cidMap = {};
      allEvents.forEach((event, idx) => {
        const batchIndex = Number(event.args.index);
        cidMap[batchIndex] = event.args.cid;
        console.log(`📦 Event ${idx}: Batch #${batchIndex} → CID: ${event.args.cid}`);
      });
      
      console.log(`✅ Found ${Object.keys(cidMap).length} CIDs from events for ${network.name}`, cidMap);
      
      const batchesData = [];
      
      for (let i = 0; i < count; i++) {
        try {
          const batch = await registry.getBatch(i);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get CID from event map
          const cid = cidMap[i];
          
          if (!cid) {
            console.warn(`⚠️ No CID found for batch ${i} from events`);
            batchesData.push({
              id: i,
              network: network.name,
              networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
              chainId: network.chainId,
              cidCommitment: batch.cidCommitment,
              merkleRoot: batch.merkleRoot,
              timestamp: new Date(Number(batch.timestamp) * 1000).toLocaleString(),
              timestampRaw: Number(batch.timestamp),
              approved: batch.accepted,
              contributorHash: batch.contributorHash,
              isPublic: batch.isPublic,
              voteCount: Number(batch.confirmations),
              falsePositives: Number(batch.falsePositives),
              error: 'CID not found in events - batch may be from before recent blocks',
              explorerUrl: network.explorerUrl,
              registryAddress: registryAddress
            });
            continue;
          }
          
          console.log(`📥 Fetching IOC data for batch ${i} from IPFS: ${cid}`);
          
          const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
          const result = await response.json();
          
          const timestampRaw = Number(batch.timestamp);
          
          if (result.success) {
            // Check if data is encrypted
            let decryptedData = null;
            let isEncrypted = false;
            let hasDecryptionKey = false;
            
            if (result.data.type === 'encrypted-ioc-bundle') {
              isEncrypted = true;
              
              // Try to decrypt if we have the key
              const encryptor = new IOCEncryption();
              const key = encryptor.retrieveKeyLocally(result.data.keyId);
              
              if (key) {
                hasDecryptionKey = true;
                try {
                  decryptedData = encryptor.decryptBundle(
                    result.data.ciphertext,
                    key,
                    result.data.iv,
                    result.data.metadataHash
                  );
                  console.log(`🔓 Successfully decrypted batch ${i}`);
                } catch (error) {
                  console.error(`Failed to decrypt batch ${i}:`, error);
                }
              }
            }
            
            // Use decrypted data if available, otherwise use raw data
            const iocData = decryptedData || result.data;
            const iocCount = iocData.iocs ? iocData.iocs.length : 0;
            
            batchesData.push({
              id: i,
              network: network.name,
              networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
              chainId: network.chainId,
              cid: cid,                         // string cid from events
              cidCommitment: batch.cidCommitment,          // bytes32 cidCommitment
              merkleRoot: batch.merkleRoot,             // bytes32 merkleRoot
              timestamp: new Date(timestampRaw * 1000).toLocaleString(),
              timestampRaw: timestampRaw,       // uint256 timestamp
              approved: batch.accepted,               // bool accepted
              contributorHash: batch.contributorHash,        // bytes32 contributorHash
              isPublic: batch.isPublic,               // bool isPublic
              voteCount: Number(batch.confirmations),      // uint256 confirmations
              falsePositives: Number(batch.falsePositives), // uint256 falsePositives
              iocCount: iocCount,
              iocData: iocData,
              isEncrypted: isEncrypted,
              hasDecryptionKey: hasDecryptionKey,
              rawEncryptedData: isEncrypted ? result.data : null,
              gateway: result.gateway,
              explorerUrl: network.explorerUrl,
              registryAddress: registryAddress
            });
          } else {
            batchesData.push({
              id: i,
              network: network.name,
              networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
              chainId: network.chainId,
              cid: cid,
              cidCommitment: batch.cidCommitment,
              merkleRoot: batch.merkleRoot,
              timestamp: new Date(timestampRaw * 1000).toLocaleString(),
              timestampRaw: timestampRaw,
              approved: batch.accepted,
              contributorHash: batch.contributorHash,
              isPublic: batch.isPublic,
              voteCount: Number(batch.confirmations),
              falsePositives: Number(batch.falsePositives),
              iocCount: 0,
              iocData: null,
              error: 'IPFS data unavailable',
              explorerUrl: network.explorerUrl,
              registryAddress: registryAddress
            });
          }
          
          console.log(`✅ Loaded ${network.name} batch ${i}/${count}`);
        } catch (error) {
          console.error(`Error loading batch ${i} from ${network.name}:`, error.message);
        }
      }
      
      setNetworkBatches(batchesData);
      console.log(`✅ Loaded ${batchesData.length} batches from ${network.name}`);
      
    } catch (error) {
      console.error(`Error loading batches from ${network.name}:`, error);
      setError(`Failed to load from ${network.name}: ${error.message}`);
    } finally {
      setNetworkLoading(false);
    }
  };

  const loadAllBatches = async () => {
    setError('');
    
    await Promise.all([
      loadBatchesFromNetwork(NETWORKS.sepolia, setL1Batches, setLoadingL1),
      loadBatchesFromNetwork(NETWORKS.arbitrumSepolia, setL2Batches, setLoadingL2)
    ]);
  };

  const toggleBatchExpansion = (batchKey) => {
    setExpandedBatch(expandedBatch === batchKey ? null : batchKey);
  };

  const isLoading = loadingL1 || loadingL2;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">📊 Browse IOC Batches</h2>
            <p className="text-gray-400">Cross-chain threat intelligence from L1 and L2</p>
          </div>
        </div>

        {!walletConnected ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400">Connect MetaMask to browse IOC batches from both networks</p>
            </div>
            
            <button
              onClick={connectWallet}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Connect MetaMask Wallet
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-gray-400 text-sm">Connected Wallet</span>
                  <p className="text-purple-400 font-mono text-sm">
                    {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
                  </p>
                </div>
                
                <button
                  onClick={loadAllBatches}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '🔄 Loading...' : '🔄 Refresh All'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('all')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'all'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border border-purple-500/50'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  }`}
                >
                  🌍 All Networks ({l1Batches.length + l2Batches.length})
                </button>
                
                <button
                  onClick={() => setViewMode('sepolia')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'sepolia'
                      ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  }`}
                >
                  🌐 Ethereum L1 ({l1Batches.length})
                </button>
                
                <button
                  onClick={() => setViewMode('arbitrum')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'arbitrum'
                      ? 'bg-purple-500/30 text-purple-300 border border-purple-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  }`}
                >
                  ⚡ Arbitrum L2 ({l2Batches.length})
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                ❌ {error}
              </div>
            )}

            {isLoading && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-blue-300 text-sm font-semibold">
                        {loadingL1 && loadingL2 ? 'Loading from both networks...' : 
                         loadingL1 ? 'Loading Ethereum Sepolia...' : 
                         loadingL2 ? 'Loading Arbitrum Sepolia...' : 'Loading...'}
                      </span>
                      <span className="text-blue-400 text-xs">
                        L1: {l1Batches.length} | L2: {l2Batches.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((l1Batches.length + l2Batches.length) / 10) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isLoading && batches.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-400 text-lg">No batches found on any network</p>
                <p className="text-gray-500 text-sm mt-2">Be the first to submit threat intelligence!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {batches.map((batch) => {
                  const batchKey = `${batch.network}-${batch.id}`;
                  
                  return (
                    <div
                      key={batchKey}
                      className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
                    >
                      <div
                        className="p-6 cursor-pointer"
                        onClick={() => toggleBatchExpansion(batchKey)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              batch.approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {batch.approved ? '✅' : '⏳'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-white">Batch #{batch.id}</h3>
                                <span className={`text-lg ${batch.networkIcon === '🌐' ? 'text-blue-400' : 'text-purple-400'}`}>
                                  {batch.networkIcon}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                  batch.networkIcon === '🌐' 
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}>
                                  {batch.network.includes('Ethereum') ? 'Ethereum L1' : 'Arbitrum L2'}
                                </span>
                                
                                {/* Encryption Badge */}
                                {batch.isEncrypted && (
                                  <span className={`text-xs px-2 py-1 rounded font-semibold flex items-center gap-1 ${
                                    batch.hasDecryptionKey
                                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  }`}>
                                    {batch.hasDecryptionKey ? '🔓 Decrypted' : '🔒 Encrypted'}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm">
                                {batch.iocCount || '?'} IOCs • {batch.timestamp}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              batch.approved 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {batch.approved ? 'Approved' : 'Pending'}
                            </div>
                            
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              batch.isPublic
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}>
                              {batch.isPublic ? '🌐 Public' : '🔒 Private'}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Contributor Hash:</span>
                            <p className="text-purple-400 font-mono">
                              {batch.contributorHash.substring(0, 10)}...{batch.contributorHash.substring(58)}
                            </p>
                          </div>
                          
                          <div>
                            <span className="text-gray-500">IPFS CID:</span>
                            <p className="text-blue-400 font-mono break-all">
                              {batch.cid ? `${batch.cid.substring(0, 20)}...` : 'Not available (check events)'}
                            </p>
                          </div>
                          
                          <div>
                            <span className="text-gray-500">Merkle Root:</span>
                            <p className="text-green-400 font-mono">
                              {batch.merkleRoot.substring(0, 10)}...{batch.merkleRoot.substring(58)}
                            </p>
                          </div>
                          
                          {/* Encryption Info */}
                          {batch.isEncrypted && (
                            <div className="col-span-2 bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{batch.hasDecryptionKey ? '🔓' : '🔒'}</span>
                                <span className="text-purple-300 font-semibold">
                                  {batch.hasDecryptionKey ? 'End-to-End Encrypted (Decrypted Locally)' : 'End-to-End Encrypted (No Key Available)'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 space-y-1">
                                <p>Algorithm: {batch.rawEncryptedData?.algorithm || 'AES-256-CBC'}</p>
                                <p>Key ID: {batch.rawEncryptedData?.keyId?.substring(0, 20)}...{batch.rawEncryptedData?.keyId?.substring(58) || 'N/A'}</p>
                                {!batch.hasDecryptionKey && (
                                  <p className="text-orange-400 mt-2">⚠️ You don't have the decryption key for this batch. Only the submitter can decrypt the contents.</p>
                                )}
                                {batch.hasDecryptionKey && (
                                  <p className="text-green-400 mt-2">✅ Decryption key found in your browser's localStorage. Content decrypted successfully.</p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <span className="text-gray-500">Community Confirmations:</span>
                            <p className="text-yellow-400 font-semibold">
                              {batch.voteCount} confirmations • {batch.falsePositives} disputes
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <button className="text-purple-400 hover:text-purple-300 text-sm font-semibold">
                            {expandedBatch === batchKey ? '▼ Hide Details' : '▶ Show Details'}
                          </button>
                          
                          {batch.gateway && (
                            <span className="text-xs text-gray-500">
                              Via {batch.gateway.includes('pinata') ? 'Pinata' : batch.gateway.includes('cloudflare') ? 'Cloudflare' : 'IPFS'}
                            </span>
                          )}
                        </div>
                      </div>

                      {expandedBatch === batchKey && batch.iocData && (
                        <div className="border-t border-gray-700 p-6 bg-gray-950/50">
                          <h4 className="text-lg font-bold text-white mb-4">📋 IOC Details</h4>
                          
                          <div className="mb-4 p-4 bg-gray-900/70 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Format:</span>
                                <p className="text-white font-semibold">{batch.iocData.format}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Source:</span>
                                <p className="text-purple-400 font-mono text-xs">
                                  {batch.iocData.metadata?.source?.substring(0, 10)}...
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Privacy Mode:</span>
                                <p className="text-purple-400 font-semibold">
                                  {batch.isPublic ? 'Public Identity' : 'Anonymous (ZKP)'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Quality Score:</span>
                                <p className="text-green-400 font-semibold">
                                  {batch.voteCount > 0 ? `${Math.round((batch.voteCount / (batch.voteCount + batch.falsePositives)) * 100)}%` : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="max-h-96 overflow-y-auto bg-gray-900/70 rounded-lg p-4">
                            <div className="font-mono text-sm space-y-1">
                              {batch.iocData.iocs?.map((ioc, idx) => (
                                <div key={idx} className="text-gray-300 hover:text-white hover:bg-gray-800/50 p-2 rounded transition-all">
                                  <span className="text-gray-500 mr-3">{idx + 1}.</span>
                                  {ioc}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 flex gap-3">
                            <a
                              href={`${batch.explorerUrl}/address/${batch.registryAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                              🔗 View on {batch.network.includes('Ethereum') ? 'Etherscan' : 'Arbiscan'}
                            </a>
                            
                            {batch.cid && (
                              <a
                                href={`https://gateway.pinata.cloud/ipfs/${batch.cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                              >
                                📦 View on IPFS
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {expandedBatch === batchKey && batch.error && (
                        <div className="border-t border-gray-700 p-6 bg-red-500/5">
                          <p className="text-red-400 text-sm">⚠️ {batch.error}</p>
                          <p className="text-gray-500 text-xs mt-2">
                            IPFS data temporarily unavailable. Try refreshing.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-8 p-6 bg-gray-900/30 rounded-xl border border-gray-700">
              <h3 className="font-bold text-white mb-4">📊 Cross-Chain Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-purple-400">{l1Batches.length + l2Batches.length}</div>
                  <div className="text-sm text-gray-400">Total Batches</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-400">{l1Batches.length}</div>
                  <div className="text-sm text-gray-400">L1 (Sepolia)</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">{l2Batches.length}</div>
                  <div className="text-sm text-gray-400">L2 (Arbitrum)</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400">
                    {[...l1Batches, ...l2Batches].filter(b => b.approved).length}
                  </div>
                  <div className="text-sm text-gray-400">Approved</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {[...l1Batches, ...l2Batches].reduce((sum, b) => sum + (b.iocCount || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-400">Total IOCs</div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 text-xl">ℹ️</span>
                <div className="text-sm text-gray-400">
                  <p className="font-semibold text-blue-300 mb-1">Cross-Chain Privacy-Preserving Registry</p>
                  <p>This browser queries <span className="text-white font-semibold">both Ethereum L1 and Arbitrum L2</span> simultaneously. The PrivacyPreservingRegistry contract supports anonymous submissions via zero-knowledge proofs and community-driven quality scoring.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
