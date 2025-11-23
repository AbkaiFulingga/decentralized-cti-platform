// components/StorageContribution.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function StorageContribution() {
  const [storageGB, setStorageGB] = useState(5);
  const [role, setRole] = useState("Observer");
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState(null);

  useEffect(() => {
    detectNetwork();
    if (walletConnected) {
      loadStorageStatus();
    }
  }, [walletConnected]);

  const detectNetwork = async () => {
    try {
      if (!window.ethereum) return;
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      
      if (chainId === "11155111") {
        setCurrentNetwork(NETWORKS.sepolia);
      } else if (chainId === "421614") {
        setCurrentNetwork(NETWORKS.arbitrumSepolia);
      }
    } catch (error) {
      console.error('Network detection error:', error);
    }
  };

  const loadStorageStatus = async () => {
    try {
      if (!window.ethereum || !currentNetwork) return;
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      if (!currentNetwork.contracts.storage) return;
      
      const storageABI = [
        "function getStorageProvider(address) external view returns (uint256, uint256, uint256, bool, uint256)",
        "function getStorageRole(address) external view returns (string)"
      ];
      
      const storage = new ethers.Contract(currentNetwork.contracts.storage, storageABI, provider);
      
      const providerData = await storage.getStorageProvider(address);
      const providerRole = await storage.getStorageRole(address);
      
      if (providerData[0] > 0n) {
        setStorageData({
          collateral: ethers.formatEther(providerData[0]),
          storageGB: Number(providerData[1]),
          reputation: Number(providerData[2]),
          verified: providerData[3]
        });
        setRole(providerRole);
      }
    } catch (error) {
      console.error('Storage status error:', error);
    }
  };

  const registerStorage = async () => {
    setLoading(true);
    try {
      if (!window.ethereum || !currentNetwork || !currentNetwork.contracts.storage) {
        alert('Storage contract not deployed on this network');
        return;
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const storageABI = [
        "function registerStorageProvider(uint256 storageGB) external payable"
      ];
      
      const storage = new ethers.Contract(currentNetwork.contracts.storage, storageABI, signer);
      
      const collateralRequired = ethers.parseEther((storageGB * 0.0001).toString());
      
      const tx = await storage.registerStorageProvider(storageGB, { value: collateralRequired });
      await tx.wait();
      
      alert(`✅ Registered as storage provider (${storageGB}GB)`);
      await loadStorageStatus();
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const collateralRequired = (storageGB * 0.0001).toFixed(4);

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="bg-purple-950/50 rounded-xl p-6 border border-purple-700/50">
        <h3 className="text-xl font-bold text-white mb-4">
          Storage Provider Program
        </h3>
        
        {storageData ? (
          <div className="space-y-4">
            <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-300">Your Role</span>
                <span className="text-lg font-bold text-purple-300">{role}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Storage Committed</p>
                  <p className="text-white font-mono">{storageData.storageGB} GB</p>
                </div>
                <div>
                  <p className="text-gray-400">Collateral</p>
                  <p className="text-purple-400 font-mono">{storageData.collateral} ETH</p>
                </div>
                <div>
                  <p className="text-gray-400">Reputation Earned</p>
                  <p className="text-green-400 font-mono">+{storageData.reputation}</p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <p className={storageData.verified ? "text-green-400" : "text-yellow-400"}>
                    {storageData.verified ? "✅ Verified" : "⏳ Pending"}
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-gray-400">
              You earn +5 reputation monthly as a verified storage provider. After 6 months, you can withdraw your collateral.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 mb-4">
              Contribute storage to the network and earn reputation bonuses
            </p>
            
            <div className="mb-4">
              <label className="text-gray-300 text-sm block mb-2">Storage Commitment (GB)</label>
              <input 
                type="range" 
                min="5" 
                max="200" 
                value={storageGB}
                onChange={(e) => setStorageGB(Number(e.target.value))}
                className="w-full"
                disabled={loading}
              />
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-400">{storageGB} GB</span>
                <span className="text-purple-400">Collateral: {collateralRequired} ETH</span>
              </div>
            </div>
            
            <div className="mb-4 p-3 bg-purple-900/30 rounded border border-purple-700">
              <p className="text-sm text-gray-400 mb-1">Projected Role:</p>
              <p className="text-lg font-bold text-purple-300">
                {storageGB >= 200 ? "Storage Guardian" : 
                 storageGB >= 50 ? "Power Contributor" : 
                 "Storage Contributor"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Earn +{storageGB >= 200 ? 20 : storageGB >= 50 ? 10 : 5} reputation monthly
              </p>
            </div>
            
            <button 
              onClick={registerStorage}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all"
            >
              {loading ? 'Processing...' : 'Register as Storage Provider'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
