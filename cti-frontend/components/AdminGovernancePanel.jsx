// components/AdminGovernancePanel.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function AdminGovernancePanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingBatches, setPendingBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvingBatch, setApprovingBatch] = useState(null);
  const [error, setError] = useState('');

  const registryAddress = "0xD63e502605B0B48626bF979c66B68026a35DbA36";
  const governanceAddress = "0x2b86E798F7677d40b90Bd92BeA2e722cb36341fe";

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadPendingBatches();
      const interval = setInterval(loadPendingBatches, 10000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask');
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setWalletAddress(userAddress);

      const governanceABI = [
        "function admins(address) external view returns (bool)"
      ];

      const governance = new ethers.Contract(governanceAddress, governanceABI, provider);
      const adminStatus = await governance.admins(userAddress);

      setIsAdmin(adminStatus);
      setLoading(false);

      if (!adminStatus) {
        setError('Access Denied: Your wallet is not authorized as an admin');
      }
    } catch (error) {
      console.error('Admin check error:', error);
      setError(`Failed to check admin status: ${error.message}`);
      setLoading(false);
    }
  };

  const loadPendingBatches = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const registryABI = [
        "function getBatchCount() public view returns (uint256)",
        "function getBatch(uint256 index) public view returns (string, bytes32, uint256, bool, bytes32, bool, uint256, uint256)"
      ];

      // CORRECTED: Use proper struct return type
      const governanceABI = [
        "function getBatchApprovalStatus(uint256 batchIndex) external view returns (uint256 approvals, bool executed, uint256 createdAt)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);
      const governance = new ethers.Contract(governanceAddress, governanceABI, provider);

      const batchCount = await registry.getBatchCount();
      const pending = [];

      for (let i = 0; i < Number(batchCount); i++) {
        const batch = await registry.getBatch(i);
        const accepted = batch[3];

        if (!accepted) {
          // Use getBatchApprovalStatus instead of nested mapping
          const approvalStatus = await governance.getBatchApprovalStatus(i);
          const approvalCount = Number(approvalStatus[0]); // approvals
          const executed = approvalStatus[1]; // executed
          
          // Check if current admin has approved using EVENTS (workaround)
          // Since we can't query nested mapping directly, assume not approved
          // User will get "Already approved" error if they try to approve again
          const currentAdminApproved = false; // Cannot query nested mapping

          // Fetch IOC count from IPFS
          let iocCount = 0;
          try {
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${batch[0]}`);
            const iocData = await response.json();
            iocCount = iocData.iocs?.length || iocData.flatIOCs?.length || 0;
          } catch (err) {
            console.error(`Failed to fetch IOC count for batch ${i}:`, err);
          }

          pending.push({
            index: i,
            cid: batch[0],
            merkleRoot: batch[1],
            timestamp: Number(batch[2]),
            contributorHash: batch[4],
            isPublic: batch[5],
            iocCount: iocCount,
            approvalCount: approvalCount,
            currentAdminApproved: currentAdminApproved, // Will show button, catch error if duplicate
            contributor: batch[5] ? ethers.getAddress('0x' + batch[4].slice(26)) : 'Anonymous'
          });
        }
      }

      setPendingBatches(pending);
    } catch (error) {
      console.error('Error loading pending batches:', error);
    }
  };

  const approveBatch = async (batchIndex) => {
    setApproving(true);
    setApprovingBatch(batchIndex);
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      const signer = await provider.getSigner();

      const governanceABI = [
        "function approveBatch(uint256 batchIndex) external"
      ];

      const governance = new ethers.Contract(governanceAddress, governanceABI, signer);

      console.log(`Approving batch ${batchIndex}...`);
      const tx = await governance.approveBatch(batchIndex);
      
      console.log('Transaction sent, waiting for confirmation...');
      await tx.wait();

      alert(`✅ Batch ${batchIndex} approved successfully!`);
      
      // Reload pending batches
      await loadPendingBatches();
    } catch (error) {
      console.error('Approval error:', error);
      
      if (error.message.includes('Already approved')) {
        alert('ℹ️ You have already approved this batch');
      } else if (error.message.includes('user rejected')) {
        alert('❌ Transaction cancelled');
      } else {
        alert(`❌ Approval failed: ${error.message}`);
      }
    } finally {
      setApproving(false);
      setApprovingBatch(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            <p>Checking admin status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isAdmin) {
    return (
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚫</span>
            <div>
              <p className="text-red-300 font-semibold text-lg">Admin Access Required</p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
              <p className="text-gray-400 text-sm mt-2">
                Connected: {walletAddress.substring(0, 10)}...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-12">
      <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🛡️</span> Admin Governance Panel
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Admin:</span>
            <span className="text-green-400 font-mono text-sm">
              {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
            </span>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-xs font-semibold">Admin</span>
            </div>
          </div>
        </div>

        {pendingBatches.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-gray-400 text-lg">No pending batches awaiting approval</p>
            <p className="text-gray-500 text-sm mt-2">All submitted batches have been reviewed</p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-300 text-sm flex items-center gap-2">
                <span>📋</span>
                <span className="font-semibold">{pendingBatches.length} pending batch(es)</span> awaiting approval (2 of 3 threshold)
              </p>
            </div>

            <div className="space-y-4">
              {pendingBatches.map((batch) => (
                <div
                  key={batch.index}
                  className="bg-purple-950/50 rounded-xl p-6 border border-purple-700/50 hover:border-purple-600/70 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">⏳</div>
                      <div>
                        <h3 className="text-white font-bold text-lg">
                          Batch #{batch.index}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {new Date(batch.timestamp * 1000).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
                        <span className="text-yellow-300 font-semibold text-sm">
                          {batch.approvalCount} of 2 votes
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        batch.isPublic
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {batch.isPublic ? '🌐 Public' : '👤 Anonymous'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                      <p className="text-gray-400 text-xs mb-1">IOC Count</p>
                      <p className="text-purple-300 font-bold text-xl">{batch.iocCount}</p>
                    </div>

                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                      <p className="text-gray-400 text-xs mb-1">CID</p>
                      <p className="text-blue-400 font-mono text-xs truncate">{batch.cid}</p>
                    </div>

                    {batch.isPublic && (
                      <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                        <p className="text-gray-400 text-xs mb-1">Contributor</p>
                        <p className="text-green-400 font-mono text-xs truncate">
                          {batch.contributor.substring(0, 10)}...
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm font-mono mb-4">
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-800/30">
                      <p className="text-gray-400 text-xs mb-1">Merkle Root</p>
                      <p className="text-purple-400 text-xs break-all">{batch.merkleRoot}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => approveBatch(batch.index)}
                      disabled={approving && approvingBatch === batch.index}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                        (approving && approvingBatch === batch.index)
                          ? 'bg-gray-700 text-gray-400 cursor-wait'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {(approving && approvingBatch === batch.index) ? '⏳ Approving...' : '✅ Approve Batch'}
                    </button>

                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${batch.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm transition-all"
                    >
                      📁 Inspect IOCs
                    </a>

                    <a
                      href={`https://sepolia.etherscan.io/address/${governanceAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 rounded-lg text-pink-300 text-sm transition-all"
                    >
                      🔗 View Contract
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
