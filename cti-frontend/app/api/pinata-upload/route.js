import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    
    console.log('📤 Pinata upload request');
    console.log('IOCs:', data.iocs?.length);
    
    // Server-side only. Prefer PINATA_JWT, but allow a fallback if someone
    // mistakenly stored it as NEXT_PUBLIC_* during local testing.
    const PINATA_JWT = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT;
    
    if (!PINATA_JWT) {
      console.error('❌ PINATA_JWT not set');
      return NextResponse.json(
        {
          success: false,
          error: 'PINATA_JWT not configured (set PINATA_JWT in cti-frontend/.env.local and restart the dev server)'
        },
        { status: 500 }
      );
    }
    
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    formData.append('file', blob, 'ioc-batch.json');
    
    const metadata = JSON.stringify({
      name: `IOC-Batch-${Date.now()}`,
      keyvalues: {
        format: data.format || 'FLAT',
        timestamp: new Date().toISOString()
      }
    });
    formData.append('pinataMetadata', metadata);
  
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: formData
    });
  
    const result = await response.json();
    
    console.log('Pinata response:', result);
    
    if (!response.ok) {
      console.error('❌ Pinata error:', result);
      throw new Error(result.error || 'Pinata upload failed');
    }
    
    if (!result.IpfsHash) {
      console.error('❌ No IpfsHash in response');
      throw new Error('No IPFS hash returned');
    }
    
    console.log('✅ Upload success! CID:', result.IpfsHash);
    
    // ✅ FIX: Return 'cid' field (not 'IpfsHash')
    return NextResponse.json({ 
      success: true, 
      cid: result.IpfsHash,  // ← Frontend expects 'cid'
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp
    });
    
  } catch (error) {
    console.error('❌ Pinata upload error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
