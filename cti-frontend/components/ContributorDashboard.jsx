// components/ContributorDashboard.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS, STAKING_TIERS } from '../utils/constants';
import { smartQueryEvents } from '../utils/infura-helpers';

export default function ContributorDashboard() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contributorData, setContributorData] = useState(null);
  const [submissionHistory, setSubmissionHistory] = useState([]);
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
    if (walletConnected && currentNetwork) {
      loadContributorData();
      loadSubmissionHistory();
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
      setContributorData(null);
      setSubmissionHistory([]);
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
      setContributorData(null);
      setSubmissionHistory([]);
      
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
        } catch (addError) {
          setError(`Failed to add network: ${addError.message}`);
        }
      } else {
        setError(`Failed to switch network: ${error.message}`);
      }
    }
  };

  const loadContributorData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      // ✅ CORRECT struct based on your contract
      const registryABI = [
        "function contributors(address) external view returns (uint256 submissionCount, uint256 acceptedSubmissions, uint256 reputationScore, uint256 totalStaked, uint256 tier, bool isActive, uint256 joinedAt)"
      ];
      
      const registry = new ethers.Contract(
        currentNetwork.contracts.registry,
        registryABI,
        signer
      );
      
      const data = await registry.contributors(address);
      
      console.log('Raw contributor data:', {
        submissionCount: data[0].toString(),
        acceptedSubmissions: data[1].toString(),
        reputationScore: data[2].toString(),
        totalStaked: data[3].toString(),
        tier: data[4].toString(),
        isActive: data[5],
        joinedAt: data[6].toString()
      });
      
      // ✅ Convert tier (wei value) to name
      const tierWei = Number(data[4]);
      const tierName = tierWei === 10000000000000000 ? 'MICRO' :
                        tierWei === 50000000000000000 ? 'STANDARD' :
                        tierWei === 100000000000000000 ? 'PREMIUM' : 'UNKNOWN';
      
      setContributorData({
        tier: tierName,
        tierAmount: ethers.formatEther(data[4]),
        submissionCount: Number(data[0]),
        acceptedSubmissions: Number(data[1]),
        reputationScore: Number(data[2]),
        totalStaked: ethers.formatEther(data[3]),
        isActive: data[5],
        joinedAt: Number(data[6]),
        registrationDate: data[6] > 0 ? new Date(Number(data[6]) * 1000).toLocaleString() : 'Not registered'
      });
      
      console.log('✅ Loaded contributor data:', tierName, 'submissions:', Number(data[0]));
      
    } catch (error) {
      console.error('Error loading contributor data:', error);
      setContributorData({
        tier: 'NOT_REGISTERED',
        isActive: false
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissionHistory = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
      ];
      
      const registry = new ethers.Contract(
        currentNetwork.contracts.registry,
        registryABI,
        signer
      );
      
      console.log('📊 Loading submission history...');
      
      const countBigInt = await registry.getBatchCount();
      const count = Number(countBigInt);
      console.log(`   Found ${count} total batches`);
      
      // Fetch BatchAdded events to get CIDs (using smart chunked queries)
      console.log('   🔎 Fetching BatchAdded events...');
      const filter = registry.filters.BatchAdded();
      const events = await smartQueryEvents(registry, filter, 0, 'latest', provider);
      
      const cidMap = {};
      events.forEach(event => {
        cidMap[Number(event.args.index)] = event.args.cid;
      });
      console.log(`   ✅ Retrieved ${events.length} events`);
      
      const history = [];
      
      const addressHash = ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase()));
      
      for (let i = 0; i < count; i++) {
        try {
          const batch = await registry.getBatch(i);
          const cid = cidMap[i];
          
          if (!cid) {
            console.warn(`   ⚠️  No CID found for batch ${i}`);
            continue;
          }
          
          // Validate CID format
          if (cid.startsWith('0x') || cid.length < 10) {
            console.warn(`   ⚠️  Invalid CID format for batch ${i}: ${cid}`);
            continue;
          }
          
          // Check if this batch belongs to the current user
          if (batch.contributorHash === addressHash || batch.isPublic) {
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
            const result = await response.json();
            
            if (result.success) {
              history.push({
                batchId: i,
                cid: cid,
                merkleRoot: batch.merkleRoot,
                timestamp: Number(batch.timestamp),
                timestampFormatted: new Date(Number(batch.timestamp) * 1000).toLocaleString(),
                approved: batch.accepted,
                isPublic: batch.isPublic,
                confirmations: Number(batch.confirmations),
                disputes: Number(batch.falsePositives),
                iocCount: result.data.iocs.length
              });
            }
          }
        } catch (error) {
          console.error(`   ❌ Error loading batch ${i}:`, error.message);
        }
      }
      
      setSubmissionHistory(history.sort((a, b) => b.timestamp - a.timestamp));
      console.log(`✅ Loaded ${history.length} submissions`);
      
    } catch (error) {
      console.error('❌ Error loading submission history:', error);
    }
  };

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'MICRO':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'STANDARD':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'PREMIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getReputationLevel = (score) => {
    if (score >= 200) return { label: 'Platinum', color: 'text-cyan-400', emoji: '💎' };
    if (score >= 100) return { label: 'Gold', color: 'text-yellow-400', emoji: '🥇' };
    if (score >= 50) return { label: 'Silver', color: 'text-gray-300', emoji: '🥈' };
    return { label: 'Bronze', color: 'text-orange-400', emoji: '🥉' };
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">👤 Contributor Dashboard</h2>
            <p className="text-gray-400">Your personal threat intelligence contributions</p>
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
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400">Connect MetaMask to view your contributor dashboard</p>
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
            <p className="text-gray-400">Loading your contributor data from {currentNetwork?.name}...</p>
          </div>
        ) : !contributorData?.isActive ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-yellow-500/20 border-4 border-yellow-500/50 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Not Registered</h3>
              <p className="text-gray-400">You haven't registered as a contributor on {currentNetwork?.name} yet</p>
            </div>
            
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {Object.entries(STAKING_TIERS).map(([key, tier]) => (
                  <div key={key} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 hover:border-purple-500/50 transition-all">
                    <h4 className="text-white font-bold mb-2">{tier.label}</h4>
                    <p className="text-purple-400 text-2xl font-bold mb-2">{tier.amount} ETH</p>
                    <p className="text-gray-400 text-xs">+{tier.reputationBonus} reputation per batch</p>
                  </div>
                ))}
              </div>
              
              <a
                href="/submit"
                className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all"
              >
                🚀 Register & Submit First Batch
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 p-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-3xl">
                    {getReputationLevel(contributorData.reputationScore).emoji}
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Registered Contributor</p>
                    <p className="text-white font-mono text-sm">
                      {walletAddress.substring(0, 10)}...{walletAddress.substring(32)}
                    </p>
                  </div>
                </div>
                
                <div className={`px-4 py-2 rounded-lg border font-semibold ${getTierBadge(contributorData.tier)}`}>
                  {contributorData.tier} TIER
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Reputation Score</p>
                  <p className={`text-2xl font-bold ${getReputationLevel(contributorData.reputationScore).color}`}>
                    {contributorData.reputationScore}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {getReputationLevel(contributorData.reputationScore).label} Level
                  </p>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Staked Amount</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {parseFloat(contributorData.totalStaked).toFixed(3)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">ETH</p>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Total Submissions</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {contributorData.submissionCount}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Batches</p>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Approval Rate</p>
                  <p className="text-2xl font-bold text-green-400">
                    {contributorData.submissionCount > 0 
                      ? Math.round((contributorData.acceptedSubmissions / contributorData.submissionCount) * 100)
                      : 0}%
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {contributorData.acceptedSubmissions}/{contributorData.submissionCount} approved
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-bold text-white mb-4">📊 Your Stats on {currentNetwork?.name}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Tier Bonus:</span>
                    <span className="text-purple-400 font-semibold">
                      +{STAKING_TIERS[contributorData.tier]?.reputationBonus || 10} per batch
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Member Since:</span>
                    <span className="text-blue-400 font-semibold text-xs">
                      {contributorData.registrationDate}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Status:</span>
                    <span className="text-green-400 font-semibold">
                      {contributorData.isActive ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
                <h3 className="text-lg font-bold text-white mb-4">🎯 Impact</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Total IOCs Shared:</span>
                    <span className="text-blue-400 font-semibold">
                      {submissionHistory.reduce((sum, s) => sum + s.iocCount, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Community Confirmations:</span>
                    <span className="text-green-400 font-semibold">
                      {submissionHistory.reduce((sum, s) => sum + s.confirmations, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Disputes Received:</span>
                    <span className="text-red-400 font-semibold">
                      {submissionHistory.reduce((sum, s) => sum + s.disputes, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">📝 Submission History</h3>
                <button
                  onClick={loadSubmissionHistory}
                  className="text-sm text-purple-400 hover:text-purple-300 font-semibold"
                >
                  🔄 Refresh
                </button>
              </div>

              {submissionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-400">No submissions found on {currentNetwork?.name}</p>
                  <p className="text-gray-500 text-sm mt-2">Your submission history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissionHistory.map((submission) => (
                    <div
                      key={submission.batchId}
                      className="bg-gray-950/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-500/50 transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold">Batch #{submission.batchId}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              submission.approved
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {submission.approved ? '✅ Approved' : '⏳ Pending'}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              submission.isPublic
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}>
                              {submission.isPublic ? '🌐 Public' : '🔒 Private'}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{submission.timestampFormatted}</p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-white font-bold text-lg">{submission.iocCount}</p>
                          <p className="text-gray-500 text-xs">IOCs</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-gray-900/50 rounded p-2">
                          <p className="text-gray-500 mb-1">CID</p>
                          <p className="text-blue-400 font-mono truncate">{submission.cid.substring(0, 12)}...</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2">
                          <p className="text-gray-500 mb-1">Confirmations</p>
                          <p className="text-green-400 font-bold">{submission.confirmations}</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2">
                          <p className="text-gray-500 mb-1">Disputes</p>
                          <p className="text-red-400 font-bold">{submission.disputes}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <a
                          href={`${currentNetwork.explorerUrl}/address/${currentNetwork.contracts.registry}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-semibold transition-all"
                        >
                          🔗 Explorer
                        </a>
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${submission.cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold transition-all"
                        >
                          📦 IPFS
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl border border-purple-700/50 p-4">
                <div className="text-purple-400 text-3xl mb-2">🎯</div>
                <p className="text-sm text-gray-400 mb-1">Next Milestone</p>
                <p className="text-white font-bold">
                  {contributorData.reputationScore >= 200 ? 'Max Level Reached!' :
                   contributorData.reputationScore >= 100 ? `${200 - contributorData.reputationScore} to Platinum` :
                   contributorData.reputationScore >= 50 ? `${100 - contributorData.reputationScore} to Gold` :
                   `${50 - contributorData.reputationScore} to Silver`}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl border border-blue-700/50 p-4">
                <div className="text-blue-400 text-3xl mb-2">💰</div>
                <p className="text-sm text-gray-400 mb-1">Potential Earnings</p>
                <p className="text-white font-bold">
                  {(contributorData.acceptedSubmissions * 0.001).toFixed(4)} ETH
                </p>
                <p className="text-gray-500 text-xs">Based on approved batches</p>
              </div>

              <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl border border-green-700/50 p-4">
                <div className="text-green-400 text-3xl mb-2">📈</div>
                <p className="text-sm text-gray-400 mb-1">Impact Score</p>
                <p className="text-white font-bold">
                  {submissionHistory.reduce((sum, s) => sum + s.iocCount, 0)} IOCs
                </p>
                <p className="text-gray-500 text-xs">Total threat indicators shared</p>
              </div>
            </div>

            <div className="mt-6 p-6 bg-gray-900/30 rounded-xl border border-gray-700">
              <h3 className="font-bold text-white mb-4">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <p>Submit high-quality batches to earn reputation and climb the leaderboard</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <p>Upgrade your tier to earn {STAKING_TIERS.PREMIUM.reputationBonus} reputation per batch (currently +{STAKING_TIERS[contributorData.tier]?.reputationBonus || 10})</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <p>Use anonymous mode to protect your identity while contributing</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <p>Stats shown are for {currentNetwork?.name} only - switch networks to view other chains</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
