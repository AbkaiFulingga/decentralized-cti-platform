import { NextResponse } from 'next/server';
import { searchIocs } from '../../../lib/indexer.js';

// Minimal troubleshooting-friendly alias for /api/search.
// Contract:
// - Input:  GET ?q=<string>&limit=<1..200>
// - Output: { success, q, count, results: [{ ioc, cid, network }] }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));

  try {
    const rows = searchIocs({ query: q, limit });
    return NextResponse.json({
      success: true,
      q,
      count: rows.length,
      results: rows
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: String(e?.message || e)
      },
      { status: 500 }
    );
  }
}
