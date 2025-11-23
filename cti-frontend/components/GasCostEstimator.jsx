// components/GasCostEstimator.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function GasCostEstimator({ operation = 'addBatch', iocCount = 1 }) {
  const [gasCost, setGasCost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    estimateGas();
    const interval = setInterval(estimateGas, 30000);
    return () => clearInterval(interval);
  }, [operation, iocCount]);

  const estimateGas = async () => {
    try {
      if (!window.ethereum) {
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const feeData = await provider.getFeeData();
      
      const gasEstimates = {
        registerContributor: 150000n,
        addBatch: 200000n,
        approveBatch: 100000n
      };
      
      const gasUnits = gasEstimates[operation] || 200000n;
      const l1GasPriceGwei = Number(ethers.formatUnits(feeData.gasPrice, 'gwei'));
      
      const l1GasCostWei = gasUnits * feeData.gasPrice;
      const l1GasCostEth = ethers.formatEther(l1GasCostWei);
      
      const ethPriceUSD = 2500;
      const l1CostUSD = parseFloat(l1GasCostEth) * ethPriceUSD;
      
      const l2GasPriceGwei = l1GasPriceGwei * 0.005;
      const l2CostUSD = l1CostUSD * 0.005;
      
      const l1CostPerIOC = l1CostUSD / iocCount;
      const l2CostPerIOC = l2CostUSD / iocCount;
      
      const savings = ((l1CostUSD - l2CostUSD) / l1CostUSD * 100).toFixed(1);
      
      setGasCost({
        gasUnits: gasUnits.toString(),
        l1GasPriceGwei: l1GasPriceGwei.toFixed(2),
        l2GasPriceGwei: l2GasPriceGwei.toFixed(4),
        l1CostEth: l1GasCostEth,
        l1CostUSD: l1CostUSD.toFixed(2),
        l2CostUSD: l2CostUSD.toFixed(4),
        l1CostPerIOC: l1CostPerIOC.toFixed(4),
        l2CostPerIOC: l2CostPerIOC.toFixed(6),
        savings: savings
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Gas estimation error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="my-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700">
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          Estimating gas costs...
        </div>
      </div>
    );
  }

  if (!gasCost) {
    return null;
  }

  return (
    <div className="my-6 space-y-3">
      
      <div className="p-5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-yellow-300 font-semibold">⛽ Ethereum Sepolia (L1 Testnet)</p>
          <span className="text-xs text-yellow-400 font-bold px-2 py-1 bg-yellow-500/20 rounded">High Cost</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-3xl font-bold text-yellow-400">
              ${gasCost.l1CostUSD}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {gasCost.l1GasPriceGwei} Gwei • {gasCost.gasUnits} gas
            </p>
          </div>
          {iocCount > 1 && (
            <p className="text-sm text-yellow-300">
              ${gasCost.l1CostPerIOC} per IOC
            </p>
          )}
        </div>
      </div>

      <div className="p-5 bg-green-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-green-300 font-semibold">⚡ Arbitrum Sepolia (L2 - Recommended)</p>
          <span className="text-xs text-green-400 font-bold px-2 py-1 bg-green-500/20 rounded">{gasCost.savings}% cheaper</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-3xl font-bold text-green-400">
              ${gasCost.l2CostUSD}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {gasCost.l2GasPriceGwei} Gwei • Layer 2 optimization
            </p>
          </div>
          {iocCount > 1 && (
            <p className="text-sm text-green-300">
              ${gasCost.l2CostPerIOC} per IOC
            </p>
          )}
        </div>
      </div>

      {iocCount < 10 && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <p className="text-xs text-purple-300">
            💡 <strong>Gas Tip:</strong> Batching 10 IOCs would reduce cost to ${(parseFloat(gasCost.l2CostUSD) / 10).toFixed(4)} per IOC on L2
          </p>
        </div>
      )}
    </div>
  );
}
