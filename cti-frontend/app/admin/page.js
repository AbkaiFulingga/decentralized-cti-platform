// app/admin/page.js
import AdminGovernancePanel from '../../components/AdminGovernancePanel';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Governance Panel</h1>
        <p className="text-gray-400 mb-8">Multi-signature batch approval interface (2-of-3 threshold)</p>
        <AdminGovernancePanel />
      </div>
    </main>
  );
}
