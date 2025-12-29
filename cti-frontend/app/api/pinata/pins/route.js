import { NextResponse } from 'next/server';
import { listPins } from '../../../../lib/pinataClient.js';

function isAuthorized(request) {
  // Listing pins can leak metadata; keep it protected by default.
  const token = process.env.CTI_SEARCH_ADMIN_TOKEN;
  if (!token) {
    const host = (request.headers.get('host') || '').split(':')[0];
    return host === 'localhost' || host === '127.0.0.1' || host === '192.168.1.11';
  }

  const hdr = request.headers.get('authorization') || '';
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return Boolean(m && m[1] === token);
}

export async function GET(request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));
    const cursor = searchParams.get('cursor') || undefined;

    // Pinata uses cursor+pageLimit pagination.
    const json = await listPins({ pageLimit: limit, cursor, status: 'pinned' });

    const rows = Array.isArray(json?.rows) ? json.rows : [];
    const pins = rows.map((r) => ({
      cid: r?.ipfs_pin_hash,
      datePinned: r?.date_pinned,
      size: r?.size,
      metadata: r?.metadata || null
    }));

    return NextResponse.json({
      success: true,
      pins,
      meta: {
        count: pins.length,
        nextCursor: json?.cursor || null
      }
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
