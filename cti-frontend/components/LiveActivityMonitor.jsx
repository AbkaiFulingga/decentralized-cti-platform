// components/LiveActivityMonitor.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function LiveActivityMonitor({ registryAddress, registryABI, network }) {
  const [recentActivities, setRecentActivities] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({
    totalProofs: 0,
    anonymousProofs: 0,
    publicProofs: 0
  });

  useEffect(() => {
    if (!registryAddress || !registryABI) return;

    let provider;
    let contract;

    const startMonitoring = async () => {
      try {
        // Connect to provider
        provider = new ethers.JsonRpcProvider(network.rpcUrl);
        contract = new ethers.Contract(registryAddress, registryABI, provider);

        setIsMonitoring(true);

        // Listen for ProofVerified events (anonymous submissions)
        contract.on('ProofVerified', (submitter, batchId, timestamp, event) => {
          const activity = {
            id: event.log.transactionHash + '-' + event.log.index,
            type: 'zkproof',
            submitter: submitter,
            batchId: batchId.toString(),
            timestamp: new Date(Number(timestamp) * 1000),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            isAnonymous: submitter === ethers.ZeroAddress
          };

          setRecentActivities(prev => [activity, ...prev.slice(0, 9)]);
          setStats(prev => ({
            totalProofs: prev.totalProofs + 1,
            anonymousProofs: prev.anonymousProofs + (activity.isAnonymous ? 1 : 0),
            publicProofs: prev.publicProofs + (activity.isAnonymous ? 0 : 1)
          }));
        });

        // Listen for BatchAdded events (public submissions)
        contract.on('BatchAdded', (contributor, batchIndex, ipfsHash, merkleRoot, event) => {
          const activity = {
            id: event.log.transactionHash + '-' + event.log.index,
            type: 'batch',
            submitter: contributor,
            batchId: batchIndex.toString(),
            timestamp: new Date(),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            ipfsHash: ipfsHash,
            isAnonymous: false
          };

          setRecentActivities(prev => [activity, ...prev.slice(0, 9)]);
          setStats(prev => ({
            totalProofs: prev.totalProofs + 1,
            anonymousProofs: prev.anonymousProofs,
            publicProofs: prev.publicProofs + 1
          }));
        });

        console.log('✅ Live activity monitor started');
      } catch (error) {
        console.error('Failed to start monitoring:', error);
        setIsMonitoring(false);
      }
    };

    startMonitoring();

    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
      setIsMonitoring(false);
    };
  }, [registryAddress, registryABI, network]);

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const shortAddress = (addr) => {
    if (!addr || addr === ethers.ZeroAddress) return 'Anonymous 🎭';
    return `${addr.substring(0, 6)}...${addr.substring(38)}`;
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-2xl border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <h3 className="text-2xl font-bold text-white">
            🔴 Live Network Activity
          </h3>
        </div>
        <div className="text-sm text-gray-400">
          {isMonitoring ? 'Monitoring...' : 'Offline'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-3xl font-bold text-white">{stats.totalProofs}</p>
          <p className="text-xs text-gray-400 mt-1">Total Submissions</p>
        </div>
        <div className="bg-purple-900 bg-opacity-30 p-4 rounded-lg text-center border border-purple-500">
          <p className="text-3xl font-bold text-purple-400">{stats.anonymousProofs}</p>
          <p className="text-xs text-gray-400 mt-1">zkSNARK Proofs 🎭</p>
        </div>
        <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg text-center border border-blue-500">
          <p className="text-3xl font-bold text-blue-400">{stats.publicProofs}</p>
          <p className="text-xs text-gray-400 mt-1">Public Submissions</p>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {recentActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">👀</p>
            <p>Waiting for network activity...</p>
            <p className="text-sm mt-2">Submit an IOC batch to see it appear here!</p>
          </div>
        ) : (
          recentActivities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-300 hover:scale-102 ${
                activity.isAnonymous
                  ? 'bg-purple-900 bg-opacity-20 border-purple-500 hover:bg-opacity-30'
                  : 'bg-blue-900 bg-opacity-20 border-blue-500 hover:bg-opacity-30'
              }`}
            >
              {/* Icon */}
              <div className="text-3xl">
                {activity.isAnonymous ? '🎭' : '👤'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-semibold ${activity.isAnonymous ? 'text-purple-400' : 'text-blue-400'}`}>
                    {shortAddress(activity.submitter)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    submitted IOC batch #{activity.batchId}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{formatTimeAgo(activity.timestamp)}</span>
                  <span>Block: {activity.blockNumber}</span>
                  {activity.isAnonymous && (
                    <span className="bg-purple-500 bg-opacity-20 px-2 py-1 rounded text-purple-400 font-semibold">
                      zkSNARK
                    </span>
                  )}
                </div>
              </div>

              {/* Transaction Link */}
              <a
                href={`${network.blockExplorer}/tx/${activity.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                title="View on block explorer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>🔐</span>
          <span>
            zkSNARK proofs (🎭) provide <strong className="text-purple-400">1/100 anonymity</strong> - 
            any of 100 contributors could have submitted
          </span>
        </div>
      </div>
    </div>
  );
}
