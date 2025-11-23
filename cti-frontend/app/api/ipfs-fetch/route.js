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
        const data = await response.json();
        console.log(`✅ Success from ${gateway}`);
        
        return NextResponse.json({
          success: true,
          data: data,
          gateway: gateway
        });
      }
    } catch (error) {
      console.log(`❌ Failed from ${gateway}:`, error.message);
      continue;
    }
  }

  return NextResponse.json({ 
    error: 'All IPFS gateways failed',
    cid: cid 
  }, { status: 503 });
}
