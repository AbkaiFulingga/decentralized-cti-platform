// app/history/page.js
import TransactionHistory from '../../components/TransactionHistory';

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Transaction History</h1>
        <p className="text-gray-400 mb-8">View your IOC submission history and reputation progress</p>
        <TransactionHistory />
      </div>
    </main>
  );
}
