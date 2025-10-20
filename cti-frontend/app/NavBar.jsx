// components/NavBar.jsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export default function NavBar() {
  const pathname = usePathname();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask');
      return;
    }
    
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWalletAddress(accounts[0]);
    setWalletConnected(true);
  };

  const isActive = (path) => pathname === path;

  return (
    <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-white font-bold text-lg hidden md:block">CTI Platform</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/dashboard') 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              📊 Dashboard
            </Link>
            
            <Link 
              href="/submit"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/submit') 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              🚀 Submit
            </Link>
            
            <Link 
              href="/verify"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/verify') 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              🔍 Verify
            </Link>
            
            <Link 
              href="/batches"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/batches') 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              📚 Batches
            </Link>

            <Link 
              href="/admin"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/admin') 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              🛡️ Admin
            </Link>
          </div>

          {/* Wallet Connection */}
          <div>
            {walletConnected ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-mono">
                  {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
                </span>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-all"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
