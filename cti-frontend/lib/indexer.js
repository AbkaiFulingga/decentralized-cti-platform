import { getDb } from './searchDb.js';
import { listPins, fetchPinnedJson } from './pinataClient.js';

function normalizeIoc(x) {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  if (!s) return null;
  return s;
}

function extractBatchShape(json) {
  // Expected shape from user:
  // { version, format, timestamp, iocs: [...], metadata: { source, network, merkleRoot, encrypted } }
  const iocs = Array.isArray(json?.iocs) ? json.iocs : [];
  const ts = typeof json?.timestamp === 'string' ? json.timestamp : null;
  const meta = json?.metadata || {};

  return {
    iocs,
    ts,
    network: typeof meta?.network === 'string' ? meta.network : null,
    source: typeof meta?.source === 'string' ? meta.source : null,
    merkleRoot: typeof meta?.merkleRoot === 'string' ? meta.merkleRoot : null,
    encrypted: Boolean(meta?.encrypted)
  };
}

export async function reindexFromPinata({
  limitPins = 500,
  refreshExisting = false,
  progress = () => {}
} = {}) {
  const db = getDb();

  const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
  const setMeta = db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  const insertPin = db.prepare(`
    INSERT INTO pins(cid, name, size, mime_type, created_at, updated_at, raw)
    VALUES(@cid, @name, @size, @mime_type, @created_at, @updated_at, @raw)
    ON CONFLICT(cid) DO UPDATE SET
      name = excluded.name,
      size = excluded.size,
      mime_type = excluded.mime_type,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      raw = excluded.raw
  `);

  const hasIocs = db.prepare('SELECT 1 FROM pin_iocs WHERE cid = ? LIMIT 1');
  const deleteIocsForCid = db.prepare('DELETE FROM pin_iocs WHERE cid = ?');

  const insertIoc = db.prepare(`
    INSERT OR IGNORE INTO pin_iocs(cid, ioc, idx, network, source, merkle_root, encrypted, ts)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const nowIso = new Date().toISOString();
  setMeta.run('lastIndexStart', nowIso);

  let cursor = undefined;
  let processedPins = 0;
  let insertedIocs = 0;
  let fetchedPins = 0;
  let skippedPins = 0;
  let errors = 0;

  while (processedPins < limitPins) {
    const page = await listPins({ pageLimit: Math.min(100, limitPins - processedPins), cursor });
    const rows = page?.rows || [];

    cursor = page?.cursor || undefined;

    if (!rows.length) break;

    for (const row of rows) {
      processedPins++;
      const cid = row?.ipfs_pin_hash;
      if (!cid) {
        skippedPins++;
        continue;
      }

      insertPin.run({
        cid,
        name: row?.metadata?.name || null,
        size: row?.size || null,
        mime_type: row?.mime_type || null,
        created_at: row?.date_pinned || null,
        updated_at: row?.date_unpinned || null,
        raw: JSON.stringify(row)
      });

      const already = hasIocs.get(cid);
      if (already && !refreshExisting) {
        skippedPins++;
        progress({ processedPins, fetchedPins, skippedPins, insertedIocs, errors, cid, status: 'skipped-existing' });
        continue;
      }

      try {
        if (refreshExisting) {
          deleteIocsForCid.run(cid);
        }

        const json = await fetchPinnedJson(cid);
        fetchedPins++;

        const batch = extractBatchShape(json);
        const iocs = batch.iocs;

        db.transaction(() => {
          for (let i = 0; i < iocs.length; i++) {
            const s = normalizeIoc(iocs[i]);
            if (!s) continue;
            insertIoc.run(
              cid,
              s,
              i,
              batch.network,
              batch.source,
              batch.merkleRoot,
              batch.encrypted ? 1 : 0,
              batch.ts
            );
            insertedIocs++;
          }
        })();

        progress({ processedPins, fetchedPins, skippedPins, insertedIocs, errors, cid, status: 'indexed', iocCount: iocs.length });
      } catch (e) {
        errors++;
        progress({ processedPins, fetchedPins, skippedPins, insertedIocs, errors, cid, status: 'error', error: String(e?.message || e) });
      }

      if (processedPins >= limitPins) break;
    }

    if (!cursor) break;
  }

  setMeta.run('lastIndexFinish', new Date().toISOString());

  return {
    processedPins,
    fetchedPins,
    skippedPins,
    insertedIocs,
    errors,
    cursor: cursor || null
  };
}

export function searchIocs({ query, limit = 50 } = {}) {
  const db = getDb();
  const q = String(query || '').trim();
  if (!q) return [];

  // Use FTS for token search, but IOC queries are often substrings.
  // We do a hybrid:
  // - if query contains spaces/tokens -> FTS
  // - also support substring fallback via LIKE (capped)

  const results = [];

  const ftsStmt = db.prepare(`
    SELECT p.ioc, p.cid, p.network
    FROM pin_iocs_fts f
    JOIN pin_iocs p ON p.rowid = f.rowid
    WHERE pin_iocs_fts MATCH ?
    LIMIT ?
  `);

  const likeStmt = db.prepare(`
    SELECT ioc, cid, network
    FROM pin_iocs
    WHERE ioc LIKE ?
    LIMIT ?
  `);

  // FTS query: escape quotes; allow prefix matches.
  const ftsQuery = q
    .split(/\s+/)
    .filter(Boolean)
    .map(tok => tok.replaceAll('"', '""'))
    .map(tok => `${tok}*`)
    .join(' ');

  try {
    if (ftsQuery) {
      for (const row of ftsStmt.all(ftsQuery, limit)) {
        results.push(row);
      }
    }
  } catch {
    // ignore FTS syntax issues; we'll fall back to LIKE
  }

  if (results.length < limit) {
    const remaining = limit - results.length;
    const pat = `%${q}%`;
    for (const row of likeStmt.all(pat, remaining)) {
      results.push(row);
    }
  }

  return results;
}
