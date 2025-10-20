// app/dashboard/page.js
import PlatformDashboard from '../../components/PlatformDashboard';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Platform Statistics</h1>
        <PlatformDashboard />
      </div>
    </main>
  );
}
