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

  // L1-only optimization (Sepolia): if the registry exposes getBatchCID(), we can build
  // a CID map without relying on event logs (eth_getLogs), which can be slow/unreliable.
  // This is intentionally NOT used on Arbitrum to avoid changing L2 behavior.
  if (Number(chainId) === 11155111) {
    try {
      const l1Abi = [
        'function getBatchCount() public view returns (uint256)',
        'function getBatchCID(uint256 index) external view returns (string)'
      ];
      const l1Registry = new ethers.Contract(registryAddress, l1Abi, provider);
      const count = Number(await l1Registry.getBatchCount());

      // If we already have some cached CIDs, only fill missing.
      let cidMap = existing?.cidMap || {};
      const missing = [];
      for (let i = 0; i < count; i++) {
        if (!cidMap[String(i)]) missing.push(i);
      }

      // Respect maxBlocks as a work budget: treat it as "max indices" here.
      // (maxBlocks is conceptually blocks, but for this mode it's a throttle knob.)
      const maxIndices = Math.max(1, Math.min(missing.length, Math.floor(Math.max(1, maxBlocks) / 25)));
      const slice = missing.slice(Math.max(0, missing.length - maxIndices));

      for (const i of slice) {
        try {
          const cid = await l1Registry.getBatchCID(i);
          if (typeof cid === 'string' && cid.length) {
            cidMap[String(i)] = cid;
          }
        } catch {
          // ignore
        }
        await sleep(25);
      }

      const newEntry = {
        cidMap,
        lastScannedBlock: latestBlock,
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
          mode: 'l1-view-getBatchCID',
          latestBlock,
          batchCount: count,
          cidCount: Object.keys(cidMap || {}).length,
          elapsedMs: Date.now() - t0
        }
      });
    } catch (e) {
      // If Sepolia registry isn't upgraded yet, fall back to event scan below.
      console.warn('[cid-map] Sepolia getBatchCID unavailable; falling back to event scan', {
        registry: registryAddress,
        error: String(e?.message || e)
      });
    }
  }

  // L2 scanning: on Arbitrum the chain moves fast and callers typically want "recent" batches.
  // Using deploymentBlock as the scan anchor can leave us permanently behind (you'd need to scan
  // tens of millions of blocks). Instead, treat maxBlocks as a lookback window from the chain tip.
  // If callers want a full historical scan, they can either (a) call repeatedly and rely on
  // lastScannedBlock progress, or (b) set deploymentBlock close to the expected activity.
  const inferredStartFromLatest = Math.max(0, latestBlock - Math.max(1, maxBlocks));
  const startBlock = Number(chainId) === 421614
    ? inferredStartFromLatest
    : Math.max(deploymentBlock || 0, inferredStartFromLatest);

  // BatchAdded on PrivacyPreservingRegistry (matches deployed ABI)
  // event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)
  const abi = [
    'event BatchAdded(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash)'
  ];
  const zkAbi = [
    'event BatchAddedWithZKProof(uint256 indexed index, string cid, bytes32 cidCommitment, bytes32 merkleRoot, uint256 commitment, uint256 contributorMerkleRoot)'
  ];

  const registry = new ethers.Contract(registryAddress, [...abi, ...zkAbi], provider);
  const filter = registry.filters.BatchAdded();
  const filterZk = registry.filters.BatchAddedWithZKProof();

  let cidMap = existing?.cidMap || {};
  // Start from the next unscanned block, but never before deploymentBlock.
  // If deploymentBlock changes between deploys, this guarantees we don't miss early events.
  let start = existing?.lastScannedBlock
    ? Math.min(Math.max(existing.lastScannedBlock + 1, startBlock), latestBlock)
    : startBlock;
  if (!start || Number.isNaN(start)) start = 0;

  // Don't scan from 0 accidentally.
  if (start === 0 && startBlock > 0) start = startBlock;

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
        const [evs, zkEvs] = await Promise.all([
          registry.queryFilter(filter, from, to),
          registry.queryFilter(filterZk, from, to)
        ]);
        applyEvents(evs);
        applyEvents(zkEvs);
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
