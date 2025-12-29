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
    return NextResponse.json({
      success: false,
      error: 'Missing rpcUrl. Provide rpcUrl or call with allowStale=1 to return cached data only.'
    }, { status: 400 });
  }
  if (!force && isFresh(existing)) {
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
  const { chunkSize, delayMs } = getDefaults(chainId, rpcUrl);

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

  const endCap = Math.min(latestBlock, start + Math.max(0, maxBlocks));

  let scanned = 0;
  let windows = 0;
  let eventsFound = 0;
  let rateLimited = 0;

  // Scan forward from start -> endCap
  for (let from = start; from <= endCap; from += (chunkSize + 1)) {
    const to = Math.min(from + chunkSize, endCap);
    windows++;
    scanned += (to - from + 1);

    try {
      const evs = await registry.queryFilter(filter, from, to);
      if (evs.length) {
        for (const ev of evs) {
          const idx = Number(ev.args.index);
          const cid = ev.args.cid;
          cidMap[idx] = cid;
        }
        eventsFound += evs.length;
      }
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('429') || msg.toLowerCase().includes('compute units') || msg.toLowerCase().includes('too many requests')) {
        rateLimited++;
        // backoff and retry this window once
        await sleep(2000);
        try {
          const evs = await registry.queryFilter(filter, from, to);
          if (evs.length) {
            for (const ev of evs) {
              const idx = Number(ev.args.index);
              const cid = ev.args.cid;
              cidMap[idx] = cid;
            }
            eventsFound += evs.length;
          }
        } catch {
          // leave it; next request can continue
        }
      }
    }

    // throttle to reduce CU/sec spikes
    await sleep(delayMs);
  }

  const newEntry = {
    cidMap,
    lastScannedBlock: endCap,
    latestKnownBlock: latestBlock,
    updatedAt: Date.now()
  };
  CACHE.maps.set(cacheKey, newEntry);

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
