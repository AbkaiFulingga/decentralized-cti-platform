// app/api/cid-map/route.js
//
// Purpose:
// Build and cache a mapping of { batchIndex -> cid } for a registry by scanning BatchAdded events.
// This avoids expensive client-side eth_getLogs scans on Alchemy free tier.
//
// Notes:
// - Uses very small block windows (default 9 blocks) to satisfy Alchemy free tier.
// - Caches results in-memory for a short TTL. Good enough for a single-node deployment.
// - If your node restarts, the cache rebuilds on-demand.

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// In-memory cache (per Next.js server process)
const CACHE = {
  // key: `${chainId}:${registryAddress}` -> { cidMap, lastScannedBlock, latestKnownBlock, updatedAt }
  maps: new Map(),
  // key -> Promise resolving when scan completes (prevents duplicate concurrent scans)
  inFlight: new Map(),
  ttlMs: 60_000 // 1 minute
};

function getCacheKey(chainId, registryAddress) {
  return `${chainId}:${String(registryAddress || '').toLowerCase()}`;
}

function isFresh(entry) {
  return entry && (Date.now() - entry.updatedAt) < CACHE.ttlMs;
}

function getDefaults(chainId, rpcUrl) {
  const url = (rpcUrl || '').toLowerCase();
  if (Number(chainId) === 11155111 && url.includes('alchemy.com')) {
    // Alchemy Sepolia: safe inclusive window
    return { chunkSize: 9, delayMs: 650 };
  }
  if (Number(chainId) === 421614) {
    return { chunkSize: 10_000, delayMs: 50 };
  }
  return { chunkSize: 10, delayMs: 300 };
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function GET(request) {
  const t0 = Date.now();
  const { searchParams } = new URL(request.url);

  // Helpful for debugging unexpected callers (e.g. spammy missing params in prod logs)
  const reqMeta = {
    referer: request.headers.get('referer') || '',
    userAgent: request.headers.get('user-agent') || '',
    // NOTE: request.ip isn't available in all runtimes; keep it simple.
  };

  const chainId = Number(searchParams.get('chainId'));
  const rpcUrl = searchParams.get('rpcUrl');
  const registryAddress = searchParams.get('registry');
  const deploymentBlock = Number(searchParams.get('deploymentBlock') || 0);

  // Optional controls
  // Keep this small by default to prevent multi-minute requests on Alchemy.
  // Callers can refresh repeatedly; we keep progress in-memory via lastScannedBlock.
  const maxBlocks = Number(searchParams.get('maxBlocks') || 2_000); // cap per request
  const force = searchParams.get('force') === '1';

  // Quick mode: if we already have a cache entry for this chainId+registry,
  // return it without requiring rpcUrl. Useful for pages that just want whatever
  // the server already knows right now.
  const allowStale = searchParams.get('allowStale') === '1';
  if (!chainId || !registryAddress) {
    console.warn('[cid-map] Missing required params', {
      chainId: searchParams.get('chainId'),
      registry: searchParams.get('registry'),
      rpcUrl: Boolean(searchParams.get('rpcUrl')),
      deploymentBlock: searchParams.get('deploymentBlock'),
      maxBlocks: searchParams.get('maxBlocks'),
      allowStale,
      ...reqMeta
    });
    return NextResponse.json({
      success: false,
      error: 'Required query params: chainId, registry'
    }, { status: 400 });
  }

  const cacheKey = getCacheKey(chainId, registryAddress);
  const existing = CACHE.maps.get(cacheKey);

  // If we have something cached and the caller is OK with potentially stale data,
  // return immediately (even without rpcUrl).
  if (allowStale && existing) {
    console.log('[cid-map] cache-hit', {
      chainId,
      registry: registryAddress,
      stale: !isFresh(existing),
      size: Object.keys(existing.cidMap || {}).length,
      elapsedMs: Date.now() - t0
    });
    return NextResponse.json({
      success: true,
      cached: true,
      stale: !isFresh(existing),
      cidMap: existing.cidMap,
      meta: {
        lastScannedBlock: existing.lastScannedBlock,
        latestKnownBlock: existing.latestKnownBlock,
        updatedAt: existing.updatedAt,
        elapsedMs: Date.now() - t0,
        note: 'Returned cached cidMap only (allowStale=1).'
      }
    });
  }

  // Past this point we need an RPC URL to make progress.
  if (!rpcUrl) {
    console.warn('[cid-map] Missing rpcUrl (cannot scan)', {
      chainId,
      registry: registryAddress,
      allowStale,
      ...reqMeta
    });
    return NextResponse.json({
      success: false,
      error: 'Missing rpcUrl. Provide rpcUrl or call with allowStale=1 to return cached data only.'
    }, { status: 400 });
  }

  // If another request is already scanning this same registry, don't start a second scan.
  // For allowStale callers, prefer waiting briefly for the shared scan.
  const inFlight = CACHE.inFlight.get(cacheKey);
  if (inFlight) {
    console.log('[cid-map] in-flight-scan', { chainId, registry: registryAddress });
    try {
      await inFlight;
    } catch {
      // ignore; we'll fall through and attempt a scan
    }
    const after = CACHE.maps.get(cacheKey);
    if (after?.cidMap) {
      return NextResponse.json({
        success: true,
        cached: true,
        stale: !isFresh(after),
        cidMap: after.cidMap,
        meta: {
          lastScannedBlock: after.lastScannedBlock,
          latestKnownBlock: after.latestKnownBlock,
          updatedAt: after.updatedAt,
          elapsedMs: Date.now() - t0,
          note: 'Returned after waiting for in-flight scan.'
        }
      });
    }
  }
  if (!force && isFresh(existing)) {
    console.log('[cid-map] fresh-cache', {
      chainId,
      registry: registryAddress,
      size: Object.keys(existing.cidMap || {}).length,
      elapsedMs: Date.now() - t0
    });
    return NextResponse.json({
      success: true,
      cached: true,
      cidMap: existing.cidMap,
      meta: {
        lastScannedBlock: existing.lastScannedBlock,
        latestKnownBlock: existing.latestKnownBlock,
        updatedAt: existing.updatedAt,
        elapsedMs: Date.now() - t0
      }
    });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const latestBlock = await provider.getBlockNumber();
  const defaults = getDefaults(chainId, rpcUrl);
  const chunkSize = defaults.chunkSize;
  // If caller is using a small maxBlocks budget, don't sleep as aggressively.
  const delayMs = (Number(chainId) === 11155111 && maxBlocks <= 5000)
    ? Math.min(defaults.delayMs, 120)
    : defaults.delayMs;

  // BatchAdded(uint256 indexed index, string cid, ...)
  const abi = [
    'event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)'
  ];
  const registry = new ethers.Contract(registryAddress, abi, provider);
  const filter = registry.filters.BatchAdded();

  let cidMap = existing?.cidMap || {};
  let start = existing?.lastScannedBlock ? Math.max(existing.lastScannedBlock + 1, deploymentBlock) : deploymentBlock;
  if (!start || Number.isNaN(start)) start = 0;

  // Don't scan from 0 accidentally.
  if (start === 0 && deploymentBlock > 0) start = deploymentBlock;

  // If caller didn't provide a deployment block (or provided 0), avoid scanning from genesis.
  // A cold cache should still pick up recent batches; callers can pass deploymentBlock for full correctness.
  if (start === 0) {
    const fallbackBlocksBack = Number(chainId) === 11155111 ? 250_000 : 5_000_000;
    start = Math.max(0, latestBlock - fallbackBlocksBack);
  }

  // maxBlocks is a budget of blocks scanned; endCap is inclusive.
  const endCap = Math.min(latestBlock, start + Math.max(0, maxBlocks) - 1);

  let scanned = 0;
  let windows = 0;
  let eventsFound = 0;
  let rateLimited = 0;

  // Scan forward from start -> endCap
  const scanPromise = (async () => {
    // Important: increment by (chunkSize + 1) skips blocks.
    // Using (to + 1) keeps windows contiguous: [from..to], then [to+1..nextTo].
    for (let from = start; from <= endCap; ) {
      const to = Math.min(from + chunkSize, endCap);
      windows++;
      scanned += (to - from + 1);

      const applyEvents = (evs) => {
        if (!evs?.length) return;
        for (const ev of evs) {
          const idx = Number(ev?.args?.index);
          const cid = ev?.args?.cid;
          // JSON object keys are always strings; keep it consistent.
          if (Number.isFinite(idx) && typeof cid === 'string' && cid.length) {
            cidMap[String(idx)] = cid;
          }
        }
        eventsFound += evs.length;
      };

      try {
        const evs = await registry.queryFilter(filter, from, to);
        applyEvents(evs);
      } catch (e) {
        const msg = String(e?.message || e);
        if (
          msg.includes('429') ||
          msg.toLowerCase().includes('compute units') ||
          msg.toLowerCase().includes('too many requests')
        ) {
          rateLimited++;
          // backoff and retry this window once
          await sleep(2000);
          try {
            const evs = await registry.queryFilter(filter, from, to);
            applyEvents(evs);
          } catch {
            // leave it; next request can continue
          }
        }
      }

      // throttle to reduce CU/sec spikes
      await sleep(delayMs);
      from = to + 1;
    }
  })();

  CACHE.inFlight.set(cacheKey, scanPromise);
  try {
    await scanPromise;
  } finally {
    CACHE.inFlight.delete(cacheKey);
  }

  const newEntry = {
    cidMap,
    lastScannedBlock: endCap,
    latestKnownBlock: latestBlock,
    updatedAt: Date.now()
  };
  CACHE.maps.set(cacheKey, newEntry);

  console.log('[cid-map] scan-done', {
    chainId,
    registry: registryAddress,
    startBlock: start,
    endBlock: endCap,
    latestBlock,
    scannedBlocks: scanned,
    windows,
    eventsFound,
    rateLimited,
    cidCount: Object.keys(cidMap || {}).length,
    elapsedMs: Date.now() - t0
  });

  return NextResponse.json({
    success: true,
    cached: false,
    cidMap,
    meta: {
      chainId,
      registryAddress,
      deploymentBlock,
      chunkSize,
      delayMs,
      startBlock: start,
      endBlock: endCap,
      latestBlock,
      scannedBlocks: scanned,
      windows,
      eventsFound,
      rateLimited
      ,elapsedMs: Date.now() - t0
    }
  });
}
