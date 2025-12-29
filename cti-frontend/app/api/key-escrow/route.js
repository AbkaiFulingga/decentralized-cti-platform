import { NextResponse } from 'next/server';
import { getKey, putKey, getKeystoreInfo } from '../../../lib/keyEscrow.js';

function requireAdmin(request) {
  const token = process.env.CTI_SEARCH_ADMIN_TOKEN;
  if (!token) {
    // Safer default: if no token is configured, do not allow key escrow writes.
    // Reads are also disabled to avoid accidental exposure.
    throw new Error('CTI_SEARCH_ADMIN_TOKEN not configured');
  }
  const hdr = request.headers.get('authorization') || '';
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== token) throw new Error('Unauthorized');
}

export async function GET(request) {
  try {
    requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');
    if (!keyId) {
      const info = getKeystoreInfo();
      return NextResponse.json({
        success: true,
        meta: {
          keystorePath: info.keystorePath,
          dataDir: info.dataDir
        }
      });
    }

    const entry = getKey(keyId);
    if (!entry) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // Never return the key to browsers in a production system.
    // This route exists for server-side use only.
    return NextResponse.json({
      success: true,
      keyId: entry.keyId,
      algorithm: entry.algorithm,
      keyHex: entry.keyHex
    });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function POST(request) {
  try {
    requireAdmin(request);

    const body = await request.json();
    const keyId = body?.keyId;
    const keyHex = body?.keyHex;
    const algorithm = body?.algorithm;

    // Persist
    const { keyId: saved } = putKey({ keyId, keyHex, algorithm });

    return NextResponse.json({ success: true, keyId: saved });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
