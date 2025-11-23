// app/page.js
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black">
      
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-20 text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          Decentralized Threat Intelligence Platform
        </h1>
        <p className="text-xl text-gray-300 mb-12">
          Submit and verify IOCs with 256-bit cryptographic security on blockchain
        </p>

        <div className="flex gap-4 justify-center mb-16">
          <Link
            href="/submit"
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all"
          >
            Submit IOCs
          </Link>
          <Link
            href="/verify"
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all"
          >
            Verify IOCs
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-purple-950/50 border border-purple-700/50 rounded-xl p-6">
            <div className="text-4xl mb-3">🔐</div>
            <h3 className="text-lg font-semibold text-white mb-2">256-bit Privacy</h3>
            <p className="text-gray-400 text-sm">Anonymous submissions with cryptographic commitments</p>
          </div>

          <div className="bg-purple-950/50 border border-purple-700/50 rounded-xl p-6">
            <div className="text-4xl mb-3">🛡️</div>
            <h3 className="text-lg font-semibold text-white mb-2">Merkle Proofs</h3>
            <p className="text-gray-400 text-sm">Cryptographic verification of data integrity</p>
          </div>

          <div className="bg-purple-950/50 border border-purple-700/50 rounded-xl p-6">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold text-white mb-2">L2 Efficiency</h3>
            <p className="text-gray-400 text-sm">99.5% gas cost reduction on Arbitrum</p>
          </div>
        </div>
      </div>

    </main>
  );
}
