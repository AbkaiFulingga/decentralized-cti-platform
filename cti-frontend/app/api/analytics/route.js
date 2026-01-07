import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';

import { NETWORKS, CONTRACT_ABIS } from '@/utils/constants';

function safeNum(x) {
  try {
    if (x === null || x === undefined) return 0;
    if (typeof x === 'number') return x;
    if (typeof x === 'bigint') return Number(x);
    // ethers may return BigInt-like values
    return Number(x);
  } catch {
    return 0;
  }
}

async function readAnalyticsCache() {
  try {
    const cachePath = path.join(process.cwd(), 'public', 'cache', 'analytics-cache.json');
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw);

    const ts = Number(parsed?.timestamp || 0);
    const hasRealTimestamp = ts && ts > 1_000_000_000_000;

    return {
      ok: true,
      cache: parsed,
      cacheTimestamp: hasRealTimestamp ? ts : null,
    };
  } catch (e) {
    return { ok: false, cache: null, cacheTimestamp: null, error: e?.message || String(e) };
  }
}

async function getNetworkKpis(network) {
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const registry = new ethers.Contract(network.contracts.registry, CONTRACT_ABIS.registry, provider);
  const governance = new ethers.Contract(network.contracts.governance, CONTRACT_ABIS.governance, provider);

  // Registry high-level stats (single call)
  // returns: (totalBatches, totalAccepted, publicBatches, anonymousBatches, totalPublicContrib, totalAnonContrib, totalStaked)
  const stats = await registry.getPlatformStats();

  const totalBatches = safeNum(stats?.[0]);
  const totalAccepted = safeNum(stats?.[1]);
  const publicBatches = safeNum(stats?.[2]);
  const anonymousBatches = safeNum(stats?.[3]);
  const publicContributors = safeNum(stats?.[4]);
  const anonContributors = safeNum(stats?.[5]);
  const totalStakedWei = stats?.[6] ?? 0n;

  // Governance status: count verified/executed/pending batches.
  // This is O(n) calls, so we cap it to keep RPC-friendly.
  let threshold = 3;
  try {
    threshold = safeNum(await governance.threshold()) || 3;
  } catch {
    threshold = network.threshold || 3;
  }

  const MAX_GOVERNANCE_SCAN = 50; // low-risk, keeps this endpoint fast
  const scanCount = Math.min(totalBatches, MAX_GOVERNANCE_SCAN);
  let verifiedBatches = 0;
  let executedBatches = 0;
  let pendingBatches = Math.max(totalBatches - totalAccepted, 0);

  try {
    for (let i = 0; i < scanCount; i++) {
      // (approvals, executed, createdAt)
      const s = await governance.getBatchApprovalStatus(i);
      const approvals = safeNum(s?.[0]);
      const executed = Boolean(s?.[1]);
      if (approvals >= threshold) verifiedBatches++;
      if (executed) executedBatches++;
    }
  } catch {
    // If governance calls fail on a provider, still return registry stats.
  }

  return {
    chainId: network.chainId,
    name: network.name,
    explorerUrl: network.explorerUrl,

    totals: {
      batches: totalBatches,
      accepted: totalAccepted,
      pending: pendingBatches,
      publicBatches,
      anonymousBatches,
      contributors: publicContributors + anonContributors,
      publicContributors,
      anonContributors,
      totalStakedEth: ethers.formatEther(totalStakedWei),
    },

    governance: {
      threshold,
      verifiedInSample: verifiedBatches,
      executedInSample: executedBatches,
      sampleSize: scanCount,
      note:
        totalBatches > scanCount
          ? `Governance status computed on the latest ${scanCount} batches (RPC-friendly cap).`
          : 'Governance status computed on all batches.',
    },
  };
}

export async function GET() {
  try {
    const cacheResult = await readAnalyticsCache();

    const [l1, l2] = await Promise.all([
      getNetworkKpis(NETWORKS.sepolia),
      getNetworkKpis(NETWORKS.arbitrumSepolia),
    ]);

    const merged = {
      generatedAt: Date.now(),
      cache: {
        ok: cacheResult.ok,
        timestamp: cacheResult.cacheTimestamp,
      },
      networks: {
        sepolia: l1,
        arbitrumSepolia: l2,
      },
      combined: {
        batches: l1.totals.batches + l2.totals.batches,
        accepted: l1.totals.accepted + l2.totals.accepted,
        pending: l1.totals.pending + l2.totals.pending,
        contributors: l1.totals.contributors + l2.totals.contributors,
        totalStakedEth: (
          parseFloat(l1.totals.totalStakedEth || '0') +
          parseFloat(l2.totals.totalStakedEth || '0')
        ).toFixed(4),
      },
      // pass through cached heatmaps when available; UI can decide how to use them
      cachedHeatmaps: cacheResult.cache?.sepolia?.dailyStats || cacheResult.cache?.arbitrumSepolia?.dailyStats
        ? {
            sepolia: cacheResult.cache?.sepolia?.dailyStats || {},
            arbitrumSepolia: cacheResult.cache?.arbitrumSepolia?.dailyStats || {},
          }
        : null,
    };

    return NextResponse.json(merged);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
