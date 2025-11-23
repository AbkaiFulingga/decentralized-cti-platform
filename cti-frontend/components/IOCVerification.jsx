// components/IOCVerification.jsx
'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { getRegistryContract, getCurrentNetwork, getExplorerUrl, getIPFSUrl } from '../utils/contract-helpers';

export default function IOCVerification() {
  const [iocToVerify, setIocToVerify] = useState('');
  const [batchIndex, setBatchIndex] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState('');

  const verifyIOC = async () => {
    if (!iocToVerify.trim()) {
      alert('Please enter an IOC to verify');
      return;
    }

    if (!batchIndex.trim()) {
      alert('Please enter a batch index (e.g., 0)');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { config } = await getCurrentNetwork();
      setCurrentNetwork(config.name);

      const registry = await getRegistryContract();
      const batchCount = await registry.getBatchCount();

      const index = parseInt(batchIndex);
      if (isNaN(index) || index < 0 || index >= Number(batchCount)) {
        alert(`Invalid batch index. Total batches: ${batchCount} (0 to ${Number(batchCount) - 1})`);
        setLoading(false);
        return;
      }

      const batch = await registry.getBatch(index);
      const cid = batch[0];
      const onChainRoot = batch[1];
      const timestamp = Number(batch[2]);
      const accepted = batch[3];
      const isPublic = batch[5];

      const ipfsUrl = getIPFSUrl(cid);
      const response = await fetch(ipfsUrl);
      const iocData = await response.json();

      const iocs = iocData.iocs || iocData.flatIOCs || [];
      const leaves = iocs.map(x => keccak256(x));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const computedRoot = tree.getHexRoot();

      if (computedRoot !== onChainRoot) {
        setResult({
          success: false,
          error: "⚠️ CRITICAL: Data may have been tampered with",
          details: {
            expected: onChainRoot,
            computed: computedRoot
          }
        });
        setLoading(false);
        return;
      }

      const iocExists = iocs.some(ioc => 
        ioc.toLowerCase() === iocToVerify.toLowerCase().trim()
      );

      if (!iocExists) {
        setResult({
          success: false,
          error: "❌ IOC not found in this batch",
          availableIOCs: iocs.slice(0, 5)
        });
        setLoading(false);
        return;
      }

      const leaf = keccak256(iocToVerify.trim());
      const proof = tree.getHexProof(leaf);
      const verified = tree.verify(proof, leaf, computedRoot);

      setResult({
        success: verified,
        ioc: iocToVerify.trim(),
        batchIndex: index,
        timestamp: new Date(timestamp * 1000).toLocaleString(),
        accepted: accepted,
        merkleRoot: onChainRoot,
        cid: cid,
        proof: proof,
        iocCount: iocs.length,
        isPublic: isPublic,
        explorerUrl: getExplorerUrl(config.contracts.registry),
        ipfsUrl: ipfsUrl
      });

      setLoading(false);
    } catch (error) {
      console.error('Verification error:', error);
      alert(`Verification failed: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-12">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span>🔍</span> IOC Verification
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              IOC to Verify
            </label>
            <input
              type="text"
              value={iocToVerify}
              onChange={(e) => setIocToVerify(e.target.value)}
              placeholder="e.g., malicious-domain.com"
              className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 placeholder-gray-500 font-mono"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Batch Index
            </label>
            <input
              type="text"
              value={batchIndex}
              onChange={(e) => setBatchIndex(e.target.value)}
              placeholder="e.g., 0"
              className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 placeholder-gray-500"
              disabled={loading}
            />
          </div>

          <button
            onClick={verifyIOC}
            disabled={loading}
            className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
              loading
                ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
            }`}
          >
            {loading ? '⏳ Verifying...' : '🔍 Verify IOC Authenticity'}
          </button>
        </div>

        {result && (
          <div className={`p-6 rounded-xl border ${
            result.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {result.success ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-green-300 mb-4">
                  ✅ IOC Verified Successfully!
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="bg-gray-900/30 rounded-lg p-3">
                    <p className="text-gray-400 mb-1">IOC Value</p>
                    <p className="text-white font-mono">{result.ioc}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <p className="text-gray-400 mb-1">Batch Index</p>
                      <p className="text-purple-300 font-bold">#{result.batchIndex}</p>
                    </div>
                    
                    <div className="bg-gray-900/30 rounded-lg p-3">
                      <p className="text-gray-400 mb-1">Status</p>
                      <p className={result.accepted ? 'text-green-400' : 'text-yellow-400'}>
                        {result.accepted ? '✅ Approved' : '⏳ Pending'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-900/30 rounded-lg p-3">
                    <p className="text-gray-400 mb-1">Merkle Root</p>
                    <p className="text-purple-400 font-mono text-xs break-all">{result.merkleRoot}</p>
                  </div>

                  <div className="bg-gray-900/30 rounded-lg p-3">
                    <p className="text-gray-400 mb-1">Merkle Proof ({result.proof.length} hashes)</p>
                    <div className="space-y-1">
                      {result.proof.map((hash, idx) => (
                        <p key={idx} className="text-blue-400 font-mono text-xs break-all">
                          [{idx}] {hash}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-green-900/30 rounded-lg p-4 border border-green-700/50">
                    <p className="text-green-300 font-semibold mb-2">🎯 Verification Summary:</p>
                    <ul className="space-y-1 text-green-200 text-xs">
                      <li>✓ IOC found in batch {result.batchIndex}</li>
                      <li>✓ Merkle root matches on-chain data</li>
                      <li>✓ IPFS content integrity verified</li>
                      <li>✓ Cryptographic proof validated</li>
                      <li>✓ Batch contains {result.iocCount} total IOCs</li>
                      <li>✓ {result.accepted ? 'Approved by governance' : 'Awaiting governance approval'}</li>
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={result.ipfsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm"
                    >
                      📁 View on IPFS
                    </a>
                    <a
                      href={result.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm"
                    >
                      🔗 View on Explorer
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold text-red-300 mb-4">
                  {result.error}
                </h3>
                {result.availableIOCs && (
                  <div className="mt-4">
                    <p className="text-gray-400 text-sm mb-2">Available IOCs in this batch (first 5):</p>
                    <ul className="space-y-1">
                      {result.availableIOCs.map((ioc, idx) => (
                        <li key={idx} className="text-blue-400 font-mono text-xs">{idx + 1}. {ioc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
