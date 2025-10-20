// app/verify/page.js
import IOCVerification from '../../components/IOCVerification';

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Verify IOC Authenticity</h1>
        <p className="text-gray-400 mb-8">Cryptographically verify IOCs using Merkle proofs</p>
        <IOCVerification />
      </div>
    </main>
  );
}
