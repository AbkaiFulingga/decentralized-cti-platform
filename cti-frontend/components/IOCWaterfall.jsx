// components/IOCWaterfall.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

// ============================================
// Single IOC Falling Card
// ============================================
function FallingIOC({ ioc, onSelect, speed, delay, columnIndex }) {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), speed + delay);
    return () => clearTimeout(timer);
  }, [speed, delay]);
  
  if (!isVisible) return null;
  
  const typeColors = {
    domain: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/50', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
    ip: { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/50', text: 'text-green-400', glow: 'shadow-green-500/30' },
    hash: { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/50', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
    url: { bg: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/50', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
    other: { bg: 'from-gray-500/20 to-gray-600/10', border: 'border-gray-500/50', text: 'text-gray-400', glow: 'shadow-gray-500/30' }
  };
  
  const colors = typeColors[ioc.type] || typeColors.other;
  
  return (
    <motion.div
      initial={{ y: -100, opacity: 0, scale: 0.8 }}
      animate={{ y: window.innerHeight + 100, opacity: [0, 1, 1, 0], scale: 1 }}
      transition={{ 
        duration: speed / 1000,
        delay: delay / 1000,
        ease: 'linear'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(ioc);
      }}
      className="absolute left-0 right-0 mx-2 cursor-pointer group"
      style={{ zIndex: 20 }}
    >
      <div className={`bg-gradient-to-br ${colors.bg} backdrop-blur-xl border-2 ${colors.border} rounded-xl p-3 shadow-2xl ${colors.glow} hover:scale-105 transition-transform`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {ioc.type === 'domain' ? '🌐' : 
               ioc.type === 'ip' ? '📍' :
               ioc.type === 'hash' ? '🔐' :
               ioc.type === 'url' ? '🔗' : '📄'}
            </span>
            <span className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
              {ioc.type}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {ioc.batch.networkIcon}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              ioc.batch.isOracle ? 'bg-blue-500/30 text-blue-300' :
              ioc.batch.source === 'Community' ? 'bg-green-500/30 text-green-300' :
              'bg-pink-500/30 text-pink-300'
            }`}>
              {ioc.batch.isOracle ? '📡' : ioc.batch.source === 'Community' ? '👥' : '🔒'}
            </span>
          </div>
        </div>
        
        <div className="mb-2">
          <p className={`font-mono text-sm ${colors.text} truncate group-hover:whitespace-normal group-hover:break-all transition-all`}>
            {ioc.value}
          </p>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Batch #{ioc.batch.batchId}</span>
          <span className="flex items-center gap-1">
            {ioc.batch.approved ? <span className="text-green-400">✓</span> : <span className="text-yellow-400">⏳</span>}
            <span>{ioc.batch.confirmations}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Waterfall Column
// ============================================
function WaterfallColumn({ iocs, column, onSelect, isPaused, speed, refreshKey }) {
  const [queue, setQueue] = useState([]);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isPaused) {
      setQueue([]);
      return;
    }
    
    if (iocs.length === 0) {
      return;
    }
    
    const firstIOC = iocs[Math.floor(Math.random() * iocs.length)];
    setQueue([{ ...firstIOC, id: `${Date.now()}-${Math.random()}` }]);
    
    intervalRef.current = setInterval(() => {
      const randomIOC = iocs[Math.floor(Math.random() * iocs.length)];
      const id = `${Date.now()}-${Math.random()}-${column}`;
      
      setQueue(prev => {
        const newQueue = [...prev, { ...randomIOC, id }];
        return newQueue.slice(-5);
      });
      
    }, speed + (column * 200));
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [iocs, column, isPaused, speed, refreshKey]);
  
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-gray-600 text-xs font-mono pointer-events-none">
        Col {column + 1}
      </div>
      
      <AnimatePresence mode="sync">
        {queue.map((item) => (
          <FallingIOC
            key={item.id}
            ioc={item}
            onSelect={onSelect}
            speed={8000}
            delay={0}
            columnIndex={column}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Main Component
// ============================================
export default function IOCWaterfall() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [allIOCs, setAllIOCs] = useState([]);
  const [selectedIOC, setSelectedIOC] = useState(null);
  const [stats, setStats] = useState({ total: 0, byType: {}, bySource: {}, byNetwork: {}, batches: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(2000);
  const [filter, setFilter] = useState('all');
  const [columns, setColumns] = useState(5);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      checkConnection();
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
      
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (walletConnected) {
      loadAllBatches();
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

  const loadAllBatches = async () => {
    setLoading(true);
    setError('');
    
    try {
      const flatIOCs = [];
      const typeCount = { domain: 0, ip: 0, hash: 0, url: 0, other: 0 };
      const sourceCount = {};
      const networkCount = {};
      let batchCount = 0;
      
      for (const network of [NETWORKS.sepolia, NETWORKS.arbitrumSepolia]) {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        
        const registryABI = [
          "function getBatchCount() public view returns (uint256)",
          "function getBatch(uint256 index) public view returns (string memory cid, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)"
        ];
        
        const registry = new ethers.Contract(
          network.contracts.registry,
          registryABI,
          provider
        );
        
        const countBigInt = await registry.getBatchCount();
        const count = Number(countBigInt);
        
        const oracleHashes = [
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_AbuseIPDB')),
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_URLhaus')),
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_MalwareBazaar')),
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_PhishTank'))
        ];
        
        for (let i = 0; i < count; i++) {
          try {
            const batch = await registry.getBatch(i);
            
            const response = await fetch(`/api/ipfs-fetch?cid=${batch[0]}`);
            const result = await response.json();
            
            if (result.success && result.data.iocs && Array.isArray(result.data.iocs)) {
              const isOracle = oracleHashes.includes(batch[4]);
              let source;
              
              if (isOracle) {
                source = result.data.metadata?.feedName || 'Oracle';
              } else {
                source = batch[5] ? 'Community' : 'Anonymous';
              }
              
              batchCount++;
              sourceCount[source] = (sourceCount[source] || 0) + 1;
              networkCount[network.name] = (networkCount[network.name] || 0) + 1;
              
              const batchContext = {
                batchId: i,
                source: source,
                network: network.name,
                networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
                networkShort: network.name.includes('Ethereum') ? 'sepolia' : 'arbitrumSepolia',
                isOracle: isOracle,
                timestamp: Number(batch[2]),
                approved: batch[3],
                cid: batch[0],
                confirmations: Number(batch[6]),
                disputes: Number(batch[7]),
                isPublic: batch[5]
              };
              
              result.data.iocs.forEach(iocValue => {
                let type = 'other';
                
                if (/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/.test(iocValue)) {
                  type = 'ip';
                  typeCount.ip++;
                } else if (/^[a-f0-9]{32,64}$/i.test(iocValue)) {
                  type = 'hash';
                  typeCount.hash++;
                } else if (/^https?:\/\//.test(iocValue)) {
                  type = 'url';
                  typeCount.url++;
                } else if (/\.[a-z]{2,}$/i.test(iocValue)) {
                  type = 'domain';
                  typeCount.domain++;
                } else {
                  typeCount.other++;
                }
                
                flatIOCs.push({
                  value: iocValue,
                  type: type,
                  batch: batchContext
                });
              });
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`Error loading batch ${i}:`, error.message);
          }
        }
      }
      
      setAllIOCs(flatIOCs);
      setStats({ 
        total: flatIOCs.length, 
        byType: typeCount,
        bySource: sourceCount,
        byNetwork: networkCount,
        batches: batchCount
      });
      
    } catch (error) {
      console.error('❌ Error loading waterfall data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIOCSelect = (ioc) => {
    setSelectedIOC(ioc);
    setIsPaused(true);
  };

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    setRefreshKey(prev => prev + 1);
  };

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    setRefreshKey(prev => prev + 1);
  };

  const handleColumnsChange = (newColumns) => {
    setColumns(newColumns);
    setRefreshKey(prev => prev + 1);
  };

  const copyToClipboard = async (text, btnElement) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        const originalText = btnElement.textContent;
        btnElement.textContent = '✅ COPIED';
        setTimeout(() => btnElement.textContent = originalText, 2000);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        const originalText = btnElement.textContent;
        btnElement.textContent = '✅ COPIED';
        setTimeout(() => btnElement.textContent = originalText, 2000);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      btnElement.textContent = '❌ FAILED';
      setTimeout(() => btnElement.textContent = '📋 COPY IOC', 2000);
    }
  };

  const filteredIOCs = allIOCs.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'oracle') return item.batch.isOracle;
    if (filter === 'community') return !item.batch.isOracle && item.batch.source === 'Community';
    if (filter === 'anonymous') return item.batch.source === 'Anonymous';
    if (filter === 'l1') return item.batch.network.includes('Ethereum');
    if (filter === 'l2') return item.batch.network.includes('Arbitrum');
    if (filter === 'domain') return item.type === 'domain';
    if (filter === 'ip') return item.type === 'ip';
    if (filter === 'hash') return item.type === 'hash';
    if (filter === 'url') return item.type === 'url';
    return true;
  });

  const columnData = Array.from({ length: columns }, (_, i) => 
    filteredIOCs.filter((_, idx) => idx % columns === i)
  );

  const getRegistryAddress = (networkShort) => {
    return NETWORKS[networkShort].contracts.registry;
  };

  const getExplorerUrl = (networkShort) => {
    return NETWORKS[networkShort].explorerUrl;
  };

  return (
    <div className="w-full h-screen overflow-hidden relative bg-black">
      
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridScroll 20s linear infinite'
        }}></div>
      </div>
      
      <style jsx>{`
        @keyframes gridScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
      
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" 
             style={{ animation: 'scanline 4s linear infinite' }}></div>
      </div>
      
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-gray-900 via-gray-900/95 to-transparent backdrop-blur-xl border-b border-purple-500/30 p-4" style={{ zIndex: 100 }}>
        <div className="max-w-7xl mx-auto">
          
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 mb-1 flex items-center gap-2">
                <span className="animate-pulse">💧</span>
                Cyber Waterfall
                <span className="animate-pulse">💧</span>
              </h2>
              <p className="text-gray-400 text-sm font-mono">Real-time threat intelligence stream</p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  {stats.total.toLocaleString()}
                </p>
                <p className="text-gray-400 text-xs">IOCs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">{stats.batches}</p>
                <p className="text-gray-400 text-xs">Batches</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">{filteredIOCs.length.toLocaleString()}</p>
                <p className="text-gray-400 text-xs">Visible</p>
              </div>
              
              {!walletConnected && (
                <button
                  onClick={connectWallet}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-purple-500/50"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-xs font-bold mr-2 font-mono">FILTER:</span>
            
            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === 'all' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
              🌍 ALL ({allIOCs.length})
            </button>
            
            <button onClick={() => setFilter('community')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === 'community' ? 'bg-green-600 text-white shadow-lg shadow-green-500/50' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
              👥 COMMUNITY ({allIOCs.filter(i => !i.batch.isOracle && i.batch.source === 'Community').length})
            </button>
            
            <button onClick={() => setFilter('l1')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === 'l1' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
              🌐 L1 ({allIOCs.filter(i => i.batch.network.includes('Ethereum')).length})
            </button>
            
            <button onClick={() => setFilter('l2')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === 'l2' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
              ⚡ L2 ({allIOCs.filter(i => i.batch.network.includes('Arbitrum')).length})
            </button>
            
            <div className="w-px h-5 bg-gray-700"></div>
            
            <button onClick={() => setFilter('domain')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === 'domain' ? 'bg-blue-600 text-white' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
              🌐 DOMAINS ({stats.byType.domain || 0})
            </button>
            
            <button onClick={() => setFilter('ip')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === 'ip' ? 'bg-green-600 text-white' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 border border-gray-700'}`}>
              📍 IPs ({stats.byType.ip || 0})
            </button>
            
            <div className="w-px h-5 bg-gray-700 ml-auto"></div>
            
            <button onClick={handlePauseToggle} className={`px-4 py-1 rounded text-xs font-bold transition-all ${isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {isPaused ? '▶️ RESUME' : '⏸️ PAUSE'}
            </button>
            
            <select value={speed} onChange={(e) => handleSpeedChange(Number(e.target.value))} className="px-3 py-1 rounded text-xs font-bold bg-gray-800/80 text-gray-300 border border-gray-700 hover:bg-gray-700">
              <option value={800}>⚡⚡⚡</option>
              <option value={1000}>⚡⚡ Fast</option>
              <option value={2000}>➡️ Normal</option>
              <option value={4000}>🐌 Slow</option>
              <option value={6000}>🐢 Chill</option>
            </select>
            
            <button onClick={loadAllBatches} disabled={loading} className="px-4 py-1 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-all disabled:opacity-50">
              🔄
            </button>
          </div>
        </div>
      </div>

      {!walletConnected ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/50 animate-pulse">
              <span className="text-5xl">🔐</span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-3">Connect Your Wallet</h3>
            <p className="text-gray-400 mb-8 max-w-md">Watch the cyber waterfall of threat intelligence IOCs</p>
            <button onClick={connectWallet} className="px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-2xl shadow-purple-500/30 transform hover:scale-105">
              Connect MetaMask
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-gray-300 text-lg mb-2">Initializing cyber waterfall...</p>
            <p className="text-gray-500 text-sm">Loading IOCs from L1 and L2 networks</p>
          </div>
        </div>
      ) : allIOCs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-8xl mb-6">💧</div>
            <h3 className="text-3xl font-bold text-white mb-3">No IOCs Found</h3>
            <p className="text-gray-400 text-lg mb-6">No batches have been submitted yet</p>
            <button onClick={loadAllBatches} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all">
              🔄 Retry Loading
            </button>
          </div>
        </div>
      ) : filteredIOCs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-8xl mb-6">🔍</div>
            <h3 className="text-3xl font-bold text-white mb-3">No IOCs Match Filter</h3>
            <p className="text-gray-500 text-sm mb-6">Total: {allIOCs.length} IOCs available</p>
            <button onClick={() => setFilter('all')} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all">
              🌍 Show All IOCs
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="h-full grid pt-32 pb-16 px-4 gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {columnData.map((columnIOCs, idx) => (
              <WaterfallColumn
                key={`col-${idx}-${refreshKey}`}
                iocs={columnIOCs}
                column={idx}
                onSelect={handleIOCSelect}
                isPaused={isPaused}
                speed={speed}
                refreshKey={refreshKey}
              />
            ))}
          </div>
          
          <div className="absolute left-4 top-32 bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-xl p-4 shadow-2xl max-w-xs" style={{ zIndex: 90 }}>
            <p className="text-white font-bold mb-3 text-sm flex items-center gap-2 font-mono">
              <span className="animate-pulse">📊</span>
              LIVE STATS
            </p>
            
            <div className="space-y-3 text-xs font-mono">
              <div>
                <p className="text-gray-400 mb-1.5">IOC TYPES:</p>
                <div className="space-y-1.5">
                  {Object.entries(stats.byType).map(([type, count]) => count > 0 && (
                    <div key={type} className="flex items-center gap-2">
                      <span className="text-gray-400 w-16 capitalize">{type}:</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            type === 'domain' ? 'bg-blue-500' :
                            type === 'ip' ? 'bg-green-500' :
                            type === 'hash' ? 'bg-purple-500' :
                            type === 'url' ? 'bg-orange-500' :
                            'bg-gray-500'
                          }`}
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-white w-12 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {Object.keys(stats.byNetwork).length > 0 && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-gray-400 mb-1.5">NETWORKS:</p>
                  {Object.entries(stats.byNetwork).map(([network, count]) => (
                    <div key={network} className="flex justify-between items-center">
                      <span className="text-gray-300">
                        {network.includes('Ethereum') ? '🌐 L1' : '⚡ L2'}
                      </span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {Object.keys(stats.bySource).length > 0 && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-gray-400 mb-1.5">SOURCES:</p>
                  {Object.entries(stats.bySource).map(([source, count]) => (
                    <div key={source} className="flex justify-between items-center">
                      <span className="text-gray-300">
                        {source === 'Community' ? '👥' : '🔒'} {source}
                      </span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="absolute right-4 top-32 bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-2xl" style={{ zIndex: 90 }}>
            <p className="text-white font-bold mb-3 text-sm font-mono">⚙️ CONTROLS</p>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-mono w-20">Speed:</span>
                <select value={speed} onChange={(e) => handleSpeedChange(Number(e.target.value))} className="flex-1 px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700 font-mono text-xs">
                  <option value={800}>⚡⚡⚡</option>
                  <option value={1000}>⚡⚡ Fast</option>
                  <option value={2000}>➡️ Normal</option>
                  <option value={4000}>🐌 Slow</option>
                  <option value={6000}>🐢 Chill</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-mono w-20">Columns:</span>
                <input type="range" min="3" max="12" value={columns} onChange={(e) => handleColumnsChange(Number(e.target.value))} className="flex-1" />
                <span className="text-white font-mono w-6">{columns}</span>
              </div>
              
              <button onClick={handlePauseToggle} className={`w-full py-2 rounded font-bold transition-all mt-3 ${isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                {isPaused ? '▶️ RESUME' : '⏸️ PAUSE'}
              </button>
              
              <button onClick={loadAllBatches} disabled={loading} className="w-full py-2 rounded font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-50">
                🔄 REFRESH
              </button>
            </div>
          </div>
        </>
      )}
      
      <AnimatePresence>
        {selectedIOC && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedIOC(null);
                setIsPaused(false);
              }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
              style={{ zIndex: 9998 }}
            />
            
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 9999 }}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 50 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-[650px] max-w-[90vw] max-h-[90vh] overflow-y-auto bg-gray-900 border-4 border-purple-500 rounded-2xl p-8 shadow-2xl pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-2 font-mono">
                      THREAT INDICATOR
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        selectedIOC.type === 'domain' ? 'bg-blue-500/30 text-blue-300 border border-blue-500' :
                        selectedIOC.type === 'ip' ? 'bg-green-500/30 text-green-300 border border-green-500' :
                        selectedIOC.type === 'hash' ? 'bg-purple-500/30 text-purple-300 border border-purple-500' :
                        selectedIOC.type === 'url' ? 'bg-orange-500/30 text-orange-300 border border-orange-500' :
                        'bg-gray-500/30 text-gray-300 border border-gray-500'
                      }`}>
                        {selectedIOC.type.toUpperCase()}
                      </span>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        selectedIOC.batch.isOracle ? 'bg-blue-500/30 text-blue-300 border border-blue-500' :
                        selectedIOC.batch.source === 'Community' ? 'bg-green-500/30 text-green-300 border border-green-500' :
                        'bg-pink-500/30 text-pink-300 border border-pink-500'
                      }`}>
                        {selectedIOC.batch.isOracle ? '📡 ORACLE' : 
                         selectedIOC.batch.source === 'Community' ? '👥 COMMUNITY' : '🔒 ANONYMOUS'}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIOC(null);
                      setIsPaused(false);
                    }}
                    className="text-gray-400 hover:text-white text-3xl transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="mb-6 p-5 bg-black/50 border-2 border-cyan-500/50 rounded-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse"></div>
                  <p className="text-cyan-400 font-mono text-lg break-all leading-relaxed relative z-10">
                    {selectedIOC.value}
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1 font-mono">BATCH</p>
                    <p className="text-purple-400 font-mono font-bold text-lg">#{selectedIOC.batch.batchId}</p>
                  </div>
                  
                  <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1 font-mono">NETWORK</p>
                    <p className="text-white font-bold text-sm">
                      {selectedIOC.batch.networkIcon} {selectedIOC.batch.network.includes('Ethereum') ? 'L1' : 'L2'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1 font-mono">STATUS</p>
                    <p className={`font-bold text-sm ${selectedIOC.batch.approved ? 'text-green-400' : 'text-yellow-400'}`}>
                      {selectedIOC.batch.approved ? '✅' : '⏳'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1 font-mono">CONFIRMS</p>
                    <p className="text-green-400 font-bold text-lg">{selectedIOC.batch.confirmations}</p>
                  </div>
                  
                  <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1 font-mono">DISPUTES</p>
                    <p className="text-red-400 font-bold text-lg">{selectedIOC.batch.disputes}</p>
                  </div>
                  
                  <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1 font-mono">SOURCE</p>
                    <p className="text-cyan-400 font-bold text-xs">{selectedIOC.batch.source}</p>
                  </div>
                </div>
                
                <div className="mb-6 p-4 bg-gray-950/50 border border-gray-700 rounded-xl">
                  <p className="text-gray-400 text-xs mb-2 font-mono">QUALITY SCORE</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${selectedIOC.batch.approved ? 100 : (selectedIOC.batch.confirmations / Math.max(selectedIOC.batch.confirmations + selectedIOC.batch.disputes, 1)) * 100}%` 
                        }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-green-500 via-cyan-500 to-blue-500"
                      ></motion.div>
                    </div>
                    <span className="text-white font-bold text-lg font-mono">
                      {selectedIOC.batch.approved ? '100%' : 
                       Math.round((selectedIOC.batch.confirmations / Math.max(selectedIOC.batch.confirmations + selectedIOC.batch.disputes, 1)) * 100)}%
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(selectedIOC.value, e.currentTarget);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30"
                  >
                    📋 COPY IOC
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${selectedIOC.batch.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="py-3 bg-cyan-600/20 hover:bg-cyan-600/40 border-2 border-cyan-500/50 text-cyan-300 rounded-xl font-bold text-center transition-all flex items-center justify-center text-sm"
                    >
                      📦 IPFS Data
                    </a>
                    
                    <a
                      href={`${getExplorerUrl(selectedIOC.batch.networkShort)}/address/${getRegistryAddress(selectedIOC.batch.networkShort)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="py-3 bg-green-600/20 hover:bg-green-600/40 border-2 border-green-500/50 text-green-300 rounded-xl font-bold text-center transition-all flex items-center justify-center text-sm"
                    >
                      🔗 Explorer
                    </a>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIOC(null);
                      setIsPaused(false);
                    }}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 text-gray-300 rounded-xl font-bold transition-all"
                  >
                    ← CLOSE & RESUME
                  </button>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-xs mb-1 font-mono">TIMESTAMP</p>
                  <p className="text-gray-300 text-xs">{new Date(selectedIOC.batch.timestamp * 1000).toLocaleString()}</p>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      
      {walletConnected && !loading && filteredIOCs.length > 0 && !selectedIOC && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent backdrop-blur-xl border-t border-cyan-500/30 p-3" style={{ zIndex: 80 }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
                <span className="text-gray-400">{isPaused ? 'PAUSED' : 'LIVE'}</span>
              </div>
              
              <span className="text-gray-500">|</span>
              <span className="text-cyan-400">{filteredIOCs.length} IOCs</span>
              <span className="text-gray-500">|</span>
              <span className="text-purple-400">{columns} cols × {speed / 1000}s</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              <span className="text-gray-400">
                {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="fixed top-20 left-1/2 bg-red-500/10 border-2 border-red-500/50 rounded-xl px-6 py-3 backdrop-blur-xl" style={{ zIndex: 150, transform: 'translateX(-50%)' }}>
          <p className="text-red-300 text-sm font-mono">❌ {error}</p>
        </div>
      )}
    </div>
  );
}
