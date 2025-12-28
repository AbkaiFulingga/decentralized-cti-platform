// Simplified Analytics that loads from cache instantly
'use client';

import { useState, useEffect } from 'react';

export default function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [cacheAge, setCacheAge] = useState(0);

  useEffect(() => {
    loadAnalytics();
    
    // Auto-refresh every minute
    const interval = setInterval(loadAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadAnalytics() {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Analytics] Loading from cache...');
      
      // Fetch pre-computed cache (instant!)
      const response = await fetch('/cache/analytics-cache.json');
      if (!response.ok) {
        throw new Error('Cache not available - indexer may not be running. Run: pm2 start scripts/analytics-indexer.js --name analytics-indexer');
      }
      
      const cache = await response.json();
      
      // Check cache freshness
      const ageMinutes = (Date.now() - cache.timestamp) / 60000;
      setCacheAge(ageMinutes);
      
      if (ageMinutes > 30) {
        console.warn(`⚠️  Cache is ${ageMinutes.toFixed(1)} minutes old`);
      }
      
      setStats(cache);
      console.log('[Analytics] Cache loaded successfully');
      console.log(`   Sepolia: ${cache.sepolia.batches} batches, ${cache.sepolia.contributors.length} contributors`);
      console.log(`   Arbitrum: ${cache.arbitrumSepolia.batches} batches, ${cache.arbitrumSepolia.contributors.length} contributors`);
      
    } catch (error) {
      console.error('[Analytics] Failed to load cache:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics from cache...</p>
          <p className="text-sm text-gray-400 mt-2">This should be instant!</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">❌ Analytics Unavailable</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="bg-white rounded p-4 mt-4">
              <p className="text-sm text-gray-700 font-semibold mb-2">To fix this, run on the server:</p>
              <code className="block bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
                pm2 start scripts/analytics-indexer.js --name analytics-indexer<br/>
                pm2 logs analytics-indexer
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalBatches = stats.sepolia.batches + stats.arbitrumSepolia.batches;
  const totalContributors = stats.sepolia.contributors.length + stats.arbitrumSepolia.contributors.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Platform Analytics</h1>
          <div className="flex items-center gap-4">
            <p className="text-gray-600">
              Last updated: {cacheAge.toFixed(1)} minutes ago
            </p>
            {cacheAge > 10 && (
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                ⚠️ Slightly stale
              </span>
            )}
            {cacheAge <= 10 && (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                ✅ Fresh
              </span>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="text-gray-500 text-sm mb-2">Total Batches</div>
            <div className="text-4xl font-bold text-blue-600 mb-2">{totalBatches}</div>
            <div className="text-sm text-gray-400">
              L1: {stats.sepolia.batches} | L2: {stats.arbitrumSepolia.batches}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="text-gray-500 text-sm mb-2">Contributors</div>
            <div className="text-4xl font-bold text-green-600 mb-2">{totalContributors}</div>
            <div className="text-sm text-gray-400">
              L1: {stats.sepolia.contributors.length} | L2: {stats.arbitrumSepolia.contributors.length}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="text-gray-500 text-sm mb-2">Network Health</div>
            <div className="text-3xl font-bold text-purple-600 mb-2">✅ Operational</div>
            <div className="text-sm text-gray-400">
              Cache: {cacheAge < 10 ? 'Fresh' : cacheAge < 30 ? 'Good' : 'Stale'}
            </div>
          </div>
        </div>

        {/* Heatmaps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <HeatmapCard 
            title="Ethereum Sepolia (L1)" 
            dailyStats={stats.sepolia.dailyStats}
          />
          <HeatmapCard 
            title="Arbitrum Sepolia (L2)" 
            dailyStats={stats.arbitrumSepolia.dailyStats}
          />
        </div>

        <div className="flex gap-4">
          <button 
            onClick={loadAnalytics}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
          >
            🔄 Refresh Cache
          </button>
          
          <div className="bg-white rounded-lg shadow px-6 py-3 flex items-center gap-2">
            <span className="text-gray-600 text-sm">Auto-refresh in background</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatmapCard({ title, dailyStats }) {
  const dates = Object.keys(dailyStats).sort().slice(-7); // Last 7 days
  const maxCount = Math.max(...dates.map(d => dailyStats[d]), 1);
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="font-bold text-lg mb-4 text-gray-800">{title}</h3>
      <div className="space-y-2">
        {dates.map(date => {
          const count = dailyStats[date];
          const width = (count / maxCount) * 100;
          
          return (
            <div key={date} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 w-24">{date}</span>
              <div className="flex-1 mx-4 bg-gray-100 rounded-full h-8 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${Math.max(width, 10)}%` }}
                >
                  {width > 20 && (
                    <span className="text-white text-xs font-semibold">{count}</span>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-gray-800 w-8 text-right">{count}</span>
            </div>
          );
        })}
        {dates.length === 0 && (
          <p className="text-gray-400 text-center py-8">No submissions in last 7 days</p>
        )}
      </div>
    </div>
  );
}
