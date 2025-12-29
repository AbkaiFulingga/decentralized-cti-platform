// components/TransactionHistory.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';
import { getEventQueryDefaults, smartQueryEvents } from '../utils/infura-helpers';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [isBrowser, setIsBrowser] = useState(false);
  const [lastLoadAt, setLastLoadAt] = useState(0);

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
    // Debounce: prevents multiple rapid re-entries (helps avoid duplicate cid-map calls)
    const now = Date.now();
    if (now - lastLoadAt < 2000) return;
    setLastLoadAt(now);

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
      setCurrentNetwork(chainId === "11155111" ? NETWORKS.sepolia : NETWORKS.arbitrumSepolia);

      console.log(`📊 Fetching transaction history from BOTH networks for ${address.slice(0, 6)}...${address.slice(-4)}`);
      
      const registryABI = [
        // PrivacyPreservingRegistry: contributors(address) -> Contributor struct
        // (submissionCount, acceptedSubmissions, reputationScore, totalStaked, tier, isActive, joinedAt)
        "function contributors(address) external view returns (uint256 submissionCount, uint256 acceptedSubmissions, uint256 reputationScore, uint256 totalStaked, uint256 tier, bool isActive, uint256 joinedAt)",
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
        "event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)"
      ];

      // Query BOTH networks simultaneously
      const networksToQuery = [
        { name: 'Sepolia', config: NETWORKS.sepolia },
        { name: 'Arbitrum Sepolia', config: NETWORKS.arbitrumSepolia }
      ];

      let allUserTransactions = [];

      for (const { name, config } of networksToQuery) {
        try {
          console.log(`🌐 Querying ${name}...`);
          const networkProvider = new ethers.JsonRpcProvider(config.rpcUrl);
          const registry = new ethers.Contract(config.contracts.registry, registryABI, networkProvider);
          
          // Check if user is registered on this network.
          // For PrivacyPreservingRegistry this should NOT revert; unregistered means isActive=false.
          let isActive = false;
          try {
            const contributor = await registry.contributors(address);
            isActive = Boolean(contributor?.isActive ?? contributor?.[5]);
            console.log(`👤 ${name}: contributor isActive=${isActive}`);
          } catch (error) {
            console.warn(`⚠️ ${name}: contributors(address) call failed; skipping this network`, error?.message || error);
            continue;
          }

          if (!isActive) {
            console.log(`ℹ️ Not registered on ${name}, skipping`);
            continue;
          }

          const batchCount = await registry.getBatchCount();
          console.log(`📦 ${name}: ${batchCount} total batches`);
          
          // Query events to get CIDs with smart chunked queries (from deployment block)
          const batchAddedFilter = registry.filters.BatchAdded();
          const latestBlock = await networkProvider.getBlockNumber();
          const blocksBack = config.chainId === 11155111 ? 50_000 : 2_000_000;
          const recentStartBlock = Math.max(0, latestBlock - blocksBack);
          const startBlock = Math.max(config.deploymentBlock || 0, recentStartBlock);
          let cidMap = {};
          try {
            if (!config?.contracts?.registry || !config?.rpcUrl) {
              throw new Error('Missing network config (registry or rpcUrl)');
            }
            const params = new URLSearchParams({
              chainId: String(config.chainId),
              rpcUrl: config.rpcUrl,
              registry: config.contracts.registry,
              deploymentBlock: String(config.deploymentBlock || 0),
              maxBlocks: config.chainId === 11155111 ? '2000' : '20000',
              allowStale: '1'
            });
            const resp = await fetch(`/api/cid-map?${params.toString()}`);
            const json = await resp.json();
            if (json?.success && json?.cidMap) {
              cidMap = json.cidMap;
              console.log(`🗺️ ${name}: Loaded CID map from server cache`, json?.meta);
            } else {
              throw new Error(json?.error || 'cid-map fetch failed');
            }
          } catch (e) {
            console.warn(`⚠️ ${name}: CID cache unavailable, falling back to live event scan`, e?.message || e);
            const events = await smartQueryEvents(registry, batchAddedFilter, startBlock, latestBlock, networkProvider, {
              deploymentBlock: config.deploymentBlock,
              ...getEventQueryDefaults(config)
            });
            console.log(`✅ ${name}: Fetched ${events.length} BatchAdded events (from block ${startBlock})`);
            events.forEach(event => {
              cidMap[Number(event.args.index)] = event.args.cid;
            });
          }
      
          // Filter batches submitted by this user
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
                    console.log(`⚠️ Could not fetch IOC count for batch ${i} on ${name}`);
                  }
                } else if (cid) {
                  console.warn(`⚠️ Invalid CID format for batch ${i} on ${name}: ${cid.slice(0, 20)}...`);
                }

                allUserTransactions.push({
                  network: name,
                  networkShort: name === 'Sepolia' ? 'ETH' : 'ARB',
                  batchIndex: i,
                  cid: cid || 'CID not found',
                  cidCommitment: batch.cidCommitment,
                  merkleRoot: batch.merkleRoot,
                  timestamp: new Date(Number(batch.timestamp) * 1000).toISOString(),
                  accepted: batch.accepted,
                  iocCount: iocCount,
                  confirmations: Number(batch.confirmations),
                  disputes: Number(batch.falsePositives),
                  explorerUrl: `${config.explorerUrl}/address/${config.contracts.registry}`
                });
                
                console.log(`✅ Found user batch #${i} on ${name}: ${iocCount} IOCs, ${batch.accepted ? 'Accepted' : 'Pending'}`);
              }
            }
          }
        } catch (networkError) {
          console.error(`❌ Error querying ${name}:`, networkError?.message || networkError);
          // Continue to next network instead of failing completely
        }
      }

      // Check if registered on at least one network
      const registeredOnAny = allUserTransactions.length > 0;
      setIsRegistered(registeredOnAny);

      // Sort by timestamp (most recent first)
      allUserTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setTransactions(allUserTransactions);
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
                key={`${tx.network}-${tx.batchIndex}`}
                className="bg-purple-950/50 rounded-xl p-6 border border-purple-700/50 hover:border-purple-600/70 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-bold text-lg">
                        Batch #{tx.batchIndex}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        tx.networkShort === 'ETH' 
                          ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' 
                          : 'bg-orange-900/50 text-orange-300 border border-orange-700/50'
                      }`}>
                        {tx.networkShort}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Submitted: {new Date(tx.timestamp).toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Network: {tx.network}
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
