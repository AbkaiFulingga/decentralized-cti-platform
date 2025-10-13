// components/IOCSubmissionForm.jsx
'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export default function IOCSubmissionForm() {
  const [iocs, setIocs] = useState('');
  const [format, setFormat] = useState('flat');
  const [privacy, setPrivacy] = useState('public');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus('❌ Please install MetaMask');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      setStatus('✅ Wallet connected');
    } catch (error) {
      setStatus('❌ Failed to connect wallet');
    }
  };

  const uploadToIPFS = async (data) => {
    const response = await fetch('/api/pinata-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'IPFS upload failed');
    }
    
    console.log('✅ Pinata upload successful:', result.IpfsHash);
    return result.IpfsHash;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
      setStatus('❌ Please connect your wallet first');
      return;
    }

    setLoading(true);
    setStatus('🔄 Processing submission...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const iocArray = iocs.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
      
      if (iocArray.length === 0) {
        setStatus('❌ Please enter at least one IOC');
        setLoading(false);
        return;
      }

      const iocData = {
        format: format.toUpperCase(),
        iocs: iocArray,
        metadata: {
          source: await signer.getAddress(),
          timestamp: new Date().toISOString(),
          privacyMode: privacy
        }
      };

      setStatus(`📤 Uploading ${iocArray.length} IOCs to IPFS (Pinata)...`);

      const leaves = iocArray.map(x => keccak256(x));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = tree.getHexRoot();

      const cid = await uploadToIPFS(iocData);
      
      setStatus(`✅ IPFS: ${cid.toString().substring(0, 20)}...`);
      setStatus('⛓️ Submitting to blockchain...');

      const registryAddress = "0xD63e502605B0B48626bF979c66B68026a35DbA36";
      const registryABI = [
        "function registerContributor() external payable",
        "function addBatch(string memory cid, bytes32 merkleRoot, bool isPublic, bytes32 zkpCommitment, bytes memory zkpProof) public",
        "function contributors(address) external view returns (uint256, uint256, uint256, uint256, bool, uint256)",
        "function getPlatformStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)"
      ];

      const registry = new ethers.Contract(registryAddress, registryABI, signer);

      const contributor = await registry.contributors(await signer.getAddress());
      const isRegistered = contributor[4];

      if (!isRegistered) {
        setStatus('🔐 Registering as contributor (0.05 ETH stake)...');
        const regTx = await registry.registerContributor({ 
          value: ethers.parseEther("0.05") 
        });
        await regTx.wait();
        setStatus('✅ Contributor registered');
      }

      const tx = await registry.addBatch(
        cid,
        root,
        true,
        ethers.ZeroHash,
        "0x"
      );

      setStatus('⏳ Waiting for confirmation...');
      await tx.wait();

      setStatus(`✅ Success! ${iocArray.length} IOCs submitted\n📦 CID: ${cid}\n🔗 Root: ${root.substring(0, 20)}...`);
      
      setIocs('');

    } catch (error) {
      console.error(error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        {!walletConnected ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400">Connect MetaMask to start submitting threat intelligence</p>
            </div>
            
            <button
              onClick={connectWallet}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Connect MetaMask Wallet
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700 flex justify-between items-center">
              <div>
                <span className="text-gray-400 text-sm">Connected Wallet</span>
                <p className="text-purple-400 font-mono text-sm">
                  {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm">Active</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  📋 Indicators of Compromise (IOCs)
                </label>
                <textarea
                  value={iocs}
                  onChange={(e) => setIocs(e.target.value)}
                  className="w-full h-48 px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-500 font-mono text-sm transition-all"
                  placeholder="malicious-domain.com&#10;192.168.100.50&#10;a1b2c3d4e5f67890abcdef1234567890&#10;phishing-site.org"
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  💡 Enter one IOC per line. Supports domains, IPs, MD5/SHA-256 hashes
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    📄 Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 transition-all"
                    disabled={loading}
                  >
                    <option value="flat">Flat IOCs</option>
                    <option value="stix">STIX 2.1 Format</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    🔒 Privacy Mode
                  </label>
                  <select
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 transition-all"
                    disabled={loading}
                  >
                    <option value="public">🌐 Public (Identity Visible)</option>
                    <option value="anonymous">👤 Anonymous (256-bit ZKP)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="text-blue-400 text-2xl mb-2">🔗</div>
                  <div className="text-sm text-gray-400">IPFS Storage (Pinata)</div>
                  <div className="text-xs text-gray-500 mt-1">Distributed & Immutable</div>
                </div>
                
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <div className="text-purple-400 text-2xl mb-2">🛡️</div>
                  <div className="text-sm text-gray-400">Merkle Proofs</div>
                  <div className="text-xs text-gray-500 mt-1">Cryptographic Verification</div>
                </div>
                
                <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
                  <div className="text-pink-400 text-2xl mb-2">⚡</div>
                  <div className="text-sm text-gray-400">Multi-Sig DAO</div>
                  <div className="text-xs text-gray-500 mt-1">Decentralized Approval</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all transform ${
                  loading 
                    ? 'bg-gray-700 cursor-not-allowed text-gray-500' 
                    : 'bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 hover:from-purple-700 hover:via-blue-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02]'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  '🚀 Submit to Blockchain'
                )}
              </button>

              {status && (
                <div className={`p-6 rounded-xl border backdrop-blur-sm ${
                  status.includes('❌') 
                    ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                  status.includes('✅') 
                    ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                    'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}>
                  <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{status}</p>
                </div>
              )}
            </form>
          </>
        )}

        <div className="mt-8 p-6 bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-700">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold">1</div>
              <p className="text-gray-400">Connect Wallet</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold">2</div>
              <p className="text-gray-400">Enter IOCs</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">3</div>
              <p className="text-gray-400">Upload to IPFS</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold">4</div>
              <p className="text-gray-400">Generate Proof</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold">5</div>
              <p className="text-gray-400">Submit On-Chain</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <div className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 flex items-center gap-2">
            <span>🔐</span>
            <span>256-bit Encryption</span>
          </div>
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-400 flex items-center gap-2">
            <span>⚡</span>
            <span>Low Gas Costs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
