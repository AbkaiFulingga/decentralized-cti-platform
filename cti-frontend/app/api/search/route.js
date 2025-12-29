import { NextResponse } from 'next/server';
import { searchIocs } from '../../../lib/indexer.js';
import { getDbInfo, getDb } from '../../../lib/searchDb.js';

function getIndexStats() {
  // Keep this lightweight and safe to expose.
  // Do NOT expose PINATA_JWT itself.
  try {
    const db = getDb();
    const pins = db.prepare('SELECT COUNT(1) AS n FROM pins').get()?.n || 0;
    const iocs = db.prepare('SELECT COUNT(1) AS n FROM pin_iocs').get()?.n || 0;
    const metaRows = db
      .prepare("SELECT key, value FROM meta WHERE key IN ('lastIndexStart','lastIndexFinish')")
      .all();
    const meta = {};
    for (const r of metaRows) meta[r.key] = r.value;

    return {
      pinsIndexed: Number(pins),
      iocsIndexed: Number(iocs),
      lastIndexStart: meta.lastIndexStart || null,
      lastIndexFinish: meta.lastIndexFinish || null,
      pinataJwtConfigured: Boolean(process.env.PINATA_JWT)
    };
  } catch {
    return {
      pinsIndexed: 0,
      iocsIndexed: 0,
      lastIndexStart: null,
      lastIndexFinish: null,
      pinataJwtConfigured: Boolean(process.env.PINATA_JWT)
    };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));

  try {
    const rows = searchIocs({ query: q, limit });
    const dbInfo = getDbInfo();
    const stats = getIndexStats();

    return NextResponse.json({
      success: true,
      query: q,
      count: rows.length,
      results: rows,
      meta: {
        dbPath: dbInfo.dbPath,
        dataDir: dbInfo.dataDir,
        index: stats
      }
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e?.message || e)
    }, { status: 500 });
  }
}
