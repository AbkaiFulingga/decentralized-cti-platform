const PINATA_API_BASE = 'https://api.pinata.cloud';

function getAuthHeaders() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('Missing PINATA_JWT in environment');
  }
  return {
    Authorization: `Bearer ${jwt}`
  };
}

/**
 * List pins from Pinata.
 * Uses /data/pinList with cursor pagination.
 */
export async function listPins({
  pageLimit = 100,
  cursor = undefined,
  status = 'pinned'
} = {}) {
  const url = new URL(`${PINATA_API_BASE}/data/pinList`);
  url.searchParams.set('status', status);
  url.searchParams.set('pageLimit', String(pageLimit));
  if (cursor) url.searchParams.set('cursor', cursor);

  const resp = await fetch(url.toString(), {
    headers: {
      ...getAuthHeaders(),
      Accept: 'application/json'
    }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Pinata pinList failed: ${resp.status} ${resp.statusText} ${text}`);
  }

  return resp.json();
}

export function getGatewayBase() {
  // Prefer explicit gateway. Otherwise use public Pinata gateway.
  return (process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '');
}

export async function fetchPinnedJson(cid, { timeoutMs = 12_000 } = {}) {
  const gateway = getGatewayBase();
  const url = `${gateway}/${cid}`;

  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`IPFS fetch failed for ${cid}: ${resp.status} ${resp.statusText} ${text}`);
  }

  return resp.json();
}
