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
        "function getBatch(uint256) public view returns (string, bytes32, uint256, bool, bytes32, bool, uint256, uint256)"
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
      const userTransactions = [];

      for (let i = 0; i < Number(batchCount); i++) {
        const batch = await registry.getBatch(i);
        const contributorHash = batch[4];
        const isPublic = batch[5];
        
        if (isPublic) {
          const submitterAddress = '0x' + contributorHash.slice(26);
          if (submitterAddress.toLowerCase() === address.toLowerCase()) {
            
            let iocCount = '?';
            try {
              const response = await fetch(`https://gateway.pinata.cloud/ipfs/${batch[0]}`);
              const iocData = await response.json();
              iocCount = iocData.iocs ? iocData.iocs.length : '?';
            } catch (err) {
              console.log(`Could not fetch IOC count for batch ${i}`);
            }

            userTransactions.push({
              batchIndex: i,
              cid: batch[0],
              merkleRoot: batch[1],
              timestamp: new Date(Number(batch[2]) * 1000).toISOString(),
              accepted: batch[3],
              iocCount: iocCount,
              confirmations: Number(batch[6]),
              disputes: Number(batch[7])
            });
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
