// components/AdminGovernancePanel.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';
import { getEventQueryDefaults, smartQueryEvents } from '../utils/infura-helpers';

export default function AdminGovernancePanel() {
  const [pendingBatches, setPendingBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);

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
    if (walletConnected && currentNetwork) {
      checkAdminStatus();
      loadPendingBatches();
    }
  }, [walletConnected, currentNetwork]);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setWalletAddress(accounts[0].address);
          setWalletConnected(true);
          
          const network = await provider.getNetwork();
          const chainId = network.chainId.toString();
          
          if (chainId === "11155111") {
            setCurrentNetwork(NETWORKS.sepolia);
          } else if (chainId === "421614") {
            setCurrentNetwork(NETWORKS.arbitrumSepolia);
          }
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
      setIsAdmin(false);
      setPendingBatches([]);
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
      
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      
      if (chainId === "11155111") {
        setCurrentNetwork(NETWORKS.sepolia);
      } else if (chainId === "421614") {
        setCurrentNetwork(NETWORKS.arbitrumSepolia);
      } else {
        setError('Please switch to Ethereum Sepolia or Arbitrum Sepolia');
      }
      
    } catch (error) {
      setError('Failed to connect wallet');
    }
  };

  const switchNetwork = async (targetNetwork) => {
    try {
      const chainIdHex = '0x' + targetNetwork.chainId.toString(16);
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      
      setCurrentNetwork(targetNetwork);
      setPendingBatches([]);
      setIsAdmin(false);
      
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + targetNetwork.chainId.toString(16),
              chainName: targetNetwork.name,
              nativeCurrency: targetNetwork.nativeCurrency,
              rpcUrls: [targetNetwork.rpcUrl],
              blockExplorerUrls: [targetNetwork.explorerUrl]
            }]
          });
          setCurrentNetwork(targetNetwork);
          setPendingBatches([]);
        } catch (addError) {
          setError(`Failed to add network: ${addError.message}`);
        }
      } else {
        setError(`Failed to switch network: ${error.message}`);
      }
    }
  };

  const checkAdminStatus = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const governanceAddress = currentNetwork.contracts.governance;
      
      const governanceABI = [
        "function admins(address) external view returns (bool)"
      ];
      
      const governance = new ethers.Contract(governanceAddress, governanceABI, signer);
      const adminStatus = await governance.admins(await signer.getAddress());
      
      console.log(`Admin check on ${currentNetwork.name} for ${await signer.getAddress()}:`, adminStatus);
      setIsAdmin(adminStatus);
      
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const loadPendingBatches = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const registryAddress = currentNetwork.contracts.registry;
      const governanceAddress = currentNetwork.contracts.governance;
      
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
      ];
      
      const governanceABI = [
        "function getBatchApprovalStatus(uint256 batchIndex) external view returns (uint256 approvals, bool executed, uint256 createdAt)"
      ];
      
      const registry = new ethers.Contract(registryAddress, registryABI, signer);
      const governance = new ethers.Contract(governanceAddress, governanceABI, signer);
      const count = await registry.getBatchCount();
      
      console.log(`Loading ${count} batches from ${currentNetwork.name}...`);
      
      // Query events to get CIDs with smart chunked queries (from deployment block)
      console.log('Fetching BatchAdded events...');
      const batchAddedFilter = registry.filters.BatchAdded();
      const latestBlock = await provider.getBlockNumber();
      const blocksBack = currentNetwork.chainId === 11155111 ? 50_000 : 2_000_000;
      const recentStartBlock = Math.max(0, latestBlock - blocksBack);
      const startBlock = Math.max(currentNetwork.deploymentBlock || 0, recentStartBlock);
      let cidMap = {};
      try {
        const params = new URLSearchParams({
          chainId: String(currentNetwork.chainId),
          rpcUrl: currentNetwork.rpcUrl,
          registry: registryAddress,
          deploymentBlock: String(currentNetwork.deploymentBlock || 0),
          maxBlocks: currentNetwork.chainId === 11155111 ? '200000' : '2000000'
        });
        const resp = await fetch(`/api/cid-map?${params.toString()}`);
        const json = await resp.json();
        if (json?.success && json?.cidMap) {
          cidMap = json.cidMap;
          console.log(`✅ Loaded CID map from server cache`, json.meta);
        } else {
          throw new Error(json?.error || 'cid-map fetch failed');
        }
      } catch (e) {
        console.warn(`⚠️ CID cache unavailable, falling back to live event scan:`, e?.message || e);
        const events = await smartQueryEvents(registry, batchAddedFilter, startBlock, latestBlock, provider, {
          deploymentBlock: currentNetwork.deploymentBlock,
          ...getEventQueryDefaults(currentNetwork)
        });
        events.forEach(event => {
          cidMap[Number(event.args.index)] = event.args.cid;
        });
        console.log(`Retrieved ${events.length} events (from block ${startBlock})`);
      }
      
      const pending = [];
      
      for (let i = 0; i < count; i++) {
        try {
          const batch = await registry.getBatch(i);
          
          // Check if batch is already executed in governance
          // Only show batches that are NOT accepted and NOT executed
          if (!batch.accepted) {
            try {
              const approval = await governance.getBatchApprovalStatus(i);
              
              // approval is a tuple: [approvals, executed, createdAt]
              const isExecuted = approval[1]; // executed field
              
              // Skip if governance has already executed this batch
              if (isExecuted) {
                console.log(`⏭️  Batch ${i} already executed, skipping`);
                continue;
              }
            } catch (govError) {
              console.warn(`Could not check governance status for batch ${i}:`, govError.message);
              // Continue anyway if governance check fails
            }
            
            const cid = cidMap[i];
            
            // Only fetch if we have a valid CID
            if (cid && !cid.startsWith('0x') && cid.length > 10) {
              const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
              const result = await response.json();
              
              if (result.success) {
                pending.push({
                  id: i,
                  cid: cid,
                  cidCommitment: batch.cidCommitment,
                  merkleRoot: batch.merkleRoot,
                  timestamp: new Date(Number(batch.timestamp) * 1000).toLocaleString(),
                  approved: batch.accepted,
                  contributorHash: batch.contributorHash,
                  isPublic: batch.isPublic,
                  voteCount: Number(batch.confirmations),
                  falsePositives: Number(batch.falsePositives),
                  iocCount: result.data.iocs.length,
                  iocData: result.data,
                  gateway: result.gateway
                });
              } else {
                pending.push({
                  id: i,
                  cid: cid,
                  cidCommitment: batch.cidCommitment,
                  merkleRoot: batch.merkleRoot,
                  timestamp: new Date(Number(batch.timestamp) * 1000).toLocaleString(),
                  approved: batch.accepted,
                  contributorHash: batch.contributorHash,
                  isPublic: batch.isPublic,
                  voteCount: Number(batch.confirmations),
                  falsePositives: Number(batch.falsePositives),
                  iocCount: 0,
                  iocData: null,
                  error: 'IPFS data unavailable'
                });
              }
            } else {
              console.warn(`Invalid or missing CID for batch ${i}`);
              pending.push({
                id: i,
                cid: 'Invalid CID',
                cidCommitment: batch.cidCommitment,
                merkleRoot: batch.merkleRoot,
                timestamp: new Date(Number(batch.timestamp) * 1000).toLocaleString(),
                approved: batch.accepted,
                contributorHash: batch.contributorHash,
                isPublic: batch.isPublic,
                voteCount: Number(batch.confirmations),
                falsePositives: Number(batch.falsePositives),
                iocCount: 0,
                iocData: null,
                error: 'No valid CID found'
              });
            }
            
            console.log(`✅ Loaded pending batch ${i}`);
          }
        } catch (error) {
          console.log(`Could not fetch batch ${i}:`, error.message);
        }
      }
      
      setPendingBatches(pending);
      console.log(`✅ Found ${pending.length} pending batches on ${currentNetwork.name}`);
      
    } catch (error) {
      console.error('Error loading pending batches:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const approveBatch = async (batchId) => {
    try {
      setError('');
      setSuccessMessage('');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const governanceAddress = currentNetwork.contracts.governance;
      
      const governanceABI = [
        "function approveBatch(uint256 batchIndex) external"
      ];
      
      const governance = new ethers.Contract(governanceAddress, governanceABI, signer);
      
      console.log(`Approving batch ${batchId} on ${currentNetwork.name}...`);
      const tx = await governance.approveBatch(batchId, { gasLimit: 200000 });
      
      console.log("Approval tx:", tx.hash);
      setSuccessMessage(`⏳ Approval transaction submitted: ${tx.hash.slice(0, 10)}... - waiting for confirmation`);
      
      await tx.wait();
      
      console.log("✅ Batch approved!");
      setSuccessMessage(`✅ Batch #${batchId} approved successfully on ${currentNetwork.name}! Processing...`);
      
      // Auto-refresh after 5 seconds to hide approved batches
      setTimeout(() => {
        setSuccessMessage('');
        loadPendingBatches();
      }, 5000);
      
    } catch (error) {
      console.error('Approval error:', error);
      setError(`Failed to approve batch: ${error.message}`);
    }
  };

  const toggleBatchExpansion = (batchId) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">🛡️ Admin Governance Panel</h2>
            <p className="text-gray-400">Multi-signature batch approval system</p>
          </div>
          
          {walletConnected && (
            <div className="flex gap-2">
              <button
                onClick={() => switchNetwork(NETWORKS.sepolia)}
                disabled={currentNetwork?.chainId === 11155111}
                className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  currentNetwork?.chainId === 11155111
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                }`}
              >
                🌐 Ethereum Sepolia
              </button>
              
              <button
                onClick={() => switchNetwork(NETWORKS.arbitrumSepolia)}
                disabled={currentNetwork?.chainId === 421614}
                className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                  currentNetwork?.chainId === 421614
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                }`}
              >
                ⚡ Arbitrum Sepolia
              </button>
            </div>
          )}
        </div>

        {!walletConnected ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Admin Access Required</h3>
              <p className="text-gray-400">Connect your admin wallet to manage batches</p>
            </div>
            
            <button
              onClick={connectWallet}
              className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Connect Admin Wallet
            </button>
          </div>
        ) : !isAdmin ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-red-500/20 border-4 border-red-500/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🚫</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Access Denied</h3>
              <p className="text-gray-400">This wallet is not registered as an admin on {currentNetwork?.name}</p>
              <p className="text-gray-500 text-sm mt-2 font-mono">
                {walletAddress.substring(0, 10)}...{walletAddress.substring(32)}
              </p>
            </div>
            
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-300 text-sm">
                💡 Only the 3 registered admin addresses can approve batches. Admin status is network-specific - try switching networks.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div>
                    <span className="text-green-300 font-semibold">Admin Access Granted on {currentNetwork?.name}</span>
                    <p className="text-gray-400 text-sm font-mono">
                      {walletAddress.substring(0, 10)}...{walletAddress.substring(32)}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={loadPendingBatches}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                ❌ {error}
              </div>
            )}
            
            {successMessage && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300">
                {successMessage}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Loading pending batches from {currentNetwork?.name}...</p>
              </div>
            ) : pendingBatches.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✨</div>
                <p className="text-gray-400 text-lg">No pending batches to approve</p>
                <p className="text-gray-500 text-sm mt-2">All submissions on {currentNetwork?.name} have been processed!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="bg-gray-900/50 border border-yellow-500/30 rounded-xl overflow-hidden hover:border-yellow-500/50 transition-all"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400">
                            ⏳
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">Batch #{batch.id}</h3>
                            <p className="text-gray-400 text-sm">
                              {batch.iocCount || '?'} IOCs • {batch.timestamp}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold border border-yellow-500/30">
                            {batch.voteCount} confirmations
                          </div>
                          {batch.falsePositives > 0 && (
                            <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold border border-red-500/30">
                              {batch.falsePositives} disputes
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-500">Contributor Hash:</span>
                          <p className="text-purple-400 font-mono">
                            {batch.contributorHash.substring(0, 10)}...{batch.contributorHash.substring(58)}
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-gray-500">IPFS CID:</span>
                          <p className="text-blue-400 font-mono break-all">
                            {batch.cid.substring(0, 20)}...
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-gray-500">Merkle Root:</span>
                          <p className="text-green-400 font-mono">
                            {batch.merkleRoot.substring(0, 10)}...{batch.merkleRoot.substring(58)}
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-gray-500">Privacy Mode:</span>
                          <p className={batch.isPublic ? 'text-blue-400' : 'text-purple-400'}>
                            {batch.isPublic ? '🌐 Public Identity' : '🔒 Anonymous (ZKP)'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleBatchExpansion(batch.id)}
                          className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                        >
                          {expandedBatch === batch.id ? '▼ Hide IOCs' : '▶ Show IOCs'}
                        </button>
                        
                        <button
                          onClick={() => approveBatch(batch.id)}
                          className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                        >
                          ✅ Approve Batch
                        </button>
                      </div>
                    </div>

                    {expandedBatch === batch.id && batch.iocData && (
                      <div className="border-t border-gray-700 p-6 bg-gray-950/50">
                        <h4 className="text-lg font-bold text-white mb-4">📋 IOC Contents</h4>
                        
                        <div className="mb-4 p-4 bg-gray-900/70 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Format:</span>
                              <p className="text-white font-semibold">{batch.iocData.format}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Privacy Mode:</span>
                              <p className="text-purple-400 font-semibold">
                                {batch.iocData.metadata?.privacyMode || 'public'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Quality Score:</span>
                              <p className="text-green-400 font-semibold">
                                {batch.voteCount > 0 ? `${Math.round((batch.voteCount / (batch.voteCount + batch.falsePositives)) * 100)}%` : 'No votes yet'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Community Feedback:</span>
                              <p className="text-yellow-400 font-semibold">
                                {batch.voteCount} ✓ / {batch.falsePositives} ✗
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto bg-gray-900/70 rounded-lg p-4">
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
                            href={`${currentNetwork.explorerUrl}/address/${currentNetwork.contracts.registry}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                          >
                            🔗 View Contract
                          </a>
                          
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${batch.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                          >
                            📦 View on IPFS
                          </a>
                        </div>
                      </div>
                    )}

                    {expandedBatch === batch.id && batch.error && (
                      <div className="border-t border-gray-700 p-6 bg-red-500/5">
                        <p className="text-red-400 text-sm">⚠️ {batch.error}</p>
                        <p className="text-gray-500 text-xs mt-2">
                          IPFS data temporarily unavailable. The batch can still be approved.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 p-6 bg-gray-900/30 rounded-xl border border-gray-700">
              <h3 className="font-bold text-white mb-4">ℹ️ Privacy-Preserving Multi-Sig Governance</h3>
              <div className="space-y-3 text-sm text-gray-400">
                <div className="flex items-start gap-3">
                  <span className="text-green-400">1.</span>
                  <p>Each batch requires <span className="text-white font-semibold">3 out of 3 admin signatures</span> for approval</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-400">2.</span>
                  <p>Contributors can submit <span className="text-white font-semibold">anonymously via zero-knowledge proofs</span></p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-400">3.</span>
                  <p>Community can confirm or dispute batches, affecting <span className="text-white font-semibold">quality scores</span></p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-yellow-400">⚠️</span>
                  <p>You are managing batches on <span className="text-purple-400 font-semibold">{currentNetwork?.name}</span>. Switch networks to approve on other chains.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
