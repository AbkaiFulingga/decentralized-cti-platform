// app/page.js
import IOCSubmissionForm from '@/components/IOCSubmissionForm';
import PlatformDashboard from '@/components/PlatformDashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-700"></div>
      </div>

      <div className="relative container mx-auto py-12 px-4">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-semibold backdrop-blur-sm">
              🔐 Decentralized CTI Platform
            </span>
          </div>
          
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            Privacy-Preserving
          </h1>
          <h2 className="text-4xl font-bold text-white mb-6">
            Cyber Threat Intelligence
          </h2>
          
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Submit and verify IOCs with 256-bit cryptographic security on a decentralized blockchain network
          </p>

          {/* Stats Bar */}
          <div className="flex justify-center gap-8 mt-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">256-bit</div>
              <div className="text-sm text-gray-500">Security</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">STIX 2.1</div>
              <div className="text-sm text-gray-500">Compatible</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-400">IPFS</div>
              <div className="text-sm text-gray-500">Distributed</div>
            </div>
          </div>
        </div>

        {/* Platform Dashboard */}
        <PlatformDashboard />

        {/* Main Form */}
        <IOCSubmissionForm />

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <div className="inline-block px-6 py-3 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
            <p className="text-gray-400 text-sm">
              🔗 Connected to <span className="text-purple-400 font-mono">Localhost Network</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
