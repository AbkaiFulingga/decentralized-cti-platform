// app/dashboard/page.js
import ContributorDashboard from '../../components/ContributorDashboard';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 py-12 px-4">
      <ContributorDashboard />
    </main>
  );
}
