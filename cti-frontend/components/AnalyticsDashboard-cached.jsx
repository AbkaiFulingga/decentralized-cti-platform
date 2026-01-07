// Simplified Analytics that loads from cache instantly
'use client';

import { useMemo, useState, useEffect } from 'react';

export default function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdatedMinutes, setLastUpdatedMinutes] = useState(null);

  // IMPORTANT: All hooks must run unconditionally on every render.
  // Compute derived UI state (like badges) before any early returns.
  const cacheBadge = useMemo(() => {
    if (lastUpdatedMinutes === null) {
      return {
        label: 'No cache',
        className: 'bg-gray-700/60 text-gray-100 border border-gray-600/70',
        hint: 'Heatmaps require the indexer',
      };
    }
    if (lastUpdatedMinutes <= 10) {
      return {
        label: 'Fresh',
        className: 'bg-green-500/20 text-green-200 border border-green-500/40',
        hint: 'Indexer is running',
      };
    }
    if (lastUpdatedMinutes <= 30) {
      return {
        label: 'Good',
        className: 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40',
        hint: 'Slightly stale cache',
      };
    }
    return {
      label: 'Stale',
      className: 'bg-red-500/20 text-red-200 border border-red-500/40',
      hint: 'Run the indexer to refresh heatmaps',
    };
  }, [lastUpdatedMinutes]);

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
      // Prefer server-aggregated analytics (fast on-chain + optional cache),
      // so the page shows real numbers even without the PM2 indexer.
      const response = await fetch('/api/analytics', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Analytics API failed (${response.status})`);
      }

      const payload = await response.json();
      setData(payload);

      const ts = Number(payload?.cache?.timestamp || 0);
      if (!ts || ts < 1_000_000_000_000) {
        setLastUpdatedMinutes(null);
      } else {
        setLastUpdatedMinutes((Date.now() - ts) / 60000);
      }
      
    } catch (error) {
      console.error('[Analytics] Failed to load analytics:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-200">Loading analytics…</p>
          <p className="text-sm text-gray-400 mt-2">Fetching live on-chain KPIs + optional cached heatmaps.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <h2 className="text-xl font-bold text-red-300 mb-2">❌ Analytics Unavailable</h2>
            <p className="text-red-200 mb-4">{error}</p>
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 mt-4">
              <p className="text-sm text-gray-200 font-semibold mb-2">Troubleshooting:</p>
              <ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
                <li>Confirm the app can reach the RPC provider(s) in <code className="font-mono">cti-frontend/utils/constants.js</code>.</li>
                <li>If you want heatmaps + contributor lists, run the background indexer: <code className="font-mono">pm2 start scripts/analytics-indexer.js --name analytics-indexer</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const combined = data?.combined;
  const l1 = data?.networks?.sepolia;
  const l2 = data?.networks?.arbitrumSepolia;

  return (
    <div className="min-h-screen p-2 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">📊 Platform Analytics</h1>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-gray-300">
              {lastUpdatedMinutes === null
                ? 'Cache: not available (showing live on-chain KPIs)'
                : `Cache last updated: ${lastUpdatedMinutes.toFixed(1)} minutes ago`}
            </p>
            <span className={`${cacheBadge.className} px-3 py-1 rounded-full text-sm`} title={cacheBadge.hint}>
              {cacheBadge.label}
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            This dashboard summarizes key FYP metrics across Sepolia (L1) and Arbitrum Sepolia (L2): staking, privacy (public vs anonymous), and governance verification.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
            <div className="text-gray-400 text-sm mb-2">Total Batches</div>
            <div className="text-4xl font-bold text-blue-400 mb-2">{combined?.batches ?? '—'}</div>
            <div className="text-sm text-gray-400">
              L1: {l1?.totals?.batches ?? '—'} | L2: {l2?.totals?.batches ?? '—'}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
            <div className="text-gray-400 text-sm mb-2">Contributors</div>
            <div className="text-4xl font-bold text-green-400 mb-2">{combined?.contributors ?? '—'}</div>
            <div className="text-sm text-gray-400">
              L1: {l1?.totals?.contributors ?? '—'} | L2: {l2?.totals?.contributors ?? '—'}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
            <div className="text-gray-400 text-sm mb-2">Total Staked</div>
            <div className="text-3xl font-bold text-purple-400 mb-2">{combined?.totalStakedEth ?? '—'} ETH</div>
            <div className="text-sm text-gray-400">
              Shows total stake locked by contributors (privacy-preserving + tiered staking).
            </div>
          </div>
        </div>

        {/* Governance + Privacy Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <NetworkCard title="Ethereum Sepolia (L1)" net={l1} />
          <NetworkCard title="Arbitrum Sepolia (L2)" net={l2} />
        </div>

        {/* Heatmaps */}
        {data?.cachedHeatmaps ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <HeatmapCard title="Ethereum Sepolia (L1) — Activity" dailyStats={data.cachedHeatmaps.sepolia} />
            <HeatmapCard title="Arbitrum Sepolia (L2) — Activity" dailyStats={data.cachedHeatmaps.arbitrumSepolia} />
          </div>
        ) : (
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 mb-8">
            <h3 className="font-bold text-lg mb-2 text-white">📅 Activity Heatmaps</h3>
            <p className="text-gray-300 text-sm">
              Heatmaps require the background indexer (so we don’t hammer RPC providers with log scans).
              You’re currently seeing live on-chain KPIs only.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button 
            onClick={loadAnalytics}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-semibold"
          >
            🔄 Refresh
          </button>
          
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-6 py-3 flex items-center gap-2">
            <span className="text-gray-300 text-sm">Auto-refresh in background</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkCard({ title, net }) {
  const totals = net?.totals;
  const gov = net?.governance;

  return (
    <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <p className="text-gray-400 text-sm">Chain ID: {net?.chainId ?? '—'}</p>
        </div>
        {net?.explorerUrl ? (
          <a
            href={net.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-400 hover:underline"
          >
            Explorer →
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Kpi label="Batches" value={totals?.batches} />
        <Kpi label="Accepted" value={totals?.accepted} />
        <Kpi label="Pending" value={totals?.pending} />
        <Kpi label="Total staked" value={totals?.totalStakedEth ? `${totals.totalStakedEth} ETH` : '—'} />
      </div>

      <div className="mt-5">
        <h4 className="font-semibold text-gray-200 mb-2">Privacy breakdown</h4>
        <div className="grid grid-cols-2 gap-4">
          <Kpi label="Public batches" value={totals?.publicBatches} />
          <Kpi label="Anonymous batches" value={totals?.anonymousBatches} />
          <Kpi label="Public contributors" value={totals?.publicContributors} />
          <Kpi label="Anonymous contributors" value={totals?.anonContributors} />
        </div>
      </div>

      <div className="mt-5">
        <h4 className="font-semibold text-gray-200 mb-2">Governance verification</h4>
        <div className="bg-gray-900/40 border border-gray-700/40 rounded-lg p-4 text-sm text-gray-200">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><span className="font-semibold">Threshold:</span> {gov?.threshold ?? '—'}</span>
            <span><span className="font-semibold">Verified (sample):</span> {gov?.verifiedInSample ?? '—'} / {gov?.sampleSize ?? '—'}</span>
            <span><span className="font-semibold">Executed (sample):</span> {gov?.executedInSample ?? '—'} / {gov?.sampleSize ?? '—'}</span>
          </div>
          {gov?.note ? <p className="mt-2 text-gray-400">{gov.note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-gray-900/40 border border-gray-700/40 rounded-lg p-4">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="text-white text-lg font-bold">{value ?? '—'}</div>
    </div>
  );
}

function HeatmapCard({ title, dailyStats }) {
  const dates = Object.keys(dailyStats).sort().slice(-7); // Last 7 days
  const maxCount = Math.max(...dates.map(d => dailyStats[d]), 1);
  
  return (
    <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
      <h3 className="font-bold text-lg mb-4 text-white">{title}</h3>
      <div className="space-y-2">
        {dates.map(date => {
          const count = dailyStats[date];
          const width = (count / maxCount) * 100;
          
          return (
            <div key={date} className="flex items-center justify-between">
              <span className="text-sm text-gray-300 w-24">{date}</span>
              <div className="flex-1 mx-4 bg-gray-900/40 border border-gray-700/40 rounded-full h-8 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${Math.max(width, 10)}%` }}
                >
                  {width > 20 && (
                    <span className="text-white text-xs font-semibold">{count}</span>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-gray-100 w-8 text-right">{count}</span>
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
