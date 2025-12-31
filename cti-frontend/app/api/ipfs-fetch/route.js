// app/api/ipfs-fetch/route.js
import { NextResponse } from 'next/server';

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs',
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs'
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get('cid');

  if (!cid) {
    return NextResponse.json({ error: 'CID is required' }, { status: 400 });
  }

  const failures = [];

  // Try each gateway until one works
  for (const gateway of IPFS_GATEWAYS) {
    try {
      console.log(`Trying gateway: ${gateway}/${cid}`);
      
      const response = await fetch(`${gateway}/${cid}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000)  // 5 second timeout
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('application/json')) {
          failures.push({ gateway, status: response.status, error: `Unexpected content-type: ${contentType || 'unknown'}` });
          continue;
        }

        const data = await response.json();
        console.log(`✅ Success from ${gateway}`);
        
        return NextResponse.json({
          success: true,
          data: data,
          gateway: gateway
        });
      }

      failures.push({ gateway, status: response.status, error: `HTTP ${response.status}` });
    } catch (error) {
      console.log(`❌ Failed from ${gateway}:`, error.message);
      failures.push({ gateway, status: null, error: String(error?.message || error) });
      continue;
    }
  }

  return NextResponse.json({ 
    error: 'All IPFS gateways failed',
    cid: cid,
    failures
  }, { status: 503 });
}
