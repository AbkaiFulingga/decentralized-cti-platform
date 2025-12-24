// components/TransactionHistory.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(typeof window !== 'undefined');
  }, []);

  useEffect(() => {
    if (isBrowser) {
      loadTransactionHistory();
      const interval = setInterval(loadTransactionHistory, 15000);
      return () => clearInterval(interval);
    }
  }, [isBrowser]);

  // ✅ FIX: Add account change listener
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountChange = (accounts) => {
        if (accounts.length > 0 && accounts[0] !== userAddress) {
          console.log('Account changed to:', accounts[0]);
          setUserAddress(accounts[0]);
          loadTransactionHistory(); // Reload for new account
        } else if (accounts.length === 0) {
          setUserAddress('');
          setIsRegistered(false);
          setTransactions([]);
        }
      };

      const handleChainChange = () => {
        console.log('Network changed, reloading...');
        window.location.reload();
      };
      
      window.ethereum.on('accountsChanged', handleAccountChange);
      window.ethereum.on('chainChanged', handleChainChange);
      
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountChange);
          window.ethereum.removeListener('chainChanged', handleChainChange);
        }
      };
    }
  }, [userAddress]);

  const loadTransactionHistory = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask');
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserAddress(address);

      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      
      let registryAddress;
      if (chainId === "11155111") {
        registryAddress = NETWORKS.sepolia.contracts.registry;
        setCurrentNetwork(NETWORKS.sepolia);
      } else if (chainId === "421614") {
        registryAddress = NETWORKS.arbitrumSepolia.contracts.registry;
        setCurrentNetwork(NETWORKS.arbitrumSepolia);
      } else {
        setError(`Unsupported network (Chain ID: ${chainId}). Please switch to Ethereum Sepolia or Arbitrum Sepolia.`);
        setLoading(false);
        return;
      }

      if (!registryAddress || registryAddress === "") {
        setError(`⚠️ Contracts not yet deployed to ${chainId === "421614" ? "Arbitrum Sepolia" : "this network"}. Please switch to a supported network.`);
        setLoading(false);
        return;
      }

      const registryABI = [
        "function contributors(address) external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)",
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      
      // ✅ FIX: Check field [5] for isActive
      const contributor = await registry.contributors(address);
      const registered = contributor[5];
      setIsRegistered(registered);

      if (!registered) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      const batchCount = await registry.getBatchCount();
      
      console.log(`📊 Fetching transaction history for ${address.slice(0, 6)}...${address.slice(-4)}`);
      console.log(`📦 Total batches: ${batchCount}`);
      
      // Query events to get CIDs
      const batchAddedFilter = registry.filters.BatchAdded();
      let events = [];
      
      try {
        events = await registry.queryFilter(batchAddedFilter, 0, 'latest');
        console.log(`✅ Fetched ${events.length} BatchAdded events`);
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
            events = await registry.queryFilter(batchAddedFilter, fromBlock, 'latest');
            console.log(`✅ Fetched ${events.length} events from blocks ${fromBlock} to ${latestBlock}`);
          } catch (fallbackError) {
            console.error(`❌ Fallback query failed:`, fallbackError.message);
            events = [];
          }
        } else {
          console.error(`❌ Event query error:`, error.message);
          events = [];
        }
      }
      
      const cidMap = {};
      events.forEach(event => {
        const batchIndex = Number(event.args.index);
        cidMap[batchIndex] = event.args.cid;
      });
      
      const userTransactions = [];

      for (let i = 0; i < Number(batchCount); i++) {
        const batch = await registry.getBatch(i);
        const contributorHash = batch.contributorHash;
        const isPublic = batch.isPublic;
        
        if (isPublic) {
          const submitterAddress = '0x' + contributorHash.slice(26);
          if (submitterAddress.toLowerCase() === address.toLowerCase()) {
            
            let iocCount = '?';
            const cid = cidMap[i];
            
            // Only fetch if we have a valid CID (not a hex string)
            if (cid && !cid.startsWith('0x') && cid.length > 10) {
              try {
                const response = await fetch(`/api/ipfs-fetch?cid=${cid}`);
                const result = await response.json();
                if (result.success) {
                  iocCount = result.data.iocs ? result.data.iocs.length : '?';
                }
              } catch (err) {
                console.log(`⚠️ Could not fetch IOC count for batch ${i}`);
              }
            } else if (cid) {
              console.warn(`⚠️ Invalid CID format for batch ${i}: ${cid.slice(0, 20)}...`);
            }

            userTransactions.push({
              batchIndex: i,
              cid: cid || 'CID not found',
              cidCommitment: batch.cidCommitment,
              merkleRoot: batch.merkleRoot,
              timestamp: new Date(Number(batch.timestamp) * 1000).toISOString(),
              accepted: batch.accepted,
              iocCount: iocCount,
              confirmations: Number(batch.confirmations),
              disputes: Number(batch.falsePositives)
            });
            
            console.log(`✅ Found user batch #${i}: ${iocCount} IOCs, ${batch.accepted ? 'Accepted' : 'Pending'}`);
          }
        }
      }

      userTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setTransactions(userTransactions);
      setLoading(false);
      setError('');

    } catch (err) {
      console.error('Transaction history error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (!isBrowser) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
          <p className="text-gray-400 text-center">Loading...</p>
        </div>
      </div>
    );
  }

  if (!window.ethereum) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-8 border border-red-500/30">
          <p className="text-red-300 text-center">⚠️ Please install MetaMask to view transaction history</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            Loading transaction history...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30">
          <p className="text-red-300 text-center">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-12">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
              <span>📜</span> Your Transaction History
            </h2>
            <p className="text-gray-400 text-sm">
              Connected: {userAddress.substring(0, 6)}...{userAddress.substring(38)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Network</div>
            <div className="text-purple-300 font-semibold">{currentNetwork?.name || 'Unknown'}</div>
          </div>
        </div>

        {!isRegistered ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <p className="text-gray-400 text-lg mb-2">Not Registered as Contributor</p>
            <p className="text-gray-500 text-sm mb-4">
              Admins must also register as contributors to submit IOC batches
            </p>
            <p className="text-purple-300 text-sm">
              💡 Register with 0.01 ETH (MICRO), 0.05 ETH (STANDARD), or 0.1 ETH (PREMIUM)
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 text-lg mb-2">No Submissions Yet</p>
            <p className="text-gray-500 text-sm">
              You haven't submitted any IOC batches yet
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-4 p-3 bg-purple-950/50 rounded-lg border border-purple-700/50">
              <p className="text-gray-300 text-sm">
                📊 {transactions.length} batch{transactions.length !== 1 ? 'es' : ''} submitted
              </p>
            </div>

            {transactions.map((tx) => (
              <div
                key={tx.batchIndex}
                className="bg-purple-950/50 rounded-xl p-6 border border-purple-700/50 hover:border-purple-600/70 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-lg mb-1">
                      Batch #{tx.batchIndex}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Submitted: {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      tx.accepted
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {tx.accepted ? '✅ Accepted' : '⏳ Pending'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                    <p className="text-gray-400 text-xs mb-1">IOC Count</p>
                    <p className="text-purple-300 font-bold">{tx.iocCount}</p>
                  </div>

                  <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                    <p className="text-gray-400 text-xs mb-1">Confirmations</p>
                    <p className="text-green-400 font-bold">{tx.confirmations}</p>
                  </div>

                  <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                    <p className="text-gray-400 text-xs mb-1">Disputes</p>
                    <p className="text-red-400 font-bold">{tx.disputes}</p>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <p className="text-gray-400 text-xs mb-1">IPFS CID</p>
                  <p className="text-blue-400 font-mono text-xs break-all">{tx.cid}</p>
                </div>

                <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <p className="text-gray-400 text-xs mb-1">Merkle Root</p>
                  <p className="text-purple-400 font-mono text-xs break-all">{tx.merkleRoot}</p>
                </div>

                <div className="flex gap-3">
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${tx.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm transition-all"
                  >
                    📁 View on IPFS
                  </a>
                  
                  <a
                    href={`${currentNetwork?.explorerUrl}/address/${currentNetwork?.contracts.registry}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-all"
                  >
                    🔗 View on Explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
