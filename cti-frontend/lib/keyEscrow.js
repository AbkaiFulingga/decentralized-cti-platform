import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.CTI_DATA_DIR
  ? path.resolve(process.env.CTI_DATA_DIR)
  : path.resolve(process.cwd(), '.data');

const KEYSTORE_PATH = path.join(DATA_DIR, 'ioc-key-escrow.v1.json');

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  ensureDir();
  try {
    const raw = fs.readFileSync(KEYSTORE_PATH, 'utf8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
  } catch {
    // ignore
  }
  return { version: 1, keys: {} };
}

function writeStore(store) {
  ensureDir();
  const tmp = `${KEYSTORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, KEYSTORE_PATH);
}

export function getKeystoreInfo() {
  return {
    dataDir: DATA_DIR,
    keystorePath: KEYSTORE_PATH
  };
}

export function putKey({ keyId, keyHex, algorithm = 'AES-256-CBC' }) {
  if (!keyId || typeof keyId !== 'string') throw new Error('keyId required');
  if (!keyHex || typeof keyHex !== 'string') throw new Error('keyHex required');

  const store = readStore();
  store.keys[keyId] = {
    keyHex,
    algorithm,
    addedAt: new Date().toISOString()
  };
  writeStore(store);

  return { keyId };
}

export function getKey(keyId) {
  if (!keyId || typeof keyId !== 'string') throw new Error('keyId required');
  const store = readStore();
  const entry = store.keys[keyId];
  if (!entry) return null;
  return { keyId, ...entry };
}
