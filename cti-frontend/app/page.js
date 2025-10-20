// app/page.js
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 mb-6">
            Decentralized CTI Platform
          </h1>
          <p className="text-gray-300 text-xl mb-8 max-w-3xl mx-auto">
            Privacy-preserving threat intelligence sharing on Ethereum Layer 2.
            Submit, verify, and govern IOCs with 256-bit cryptographic security.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link 
              href="/submit"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Submit IOCs →
            </Link>
            <Link 
              href="/dashboard"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl transition-all border border-white/20"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Link href="/submit" className="group">
            <div className="bg-purple-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-700/50 hover:border-purple-600 transition-all">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold text-white mb-2">Submit IOCs</h3>
              <p className="text-gray-400 text-sm">
                Upload threat indicators with IPFS storage and Merkle proof verification
              </p>
              <div className="mt-4 text-purple-400 text-sm group-hover:translate-x-2 transition-transform">
                Get started →
              </div>
            </div>
          </Link>

          <Link href="/verify" className="group">
            <div className="bg-blue-900/30 backdrop-blur-xl rounded-2xl p-8 border border-blue-700/50 hover:border-blue-600 transition-all">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-white mb-2">Verify IOCs</h3>
              <p className="text-gray-400 text-sm">
                Cryptographically verify IOC authenticity using Merkle proofs
              </p>
              <div className="mt-4 text-blue-400 text-sm group-hover:translate-x-2 transition-transform">
                Verify now →
              </div>
            </div>
          </Link>

          <Link href="/batches" className="group">
            <div className="bg-pink-900/30 backdrop-blur-xl rounded-2xl p-8 border border-pink-700/50 hover:border-pink-600 transition-all">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-bold text-white mb-2">Browse Batches</h3>
              <p className="text-gray-400 text-sm">
                Search and explore all submitted IOC batches with filtering
              </p>
              <div className="mt-4 text-pink-400 text-sm group-hover:translate-x-2 transition-transform">
                Browse →
              </div>
            </div>
          </Link>
        </div>

        {/* Key Features */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Platform Features</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl mb-2">🔐</div>
              <div className="text-sm text-gray-300 font-semibold">256-bit Security</div>
            </div>
            <div>
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-sm text-gray-300 font-semibold">99.5% Gas Savings</div>
            </div>
            <div>
              <div className="text-3xl mb-2">🌐</div>
              <div className="text-sm text-gray-300 font-semibold">IPFS Storage</div>
            </div>
            <div>
              <div className="text-3xl mb-2">🛡️</div>
              <div className="text-sm text-gray-300 font-semibold">Threshold Governance</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
