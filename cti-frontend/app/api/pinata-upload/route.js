// app/api/pinata-upload/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    
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
        'Authorization': `Bearer ${process.env.PINATA_JWT}`
      },
      body: formData
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Pinata upload failed');
    }
    
    return NextResponse.json({ 
      success: true, 
      IpfsHash: result.IpfsHash,
      PinSize: result.PinSize,
      Timestamp: result.Timestamp
    });
    
  } catch (error) {
    console.error('Pinata upload error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
