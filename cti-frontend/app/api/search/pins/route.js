import { NextResponse } from 'next/server';
import { searchPinsByIoc } from '../../../../lib/indexer.js';
import { getDbInfo, getDb } from '../../../../lib/searchDb.js';

function getIndexStats() {
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
      lastIndexFinish: meta.lastIndexFinish || null
    };
  } catch {
    return {
      pinsIndexed: 0,
      iocsIndexed: 0,
      lastIndexStart: null,
      lastIndexFinish: null
    };
  }
}

// CID-level search: return the "files" (CIDs) that contain matching IOCs.
// GET /api/search/pins?q=<text>&limitPins=<1..200>&limitMatchesPerPin=<1..200>
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limitPins = Math.max(1, Math.min(200, Number(searchParams.get('limitPins') || 25)));
  const limitMatchesPerPin = Math.max(1, Math.min(200, Number(searchParams.get('limitMatchesPerPin') || 20)));

  try {
    const results = searchPinsByIoc({ query: q, limitPins, limitMatchesPerPin });
    const dbInfo = getDbInfo();
    const stats = getIndexStats();

    return NextResponse.json({
      success: true,
      query: q,
      count: results.length,
      results,
      meta: {
        dbPath: dbInfo.dbPath,
        dataDir: dbInfo.dataDir,
        index: stats
      }
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
