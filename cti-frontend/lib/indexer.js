import { getDb } from './searchDb.js';
import { listPins, fetchPinnedJson } from './pinataClient.js';
import CryptoJS from 'crypto-js';
import { getKey as getEscrowKey } from './keyEscrow.js';

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

function tryDecryptEncryptedBundle(json) {
  // Expected encrypted format from utils/encryption.js::formatForIPFS()
  // {
  //   type: 'encrypted-ioc-bundle', algorithm, ciphertext, iv, keyId, metadataHash, timestamp
  // }
  if (json?.type !== 'encrypted-ioc-bundle') return null;
  const keyId = json?.keyId;
  if (!keyId) return null;

  const entry = getEscrowKey(keyId);
  if (!entry?.keyHex) return null;

  try {
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(String(json.ciphertext || '')) },
      CryptoJS.enc.Hex.parse(String(entry.keyHex)),
      {
        iv: CryptoJS.enc.Hex.parse(String(json.iv || '')),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    const plaintextJson = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintextJson) return null;
    return JSON.parse(plaintextJson);
  } catch {
    return null;
  }
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
  let skippedEncryptedPins = 0;
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
        progress({ processedPins, fetchedPins, skippedPins, skippedEncryptedPins, insertedIocs, errors, cid, status: 'skipped-existing' });
        continue;
      }

      try {
        if (refreshExisting) {
          deleteIocsForCid.run(cid);
        }

        const json = await fetchPinnedJson(cid);
        fetchedPins++;

        // E3: never decrypt/index encrypted bundles server-side.
        // Encrypted content is only searchable locally by users who have the key.
        if (json?.type === 'encrypted-ioc-bundle') {
          skippedEncryptedPins++;
          progress({
            processedPins,
            fetchedPins,
            skippedPins,
            skippedEncryptedPins,
            insertedIocs,
            errors,
            cid,
            status: 'skipped-encrypted'
          });
          continue;
        }

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

        progress({ processedPins, fetchedPins, skippedPins, skippedEncryptedPins, insertedIocs, errors, cid, status: 'indexed', iocCount: iocs.length });
      } catch (e) {
        errors++;
        progress({ processedPins, fetchedPins, skippedPins, skippedEncryptedPins, insertedIocs, errors, cid, status: 'error', error: String(e?.message || e) });
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
    skippedEncryptedPins,
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

export function searchPinsByIoc({ query, limitPins = 25, limitMatchesPerPin = 20 } = {}) {
  const db = getDb();
  const q = String(query || '').trim();
  if (!q) return [];

  // Step 1: find matching rows (cap total rows to keep it fast)
  const maxRows = Math.max(1, Math.min(5000, limitPins * Math.max(1, limitMatchesPerPin)));
  const rows = searchIocs({ query: q, limit: maxRows });
  if (!rows.length) return [];

  // Step 2: group by cid
  const byCid = new Map();
  for (const r of rows) {
    const cid = r?.cid;
    if (!cid) continue;
    let entry = byCid.get(cid);
    if (!entry) {
      entry = {
        cid,
        network: r?.network || null,
        matchCount: 0,
        matches: []
      };
      byCid.set(cid, entry);
    }
    if (entry.matches.length < limitMatchesPerPin) {
      entry.matches.push({ ioc: r.ioc });
    }
    entry.matchCount++;
  }

  const cids = Array.from(byCid.keys());

  // Step 3: enrich with per-pin metadata from pin_iocs (counts, ts, etc)
  const metaStmt = db.prepare(`
    SELECT
      cid,
      COUNT(1) AS totalIocs,
      MIN(ts) AS firstTs,
      MAX(ts) AS lastTs,
      MAX(network) AS network,
      MAX(source) AS source,
      MAX(merkle_root) AS merkleRoot,
      MAX(encrypted) AS encrypted
    FROM pin_iocs
    WHERE cid IN (
      SELECT value FROM json_each(?)
    )
    GROUP BY cid
  `);

  // pack cids into a json array for sqlite json_each
  let metaRows = [];
  try {
    metaRows = metaStmt.all(JSON.stringify(cids));
  } catch {
    // If JSON1 isn't available for any reason, skip enrichment.
    metaRows = [];
  }

  const metaByCid = new Map(metaRows.map(r => [r.cid, r]));

  const results = [];
  for (const [cid, entry] of byCid.entries()) {
    const m = metaByCid.get(cid);
    results.push({
      cid,
      network: m?.network || entry.network,
      source: m?.source || null,
      encrypted: Boolean(m?.encrypted),
      merkleRoot: m?.merkleRoot || null,
      totalIocs: Number(m?.totalIocs || 0),
      firstTs: m?.firstTs || null,
      lastTs: m?.lastTs || null,
      matchCount: entry.matchCount,
      matches: entry.matches
    });
  }

  // Sort by most matches first
  results.sort((a, b) => (b.matchCount - a.matchCount) || String(a.cid).localeCompare(String(b.cid)));

  return results.slice(0, Math.max(1, Math.min(200, limitPins)));
}
