// app/layout.js
'use client';

import { useEffect } from 'react';
import NavBar from '../components/NavBar';
import { walletEventManager } from '../utils/wallet-events';
import './globals.css';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Setup global wallet event listeners once
    walletEventManager.setupAccountListener();
  }, []);

  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black min-h-screen">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
