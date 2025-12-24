// components/IOCUniverse.jsx
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';
import * as THREE from 'three';

// ============================================
// 3D IOC Node (Floating Sphere with Glow)
// ============================================
function IOCNode({ ioc, batch, position, color, onClick, isSelected }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.15;
      
      // Rotate on hover
      if (hovered || isSelected) {
        meshRef.current.rotation.y += 0.03;
        meshRef.current.rotation.x += 0.02;
      } else {
        meshRef.current.rotation.y += 0.01;
      }
      
      // Scale on hover/select
      const targetScale = isSelected ? 1.5 : hovered ? 1.3 : 1;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale), 
        0.1
      );
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(ioc, batch);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered || isSelected ? 1.0 : 0.4}
        metalness={0.9}
        roughness={0.1}
      />
      
      {/* Glow effect */}
      <pointLight 
        color={color} 
        intensity={hovered || isSelected ? 2 : 0.5} 
        distance={1} 
      />
      
      {hovered && (
        <Html distanceFactor={10}>
          <div className="bg-gray-900/95 border border-purple-500 rounded-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none shadow-xl backdrop-blur-xl">
            <p className="text-purple-400 font-mono font-bold mb-1">
              {ioc.value.length > 35 ? ioc.value.substring(0, 35) + '...' : ioc.value}
            </p>
            <p className="text-gray-400">{ioc.type.toUpperCase()}</p>
            <p className="text-gray-500 text-xs mt-1">
              {batch.source} • Batch #{batch.batchId}
            </p>
          </div>
        </Html>
      )}
    </mesh>
  );
}

// ============================================
// IOC Cluster (Group of IOCs from Same Batch)
// ============================================
function IOCCluster({ batch, position, onClick, selectedBatchId }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const isSelected = selectedBatchId === batch.batchId;
  
  useFrame((state) => {
    if (groupRef.current) {
      // Rotate cluster
      groupRef.current.rotation.y += batch.isOracle ? 0.003 : 0.002;
    }
    
    if (ringRef.current) {
      // Pulse ring on selection
      if (isSelected) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
        ringRef.current.scale.setScalar(scale);
      }
    }
  });
  
  const colors = {
    domain: '#3b82f6',  // Blue
    ip: '#10b981',      // Green
    hash: '#a855f7',    // Purple
    url: '#f59e0b',     // Orange
    other: '#6b7280'    // Gray
  };
  
  // ✅ SOURCE-SPECIFIC COLORS
  const sourceColors = {
    'AbuseIPDB': '#3b82f6',      // Blue
    'URLhaus': '#ef4444',         // Red
    'MalwareBazaar': '#a855f7',   // Purple
    'PhishTank': '#f59e0b',       // Orange
    'Community': '#10b981',       // Green
    'Anonymous': '#ec4899'        // Pink
  };
  
  // ✅ NETWORK-SPECIFIC GLOW
  const networkGlow = batch.network.includes('Ethereum') 
    ? '#60a5fa'  // Light blue for L1
    : '#c084fc'; // Light purple for L2
  
  const clusterColor = sourceColors[batch.source] || '#8b5cf6';
  
  return (
    <group ref={groupRef} position={position}>
      {/* Outer wireframe sphere (network layer) */}
      <mesh ref={ringRef}>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial
          color={networkGlow}
          transparent
          opacity={isSelected ? 0.15 : 0.05}
          wireframe
        />
      </mesh>
      
      {/* Inner wireframe sphere (source layer) */}
      <mesh>
        <sphereGeometry args={[2.8, 24, 24]} />
        <meshBasicMaterial
          color={clusterColor}
          transparent
          opacity={isSelected ? 0.12 : 0.06}
          wireframe
        />
      </mesh>
      
      {/* Central glow orb */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={clusterColor}
          emissive={clusterColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* IOC nodes orbiting */}
      {batch.iocs.slice(0, 100).map((ioc, idx) => {
        const angle = (idx / Math.min(batch.iocs.length, 100)) * Math.PI * 2;
        const radius = 2 + (Math.random() * 0.8);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 2.5;
        
        return (
          <IOCNode
            key={idx}
            ioc={ioc}
            batch={batch}
            position={[x, y, z]}
            color={colors[ioc.type] || colors.other}
            onClick={onClick}
            isSelected={isSelected}
          />
        );
      })}
      
      {/* Top icon (source identifier) */}
      <Text
        position={[0, 4.2, 0]}
        fontSize={1.0}
        anchorX="center"
        anchorY="middle"
      >
        {batch.isOracle ? '📡' : batch.source === 'Community' ? '👥' : '🔒'}
      </Text>
      
      {/* Source label */}
      <Text
        position={[0, -3.8, 0]}
        fontSize={0.45}
        color={clusterColor}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/orbitron/v29/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6xpmIyXjU1pg.woff"
      >
        {batch.source}
      </Text>
      
      {/* Network badge */}
      <Text
        position={[0, -4.5, 0]}
        fontSize={0.35}
        color={networkGlow}
        anchorX="center"
        anchorY="middle"
      >
        {batch.networkIcon} {batch.network.includes('Ethereum') ? 'Ethereum L1' : 'Arbitrum L2'}
      </Text>
      
      {/* IOC count */}
      <Text
        position={[0, -5.1, 0]}
        fontSize={0.3}
        color="#9ca3af"
        anchorX="center"
        anchorY="middle"
      >
        {batch.iocs.length.toLocaleString()} IOCs
      </Text>
      
      {/* Batch ID */}
      <Text
        position={[0, -5.6, 0]}
        fontSize={0.25}
        color="#6b7280"
        anchorX="center"
        anchorY="middle"
      >
        Batch #{batch.batchId}
      </Text>
    </group>
  );
}

