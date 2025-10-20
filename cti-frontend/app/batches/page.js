// app/batches/page.js
import BatchBrowser from '../../components/BatchBrowser';

export default function BatchesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Browse IOC Batches</h1>
        <p className="text-gray-400 mb-8">Search and explore submitted threat intelligence batches</p>
        <BatchBrowser />
      </div>
    </main>
  );
}
