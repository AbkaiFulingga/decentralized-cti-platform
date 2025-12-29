// app/api/route.js
//
// NOTE: This route reads the contributor merkle tree JSON from disk.
// It must be resilient to the file being temporarily empty or mid-write.
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to tree data (in blockchain-dev directory)
    const treePath = path.join(process.cwd(), '../../blockchain-dev/contributor-merkle-tree.json');
    
    // Check if file exists
    if (!fs.existsSync(treePath)) {
      return NextResponse.json({
        success: false,
        error: 'Contributor tree not yet generated. Please wait for initial tree creation.',
        hint: 'Run: node scripts/update-contributor-merkle.js'
      }, { status: 404 });
    }
    
    // Read tree data
    const treeDataRaw = fs.readFileSync(treePath, 'utf8');
    if (!treeDataRaw || !treeDataRaw.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Contributor tree file is empty (likely mid-update). Please retry.',
        hint: 'Wait a few seconds and refresh. If it persists, re-run the tree builder.'
      }, { status: 503 });
    }

    let treeData;
    try {
      treeData = JSON.parse(treeDataRaw);
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Contributor tree JSON is invalid (likely mid-update). Please retry.',
        hint: 'Wait a few seconds and refresh. If it persists, re-run the tree builder.',
        details: String(e?.message || e)
      }, { status: 503 });
    }
    
    // Calculate freshness
    const ageMs = Date.now() - treeData.timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);
    const isStale = ageHours > 48;
    
    // Return tree data (mask actual addresses for privacy)
    return NextResponse.json({
      success: true,
      root: treeData.root,
      leaves: treeData.leaves,
      contributorCount: treeData.contributorCount,
      treeDepth: treeData.treeDepth,
      timestamp: treeData.timestamp,
      lastUpdate: treeData.lastUpdate,
      network: treeData.network,
      freshness: {
        ageMs: ageMs,
        ageHours: ageHours.toFixed(1),
        isStale: isStale
      },
      // Don't expose actual addresses to frontend for privacy
      contributors: treeData.contributors.map(addr => 
        addr.substring(0, 10) + '...' + addr.substring(38)
      )
    });
    
  } catch (error) {
    console.error('Error serving contributor tree:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
