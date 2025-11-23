// components/NetworkSelector.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NETWORKS } from '../utils/constants';

export default function NetworkSelector() {
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [gasCosts, setGasCosts] = useState({ l1: 0, l2: 0 });

  useEffect(() => {
    detectNetwork();
    calculateGasCosts();
  }, []);

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

  const calculateGasCosts = async () => {
    try {
      if (!window.ethereum) return;
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const feeData = await provider.getFeeData();
      
      const gasUnits = 200000n; // Batch submission gas
      const ethPrice = 2500; // USD per ETH
      
      // L1 cost (Sepolia as proxy for mainnet)
      const l1GasPrice = ethers.parseUnits("20", "gwei");
      const l1CostWei = gasUnits * l1GasPrice;
      const l1CostUSD = parseFloat(ethers.formatEther(l1CostWei)) * ethPrice;
      
      // L2 cost (Arbitrum)
      const l2GasPrice = ethers.parseUnits("0.1", "gwei");
      const l2CostWei = gasUnits * l2GasPrice;
      const l2CostUSD = parseFloat(ethers.formatEther(l2CostWei)) * ethPrice;
      
      setGasCosts({ l1: l1CostUSD, l2: l2CostUSD });
    } catch (error) {
      console.error('Gas calculation error:', error);
    }
  };

  const switchNetwork = async (networkKey) => {
    setSwitching(true);
    try {
      const network = NETWORKS[networkKey];
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });
      
      await detectNetwork();
      alert(`✅ Switched to ${network.name}`);
    } catch (error) {
      if (error.code === 4902) {
        // Network not added, add it
        try {
          const network = NETWORKS[networkKey];
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${network.chainId.toString(16)}`,
              chainName: network.name,
              nativeCurrency: network.nativeCurrency,
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: [network.explorerUrl]
            }]
          });
        } catch (addError) {
          alert(`❌ Failed to add network: ${addError.message}`);
        }
      } else {
        alert(`❌ Failed to switch: ${error.message}`);
      }
    } finally {
      setSwitching(false);
    }
  };

  if (!currentNetwork) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <p className="text-gray-400 text-sm">Detecting network...</p>
      </div>
    );
  }

  const savings = ((gasCosts.l1 - gasCosts.l2) / gasCosts.l1 * 100).toFixed(1);

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-white font-semibold mb-1">Current Network</h3>
          <p className="text-gray-400 text-sm">{currentNetwork.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-sm">Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        
        <div className={`p-4 rounded-lg border-2 ${
          currentNetwork.chainId === 11155111 
            ? 'bg-yellow-500/10 border-yellow-500' 
            : 'bg-gray-900/50 border-gray-700'
        }`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-white">Ethereum Sepolia (L1)</span>
            {currentNetwork.chainId === 11155111 && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
            )}
          </div>
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            ${gasCosts.l1.toFixed(2)}
          </div>
          <p className="text-xs text-gray-400">per batch submission</p>
          {currentNetwork.chainId !== 11155111 && (
            <button
              onClick={() => switchNetwork('sepolia')}
              disabled={switching}
              className="mt-3 w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm transition-all"
            >
              Switch to L1
            </button>
          )}
        </div>

        <div className={`p-4 rounded-lg border-2 ${
          currentNetwork.chainId === 421614 
            ? 'bg-green-500/10 border-green-500' 
            : 'bg-gray-900/50 border-gray-700'
        }`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-white">Arbitrum Sepolia (L2)</span>
            {currentNetwork.chainId === 421614 && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
            )}
          </div>
          <div className="text-2xl font-bold text-green-400 mb-1">
            ${gasCosts.l2.toFixed(2)}
          </div>
          <p className="text-xs text-gray-400">per batch submission</p>
          {currentNetwork.chainId !== 421614 && (
            <button
              onClick={() => switchNetwork('arbitrumSepolia')}
              disabled={switching}
              className="mt-3 w-full py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-green-300 text-sm transition-all"
            >
              Switch to L2
            </button>
          )}
        </div>
      </div>

      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <p className="text-green-300 text-sm text-center">
          <span className="font-bold">{savings}% savings</span> on Layer 2 (Arbitrum)
        </p>
      </div>
    </div>
  );
}