// ============================================
// Main Universe Scene
// ============================================
function UniverseScene({ batches, onIOCClick, selectedBatchId }) {
  return (
    <>
      {/* Deep space background */}
      <color attach="background" args={['#000000']} />
      
      {/* Multiple star layers for depth */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Stars radius={150} depth={80} count={2000} factor={6} saturation={0} fade speed={0.5} />
      
      {/* Lighting setup */}
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#a855f7" />
      <pointLight position={[0, 15, 0]} intensity={0.6} color="#3b82f6" />
      
      {/* Fog for depth effect */}
      <fog attach="fog" args={['#000000', 30, 100]} />
      
      {/* IOC Clusters arranged in circle */}
      {batches.map((batch, idx) => {
        const totalBatches = batches.length;
        const angle = (idx / totalBatches) * Math.PI * 2;
        const radius = 8 + (totalBatches > 10 ? 2 : 0);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 2;
        
        return (
          <IOCCluster
            key={`${batch.network}-${batch.batchId}`}
            batch={batch}
            position={[x, y, z]}
            onClick={onIOCClick}
            selectedBatchId={selectedBatchId}
          />
        );
      })}
      
      {/* Camera controls */}
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={60}
        autoRotate={false}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// ============================================
// Main Component
// ============================================
export default function IOCUniverse() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [selectedIOC, setSelectedIOC] = useState(null);
  const [stats, setStats] = useState({ total: 0, byType: {}, bySource: {}, byNetwork: {} });
  const [viewMode, setViewMode] = useState('3d');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

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
      loadUniverseData();
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

  const loadUniverseData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const allBatches = [];
      const typeCount = { domain: 0, ip: 0, hash: 0, url: 0, other: 0 };
      const sourceCount = {};
      const networkCount = {};
      let totalIOCs = 0;
      
      // ✅ Load from BOTH Ethereum L1 and Arbitrum L2
      for (const network of [NETWORKS.sepolia, NETWORKS.arbitrumSepolia]) {
        console.log(`🔄 Loading batches from ${network.name}...`);
        
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
        
        // Oracle batch identifiers
        const oracleHashes = [
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_AbuseIPDB')),
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_URLhaus')),
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_MalwareBazaar')),
          ethers.keccak256(ethers.toUtf8Bytes('ORACLE_PhishTank'))
        ];
        
        for (let i = 0; i < count; i++) {
          try {
            const batch = await registry.getBatch(i);
            
            // Fetch IOC data from IPFS
            await new Promise(resolve => setTimeout(resolve, 200));
            const response = await fetch(`/api/ipfs-fetch?cid=${batch[0]}`);
            const result = await response.json();
            
            if (result.success && result.data.iocs) {
              // Determine batch source
              const isOracle = oracleHashes.includes(batch[4]);
              let source;
              
              if (isOracle) {
                source = result.data.metadata?.feedName || 'Oracle';
              } else {
                source = batch[5] ? 'Community' : 'Anonymous';
              }
              
              // Categorize each IOC
              const categorizedIOCs = result.data.iocs.map(iocValue => {
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
                
                return { value: iocValue, type };
              });
              
              totalIOCs += categorizedIOCs.length;
              sourceCount[source] = (sourceCount[source] || 0) + 1;
              networkCount[network.name] = (networkCount[network.name] || 0) + 1;
              
              allBatches.push({
                batchId: i,
                source: source,
                network: network.name,
                networkIcon: network.name.includes('Ethereum') ? '🌐' : '⚡',
                isOracle: isOracle,
                timestamp: Number(batch[2]),
                approved: batch[3],
                iocs: categorizedIOCs,
                cid: batch[0],
                confirmations: Number(batch[6]),
                disputes: Number(batch[7]),
                isPublic: batch[5]
              });
            }
          } catch (error) {
            console.error(`Error loading batch ${i} from ${network.name}:`, error.message);
          }
        }
        
        console.log(`✅ Loaded ${count} batches from ${network.name}`);
      }
      
      // Sort by timestamp (newest first)
      allBatches.sort((a, b) => b.timestamp - a.timestamp);
      
      setBatches(allBatches);
      setStats({ 
        total: totalIOCs, 
        byType: typeCount,
        bySource: sourceCount,
        byNetwork: networkCount
      });
      
      console.log(`✅ Universe loaded: ${allBatches.length} batches, ${totalIOCs} IOCs`);
      console.log(`   Sources:`, sourceCount);
      console.log(`   Networks:`, networkCount);
      
    } catch (error) {
      console.error('Error loading universe data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIOCClick = (ioc, batch) => {
    setSelectedIOC({ ...ioc, batch });
  };

  // Filter batches
  const filteredBatches = batches.filter(batch => {
    if (filter === 'all') return true;
    if (filter === 'oracle') return batch.isOracle;
    if (filter === 'community') return !batch.isOracle && batch.source === 'Community';
    if (filter === 'anonymous') return batch.source === 'Anonymous';
    if (filter === 'l1') return batch.network.includes('Ethereum');
    if (filter === 'l2') return batch.network.includes('Arbitrum');
    return true;
  });

  return (
    <div className="max-w-[1920px] mx-auto h-screen">
      <div className="bg-black h-full flex flex-col">
        
        {/* Header */}
        <div className="bg-gray-900/95 backdrop-blur-xl border-b border-gray-700/50 p-6 relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                🌌 Threat Intelligence Universe
              </h2>
              <p className="text-gray-400">Interactive cross-chain IOC visualization</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Statistics */}
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {stats.total.toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-xs">Total IOCs</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">{batches.length}</p>
                  <p className="text-gray-400 text-xs">Batches</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-400">{filteredBatches.length}</p>
                  <p className="text-gray-400 text-xs">Visible</p>
                </div>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex gap-2 border-l border-gray-700 pl-4">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === '3d'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🌌 Universe
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📋 List
                </button>
              </div>
              
              {!walletConnected && (
                <button
                  onClick={connectWallet}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-sm font-semibold mr-2">Filter:</span>
            
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🌍 All ({batches.length})
            </button>
            
            <button
              onClick={() => setFilter('oracle')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'oracle'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📡 Oracle ({batches.filter(b => b.isOracle).length})
            </button>
            
            <button
              onClick={() => setFilter('community')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'community'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              👥 Community ({batches.filter(b => !b.isOracle && b.source === 'Community').length})
            </button>
            
            <button
              onClick={() => setFilter('anonymous')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'anonymous'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🔒 Anonymous ({batches.filter(b => b.source === 'Anonymous').length})
            </button>
            
            <div className="w-px h-6 bg-gray-700 mx-2"></div>
            
            <button
              onClick={() => setFilter('l1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'l1'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🌐 Ethereum L1 ({batches.filter(b => b.network.includes('Ethereum')).length})
            </button>
            
            <button
              onClick={() => setFilter('l2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'l2'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ⚡ Arbitrum L2 ({batches.filter(b => b.network.includes('Arbitrum')).length})
            </button>
          </div>
          
          {/* Type Legend */}
          <div className="flex gap-4 mt-4 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
              <span className="text-gray-400">Domains ({stats.byType.domain || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              <span className="text-gray-400">IPs ({stats.byType.ip || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50"></div>
              <span className="text-gray-400">Hashes ({stats.byType.hash || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50"></div>
              <span className="text-gray-400">URLs ({stats.byType.url || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-gray-400">Other ({stats.byType.other || 0})</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {!walletConnected ? (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-900 via-purple-900/10 to-black">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/50">
                <span className="text-5xl">🔐</span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-3">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-8 max-w-md">
                Explore the decentralized threat intelligence universe across Ethereum L1 and Arbitrum L2
              </p>
              <button
                onClick={connectWallet}
                className="px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-2xl shadow-purple-500/30 transform hover:scale-105"
              >
                Connect MetaMask
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-900 via-purple-900/10 to-black">
            <div className="text-center">
              <div className="w-20 h-20 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-gray-300 text-lg mb-2">Scanning the threat intelligence universe...</p>
              <p className="text-gray-500 text-sm">Loading IOCs from L1 and L2 networks</p>
            </div>
          </div>
        ) : viewMode === '3d' ? (
          <div className="flex-1 relative">
            {/* 3D Canvas */}
            <Canvas
              camera={{ position: [0, 5, 20], fov: 60 }}
              className="bg-black"
              gl={{ antialias: true, alpha: false }}
            >
              <Suspense fallback={null}>
                <UniverseScene 
                  batches={filteredBatches} 
                  onIOCClick={handleIOCClick}
                  selectedBatchId={selectedIOC?.batch?.batchId}
                />
              </Suspense>
            </Canvas>
            
            {/* Controls Hint */}
            <div className="absolute bottom-6 left-6 bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-xl p-4 text-xs text-gray-400 shadow-2xl">
              <p className="font-bold text-white mb-3 text-sm">🎮 Navigation Controls</p>
              <div className="space-y-1.5">
                <p><span className="text-purple-400">🖱️ Left Click + Drag</span> → Rotate view</p>
                <p><span className="text-blue-400">🖱️ Right Click + Drag</span> → Pan camera</p>
                <p><span className="text-green-400">🖱️ Scroll Wheel</span> → Zoom in/out</p>
                <p><span className="text-orange-400">🖱️ Click IOC Sphere</span> → View details</p>
              </div>
            </div>
            
            {/* Legend */}
            <div className="absolute top-6 left-6 bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-xl p-4 text-xs shadow-2xl">
              <p className="font-bold text-white mb-3 text-sm">🎨 Source Colors</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
                  <span className="text-gray-300">📡 Oracle Feeds</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
                  <span className="text-gray-300">👥 Community</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-pink-500 shadow-lg shadow-pink-500/50"></div>
                  <span className="text-gray-300">🔒 Anonymous</span>
                </div>
              </div>
              <p className="font-bold text-white mb-2 mt-4 text-sm">🌐 Network Glow</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400"></div>
                  <span className="text-gray-300">🌐 Ethereum L1</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-purple-400"></div>
                  <span className="text-gray-300">⚡ Arbitrum L2</span>
                </div>
              </div>
            </div>
            
            {/* IOC Detail Panel */}
            <AnimatePresence>
              {selectedIOC && (
                <motion.div
                  initial={{ x: 400, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 400, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="absolute top-6 right-6 w-[420px] bg-gray-900/98 backdrop-blur-xl border-2 border-purple-500/50 rounded-2xl p-6 shadow-2xl shadow-purple-500/20"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">🎯 IOC Details</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          selectedIOC.type === 'domain' ? 'bg-blue-500/20 text-blue-400' :
                          selectedIOC.type === 'ip' ? 'bg-green-500/20 text-green-400' :
                          selectedIOC.type === 'hash' ? 'bg-purple-500/20 text-purple-400' :
                          selectedIOC.type === 'url' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {selectedIOC.type.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          selectedIOC.batch.isOracle ? 'bg-blue-500/20 text-blue-400' :
                          selectedIOC.batch.source === 'Community' ? 'bg-green-500/20 text-green-400' :
                          'bg-pink-500/20 text-pink-400'
                        }`}>
                          {selectedIOC.batch.isOracle ? '📡 ORACLE' : 
                           selectedIOC.batch.source === 'Community' ? '👥 COMMUNITY' : '🔒 ANONYMOUS'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedIOC(null)}
                      className="text-gray-400 hover:text-white text-2xl transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* IOC Value */}
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs mb-2 font-semibold">Indicator of Compromise</p>
                    <div className="bg-gray-950/70 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-purple-400 font-mono text-sm break-all leading-relaxed">
                        {selectedIOC.value}
                      </p>
                    </div>
                  </div>
                  
                  {/* Batch Context */}
                  <div className="mb-4 p-4 bg-gray-950/50 rounded-xl border border-gray-700/50">
                    <p className="text-white font-bold mb-3 flex items-center gap-2">
                      📦 Batch Context
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        selectedIOC.batch.approved 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {selectedIOC.batch.approved ? '✅ Approved' : '⏳ Pending'}
                      </span>
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 mb-1">Batch ID</p>
                        <p className="text-white font-mono font-bold">#{selectedIOC.batch.batchId}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 mb-1">Network</p>
                        <p className="text-white font-semibold">
                          {selectedIOC.batch.networkIcon} {selectedIOC.batch.network.includes('Ethereum') ? 'Ethereum L1' : 'Arbitrum L2'}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 mb-1">Source</p>
                        <p className="text-white font-semibold">{selectedIOC.batch.source}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 mb-1">Total IOCs</p>
                        <p className="text-blue-400 font-bold">{selectedIOC.batch.iocs.length}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 mb-1">Confirmations</p>
                        <p className="text-green-400 font-bold">{selectedIOC.batch.confirmations}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 mb-1">Disputes</p>
                        <p className="text-red-400 font-bold">{selectedIOC.batch.disputes}</p>
                      </div>
                      
                      <div className="col-span-2">
                        <p className="text-gray-500 mb-1">Submitted</p>
                        <p className="text-gray-300">
                          {new Date(selectedIOC.batch.timestamp * 1000).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Type Breakdown in This Batch */}
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs mb-2 font-semibold">IOC Type Distribution in Batch</p>
                    <div className="flex gap-1">
                      {['domain', 'ip', 'hash', 'url', 'other'].map(type => {
                        const count = selectedIOC.batch.iocs.filter(i => i.type === type).length;
                        const percentage = (count / selectedIOC.batch.iocs.length) * 100;
                        const typeColors = {
                          domain: 'bg-blue-500',
                          ip: 'bg-green-500',
                          hash: 'bg-purple-500',
                          url: 'bg-orange-500',
                          other: 'bg-gray-500'
                        };
                        
                        return count > 0 ? (
                          <div
                            key={type}
                            className={`${typeColors[type]} h-2 rounded-full relative group`}
                            style={{ width: `${percentage}%` }}
                            title={`${type}: ${count} (${percentage.toFixed(1)}%)`}
                          >
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {type}: {count}
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedIOC.value);
                        // Visual feedback
                        const btn = event.target;
                        const originalText = btn.textContent;
                        btn.textContent = '✅ Copied!';
                        setTimeout(() => btn.textContent = originalText, 2000);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg"
                    >
                      📋 Copy IOC to Clipboard
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${selectedIOC.batch.cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-semibold text-center transition-all"
                      >
                        📦 IPFS
                      </a>
                      
                      <a
                        href={`${selectedIOC.batch.network.includes('Ethereum') ? NETWORKS.sepolia.explorerUrl : NETWORKS.arbitrumSepolia.explorerUrl}/address/${selectedIOC.batch.network.includes('Ethereum') ? NETWORKS.sepolia.contracts.registry : NETWORKS.arbitrumSepolia.contracts.registry}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold text-center transition-all"
                      >
                        🔗 Explorer
                      </a>
                    </div>
                  </div>
                  
                  {/* Additional Info */}
                  <div className="mt-4 p-3 bg-gray-950/50 rounded-lg border border-gray-700/50">
                    <p className="text-gray-400 text-xs mb-2">Batch Quality Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all"
                          style={{ 
                            width: `${selectedIOC.batch.approved ? 100 : (selectedIOC.batch.confirmations / Math.max(selectedIOC.batch.confirmations + selectedIOC.batch.disputes, 1)) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="text-white font-bold text-sm">
                        {selectedIOC.batch.approved ? '100%' : 
                         Math.round((selectedIOC.batch.confirmations / Math.max(selectedIOC.batch.confirmations + selectedIOC.batch.disputes, 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Stats Overlay */}
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-xl px-6 py-3 shadow-2xl">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">{filteredBatches.length}</p>
                  <p className="text-gray-400 text-xs">Clusters</p>
                </div>
                <div className="w-px h-8 bg-gray-700"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {filteredBatches.reduce((sum, b) => sum + b.iocs.length, 0).toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-xs">IOCs Visible</p>
                </div>
                <div className="w-px h-8 bg-gray-700"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {filteredBatches.filter(b => b.network.includes('Ethereum')).length}
                  </p>
                  <p className="text-gray-400 text-xs">🌐 L1</p>
                </div>
                <div className="w-px h-8 bg-gray-700"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">
                    {filteredBatches.filter(b => b.network.includes('Arbitrum')).length}
                  </p>
                  <p className="text-gray-400 text-xs">⚡ L2</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex-1 overflow-auto p-6 bg-gradient-to-b from-gray-900 via-purple-900/5 to-black">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBatches.map((batch) => (
                <motion.div
                  key={`${batch.network}-${batch.batchId}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-gray-800/50 backdrop-blur-xl border-2 rounded-xl p-5 hover:scale-105 transition-all cursor-pointer shadow-xl ${
                    batch.isOracle ? 'border-blue-500/30 hover:border-blue-500/60 hover:shadow-blue-500/20' :
                    batch.source === 'Community' ? 'border-green-500/30 hover:border-green-500/60 hover:shadow-green-500/20' :
                    'border-pink-500/30 hover:border-pink-500/60 hover:shadow-pink-500/20'
                  }`}
                  onClick={() => handleIOCClick(batch.iocs[0], batch)}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">
                        {batch.isOracle ? '📡' : batch.source === 'Community' ? '👥' : '🔒'}
                      </span>
                      <div>
                        <p className="text-white font-bold text-sm">{batch.source}</p>
                        <p className="text-gray-400 text-xs">{batch.networkIcon} {batch.network.includes('Ethereum') ? 'L1' : 'L2'}</p>
                      </div>
                    </div>
                    
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      batch.approved 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {batch.approved ? '✅' : '⏳'}
                    </span>
                  </div>
                  
                  {/* Stats */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">IOCs:</span>
                      <span className="text-white font-bold">{batch.iocs.length.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Batch ID:</span>
                      <span className="text-purple-400 font-mono text-xs">#{batch.batchId}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Confirmations:</span>
                      <span className="text-green-400 font-bold">{batch.confirmations}</span>
                    </div>
                  </div>
                  
                  {/* Type Distribution Mini Bar */}
                  <div className="mb-3">
                    <p className="text-gray-500 text-xs mb-1">Type Distribution</p>
                    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                      {['domain', 'ip', 'hash', 'url'].map(type => {
                        const count = batch.iocs.filter(i => i.type === type).length;
                        const percentage = (count / batch.iocs.length) * 100;
                        const colors = {
                          domain: 'bg-blue-500',
                          ip: 'bg-green-500',
                          hash: 'bg-purple-500',
                          url: 'bg-orange-500'
                        };
                        return count > 0 ? (
                          <div 
                            key={type}
                            className={colors[type]}
                            style={{ width: `${percentage}%` }}
                            title={`${type}: ${count}`}
                          />
                        ) : null;
                      })}
                    </div>
                  </div>
                  
                  {/* Timestamp */}
                  <p className="text-gray-500 text-xs mb-3">
                    {new Date(batch.timestamp * 1000).toLocaleDateString()} at {new Date(batch.timestamp * 1000).toLocaleTimeString()}
                  </p>
                  
                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://gateway.pinata.cloud/ipfs/${batch.cid}`, '_blank');
                    }}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold transition-all"
                  >
                    📦 View on IPFS
                  </button>
                </motion.div>
              ))}
            </div>
            
            {filteredBatches.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🌌</div>
                <p className="text-gray-400 text-xl">No batches match your filter</p>
                <p className="text-gray-500 text-sm mt-2">Try selecting a different filter option</p>
              </div>
            )}
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-3 backdrop-blur-xl">
            <p className="text-red-300 text-sm">❌ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
