import { NextResponse } from 'next/server';
import { reindexFromPinata } from '../../../../lib/indexer.js';

function isAuthorized(request) {
  const token = process.env.CTI_SEARCH_ADMIN_TOKEN;
  if (!token) {
    // Default: allow only same-host callers in dev/self-host (best-effort).
    // If you expose this publicly, set CTI_SEARCH_ADMIN_TOKEN.
    const host = (request.headers.get('host') || '').split(':')[0];
    return host === 'localhost' || host === '127.0.0.1' || host === '192.168.1.11';
  }

  const hdr = request.headers.get('authorization') || '';
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return Boolean(m && m[1] === token);
}

export async function POST(request) {
  const t0 = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body
  }

  const limitPins = Math.max(1, Math.min(2000, Number(body.limitPins || 500)));
  const refreshExisting = Boolean(body.refreshExisting);

  try {
    const stats = await reindexFromPinata({
      limitPins,
      refreshExisting,
      progress: (p) => {
        // Keep logs concise.
        if (p?.status === 'error') {
          console.warn('[search-reindex]', p.status, p.cid, p.error);
        }
      }
    });

    return NextResponse.json({
      success: true,
      stats,
      elapsedMs: Date.now() - t0
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e?.message || e)
    }, { status: 500 });
  }
}
