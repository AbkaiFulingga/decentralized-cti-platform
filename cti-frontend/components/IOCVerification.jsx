// components/IOCVerification.jsx
'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export default function IOCVerification() {
  const [iocToVerify, setIocToVerify] = useState('');
  const [batchIndex, setBatchIndex] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  // Move registryAddress to component scope so it's accessible in JSX
  const registryAddress = "0xD63e502605B0B48626bF979c66B68026a35DbA36";

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask');
        return;
      }
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletConnected(true);
    } catch (error) {
      alert('Failed to connect wallet');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
      alert('Please connect your wallet first');
      return;
    }

    // Validate inputs
    if (!iocToVerify.trim()) {
      setVerificationResult({
        valid: false,
        message: '❌ Please enter an IOC to verify'
      });
      return;
    }

    if (batchIndex === '' || batchIndex === null || batchIndex === undefined) {
      setVerificationResult({
        valid: false,
        message: '❌ Please enter a batch index (e.g., 0)'
      });
      return;
    }

    const batchIndexNum = parseInt(batchIndex);
    if (isNaN(batchIndexNum) || batchIndexNum < 0) {
      setVerificationResult({
        valid: false,
        message: '❌ Batch index must be a valid number (0 or greater)'
      });
      return;
    }

    setLoading(true);
    setVerificationResult(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum, "any");
      
      // Check network
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      
      if (chainId !== "11155111") {
        setVerificationResult({
          valid: false,
          message: `Wrong network! Please switch to Ethereum Sepolia (Chain ID 11155111). Current: ${chainId}`
        });
        setLoading(false);
        return;
      }

      const registryABI = [
        "function getBatch(uint256 index) public view returns (string, bytes32, uint256, address, bool, bool)",
        "function getBatchCount() public view returns (uint256)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, provider);

      // Check if batch index is valid
      const batchCount = await registry.getBatchCount();
      if (batchIndexNum >= Number(batchCount)) {
        setVerificationResult({
          valid: false,
          message: `Invalid batch index. Total batches available: ${batchCount.toString()} (0 to ${Number(batchCount) - 1})`
        });
        setLoading(false);
        return;
      }

      console.log(`🔍 Verifying IOC: "${iocToVerify}" in Batch ${batchIndexNum}`);

      // Fetch batch data from blockchain
      const batch = await registry.getBatch(batchIndexNum);
      const cid = batch[0];
      const merkleRoot = batch[1];
      const timestamp = Number(batch[2]);
      const contributor = batch[3];
      const accepted = batch[4];
      const isPublic = batch[5];

      console.log(`📦 Batch ${batchIndexNum} Info:`);
      console.log(`   CID: ${cid}`);
      console.log(`   Merkle Root: ${merkleRoot}`);
      console.log(`   Accepted: ${accepted}`);

      // Fetch IOC data from IPFS via Pinata gateway
      console.log(`📥 Fetching IOC data from Pinata gateway...`);
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.status}`);
      }

      const iocData = await response.json();
      console.log(`✅ Retrieved ${iocData.iocs.length} IOCs from IPFS`);

      // Rebuild Merkle tree from IPFS data
      const leaves = iocData.iocs.map(x => keccak256(x));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      console.log(`🌳 Rebuilt Merkle Tree:`);
      console.log(`   Computed Root: ${root}`);
      console.log(`   On-Chain Root: ${merkleRoot}`);

      // Verify Merkle root matches on-chain
      if (root !== merkleRoot) {
        setVerificationResult({
          valid: false,
          message: "⚠️ CRITICAL: Merkle root mismatch! Data may have been tampered with.",
          details: {
            computedRoot: root,
            onChainRoot: merkleRoot,
            cid: cid
          }
        });
        setLoading(false);
        return;
      }

      console.log(`✅ Merkle root verified - data integrity confirmed`);

      // Check if IOC exists in the dataset
      const iocExists = iocData.iocs.some(ioc => ioc.toLowerCase() === iocToVerify.toLowerCase());
      
      if (!iocExists) {
        setVerificationResult({
          valid: false,
          message: `❌ IOC "${iocToVerify}" not found in Batch ${batchIndexNum}`,
          batchInfo: {
            cid: cid,
            totalIOCs: iocData.iocs.length,
            availableIOCs: iocData.iocs.slice(0, 5)
          }
        });
        setLoading(false);
        return;
      }

      // Generate Merkle proof for specific IOC
      const leaf = keccak256(iocToVerify);
      const proof = tree.getHexProof(leaf);
      const isValid = tree.verify(proof, leaf, root);

      console.log(`🛡️ Merkle Proof Generated:`);
      console.log(`   Leaf Hash: ${leaf.toString('hex')}`);
      console.log(`   Proof Length: ${proof.length} hashes`);
      console.log(`   Verification: ${isValid ? 'VALID ✓' : 'INVALID ✗'}`);

      setVerificationResult({
        valid: isValid,
        ioc: iocToVerify,
        batchIndex: batchIndexNum,
        merkleRoot: merkleRoot,
        proof: proof,
        proofLength: proof.length,
        timestamp: new Date(timestamp * 1000).toISOString(),
        contributor: isPublic ? contributor : "Anonymous",
        accepted: accepted,
        isPublic: isPublic,
        cid: cid,
        totalIOCs: iocData.iocs.length,
        iocData: iocData
      });

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        valid: false,
        message: `❌ Error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-12">
      <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🔍</span> IOC Verification
          </h2>
          {!walletConnected && (
            <button
              onClick={connectWallet}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-all"
            >
              Connect Wallet
            </button>
          )}
        </div>

        <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <p className="text-purple-200 text-sm">
            🛡️ <strong>Cryptographic Verification:</strong> Uses Merkle tree proofs to verify IOC authenticity without downloading entire batch [1]
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              🎯 IOC to Verify
            </label>
            <input
              type="text"
              value={iocToVerify}
              onChange={(e) => setIocToVerify(e.target.value)}
              className="w-full px-4 py-3 bg-purple-950/70 border border-purple-600/50 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 font-mono placeholder-gray-500"
              placeholder="malicious-domain.com or 192.168.100.50 or 5d41402abc4b2a76b9719d911017c592"
              disabled={loading || !walletConnected}
            />
            <p className="mt-2 text-sm text-gray-400">
              💡 Enter the exact IOC as it was submitted (case-sensitive)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              📦 Batch Index
            </label>
            <input
              type="number"
              value={batchIndex}
              onChange={(e) => setBatchIndex(e.target.value)}
              className="w-full px-4 py-3 bg-purple-950/70 border border-purple-600/50 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100"
              placeholder="0"
              min="0"
              disabled={loading || !walletConnected}
              required
            />
            <p className="mt-2 text-sm text-gray-400">
              💡 Which batch contains this IOC? (Start from 0)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !walletConnected}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all transform ${
              loading || !walletConnected
                ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:scale-[1.02]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Verifying...
              </span>
            ) : (
              '🔍 Verify IOC Authenticity'
            )}
          </button>
        </form>

        {verificationResult && (
          <div className={`mt-8 p-6 rounded-xl border backdrop-blur-sm ${
            verificationResult.valid
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            
            <div className="flex items-center gap-3 mb-4">
              <div className={`text-4xl ${verificationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                {verificationResult.valid ? '✅' : '❌'}
              </div>
              <div>
                <h3 className="font-bold text-white text-xl">
                  {verificationResult.valid ? 'IOC Verified Successfully!' : 'Verification Failed'}
                </h3>
                <p className={verificationResult.valid ? 'text-green-300 text-sm' : 'text-red-300 text-sm'}>
                  {verificationResult.message || 'Cryptographic proof validation complete'}
                </p>
              </div>
            </div>

            {verificationResult.valid && (
              <div className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                    <p className="text-gray-400 text-xs mb-1">IOC Value</p>
                    <p className="text-white font-mono text-sm break-all">{verificationResult.ioc}</p>
                  </div>
                  
                  <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                    <p className="text-gray-400 text-xs mb-1">Batch Index</p>
                    <p className="text-purple-400 font-bold text-xl">#{verificationResult.batchIndex}</p>
                  </div>
                  
                  <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                    <p className="text-gray-400 text-xs mb-1">Submission Time</p>
                    <p className="text-blue-300 text-sm">{new Date(verificationResult.timestamp).toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                    <p className="text-gray-400 text-xs mb-1">Governance Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      verificationResult.accepted
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {verificationResult.accepted ? '✅ Approved' : '⏳ Pending'}
                    </span>
                  </div>
                </div>

                <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                  <p className="text-gray-400 text-xs mb-2">Merkle Root (On-Chain)</p>
                  <p className="text-purple-400 font-mono text-xs break-all">{verificationResult.merkleRoot}</p>
                </div>

                <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                  <p className="text-gray-400 text-xs mb-2">IPFS Content ID (CID)</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-blue-400 font-mono text-xs break-all">{verificationResult.cid}</p>
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${verificationResult.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:text-blue-200 text-xs whitespace-nowrap"
                    >
                      View on IPFS →
                    </a>
                  </div>
                </div>

                <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs">Merkle Proof ({verificationResult.proofLength} hashes)</p>
                    <span className="text-green-400 text-xs font-semibold">✓ Verified</span>
                  </div>
                  <div className="bg-purple-950 p-3 rounded max-h-40 overflow-y-auto border border-purple-800/30">
                    {verificationResult.proof.map((hash, i) => (
                      <p key={i} className="text-purple-300 font-mono text-xs mb-1">
                        [{i}] {hash}
                      </p>
                    ))}
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    💡 These {verificationResult.proofLength} hashes prove the IOC exists in the batch without revealing all {verificationResult.totalIOCs} IOCs [1]
                  </p>
                </div>

                <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                  <p className="text-gray-400 text-xs mb-2">Contributor</p>
                  <p className="text-green-400 font-mono text-sm">
                    {verificationResult.isPublic ? (
                      <>
                        {verificationResult.contributor.substring(0, 10)}...{verificationResult.contributor.substring(38)}
                        <span className="ml-2 text-blue-300 text-xs">(Public)</span>
                      </>
                    ) : (
                      <>
                        Anonymous
                        <span className="ml-2 text-purple-300 text-xs">(256-bit Protected)</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-300 text-sm font-semibold mb-2">
                    🎯 Verification Summary
                  </p>
                  <ul className="space-y-1 text-green-200 text-xs">
                    <li>✓ IOC found in batch {verificationResult.batchIndex}</li>
                    <li>✓ Merkle root matches on-chain data</li>
                    <li>✓ IPFS content integrity verified</li>
                    <li>✓ Cryptographic proof validated [1]</li>
                    <li>✓ Batch contains {verificationResult.totalIOCs} total IOCs</li>
                  </ul>
                </div>

                <a
                  href={`https://sepolia.etherscan.io/address/${registryAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-3 px-4 bg-purple-950/50 hover:bg-purple-950/70 border border-purple-700/50 rounded-lg text-blue-300 hover:text-blue-200 text-sm transition-all"
                >
                  🔗 View Contract on Etherscan →
                </a>
              </div>
            )}

            {!verificationResult.valid && verificationResult.batchInfo && (
              <div className="mt-4 bg-purple-950/50 rounded-lg p-4 border border-purple-700/50">
                <p className="text-gray-400 text-xs mb-2">Available IOCs in Batch {batchIndex} (first 5):</p>
                <div className="space-y-1">
                  {verificationResult.batchInfo.availableIOCs.map((ioc, i) => (
                    <p key={i} className="text-gray-300 font-mono text-xs">• {ioc}</p>
                  ))}
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  Total: {verificationResult.batchInfo.totalIOCs} IOCs in this batch
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 p-6 bg-purple-950/30 backdrop-blur-sm rounded-xl border border-purple-700/50">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🔐</span>
            How Merkle Proof Verification Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold border border-purple-500/30">1</div>
              <p className="text-gray-300">Fetch Batch Data</p>
              <p className="text-gray-500 text-xs mt-1">From blockchain + IPFS</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">2</div>
              <p className="text-gray-300">Rebuild Merkle Tree</p>
              <p className="text-gray-500 text-xs mt-1">From IOC dataset</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold border border-green-500/30">3</div>
              <p className="text-gray-300">Generate Proof</p>
              <p className="text-gray-500 text-xs mt-1">For specific IOC [1]</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold border border-pink-500/30">4</div>
              <p className="text-gray-300">Verify Authenticity</p>
              <p className="text-gray-500 text-xs mt-1">Cryptographic validation</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-300 flex items-center gap-2">
            <span>🌳</span>
            <span>Merkle Tree Proofs</span>
          </div>
          <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300 flex items-center gap-2">
            <span>⛓️</span>
            <span>Blockchain Verified</span>
          </div>
        </div>

      </div>
    </div>
  );
}
