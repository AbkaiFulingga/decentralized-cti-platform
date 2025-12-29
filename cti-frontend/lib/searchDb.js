import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.CTI_DATA_DIR
  ? path.resolve(process.env.CTI_DATA_DIR)
  : path.resolve(process.cwd(), '.data');

const DB_PATH = path.join(DATA_DIR, 'cti-search.sqlite');

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Pins catalog
  db.exec(`
    CREATE TABLE IF NOT EXISTS pins (
      cid TEXT PRIMARY KEY,
      name TEXT,
      size INTEGER,
      mime_type TEXT,
      created_at TEXT,
      updated_at TEXT,
      raw JSON
    );

    CREATE TABLE IF NOT EXISTS pin_iocs (
      cid TEXT NOT NULL,
      ioc TEXT NOT NULL,
      idx INTEGER,
      network TEXT,
      source TEXT,
      merkle_root TEXT,
      encrypted INTEGER,
      ts TEXT,
      PRIMARY KEY (cid, ioc, idx)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS pin_iocs_fts USING fts5(
      ioc,
      cid UNINDEXED,
      network UNINDEXED,
      content='pin_iocs',
      content_rowid='rowid'
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS pin_iocs_ai AFTER INSERT ON pin_iocs BEGIN
      INSERT INTO pin_iocs_fts(rowid, ioc, cid, network)
      VALUES (new.rowid, new.ioc, new.cid, new.network);
    END;

    CREATE TRIGGER IF NOT EXISTS pin_iocs_ad AFTER DELETE ON pin_iocs BEGIN
      INSERT INTO pin_iocs_fts(pin_iocs_fts, rowid, ioc, cid, network)
      VALUES('delete', old.rowid, old.ioc, old.cid, old.network);
    END;

    CREATE TRIGGER IF NOT EXISTS pin_iocs_au AFTER UPDATE ON pin_iocs BEGIN
      INSERT INTO pin_iocs_fts(pin_iocs_fts, rowid, ioc, cid, network)
      VALUES('delete', old.rowid, old.ioc, old.cid, old.network);
      INSERT INTO pin_iocs_fts(rowid, ioc, cid, network)
      VALUES (new.rowid, new.ioc, new.cid, new.network);
    END;
  `);

  return db;
}

export function getDbInfo() {
  return {
    dataDir: DATA_DIR,
    dbPath: DB_PATH
  };
}
