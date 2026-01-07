// app/statistics/page.js
import AnalyticsDashboard from '../../components/AnalyticsDashboard-cached';

export default function StatisticsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 py-12 px-4">
      <AnalyticsDashboard />
    </main>
  );
}
