import { NextResponse } from 'next/server';
import { searchIocs } from '../../../lib/indexer.js';
import { getDbInfo } from '../../../lib/searchDb.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));

  try {
    const rows = searchIocs({ query: q, limit });
    const dbInfo = getDbInfo();

    return NextResponse.json({
      success: true,
      query: q,
      count: rows.length,
      results: rows,
      meta: {
        dbPath: dbInfo.dbPath,
        dataDir: dbInfo.dataDir
      }
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e?.message || e)
    }, { status: 500 });
  }
}
