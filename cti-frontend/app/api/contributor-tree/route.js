import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // ✅ FIX: Go up only 1 level from cti-frontend, not 2
    // cti-frontend/ -> blockchain-dev/
    const treePath = path.join(process.cwd(), '..', 'contributor-merkle-tree.json');
    
    console.log('Looking for tree at:', treePath);
    
    if (!fs.existsSync(treePath)) {
      console.error('Tree file not found at:', treePath);
      
      // Try absolute path as fallback
      const absolutePath = '/home/sc/blockchain-dev/contributor-merkle-tree.json';
      if (fs.existsSync(absolutePath)) {
        console.log('Found at absolute path:', absolutePath);
        const treeData = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        
        const ageMs = Date.now() - treeData.timestamp;
        const ageHours = ageMs / (1000 * 60 * 60);
        
        // Calculate contributor count from array (new format) or use field (old format)
        const contributorCount = Array.isArray(treeData.contributors) 
          ? treeData.contributors.length 
          : (treeData.contributorCount || 0);
        
        return NextResponse.json({
          success: true,
          root: treeData.root,
          leaves: treeData.leaves,
          contributors: treeData.contributors, // ✅ FIX: Include contributors array
          proofs: treeData.proofs, // ✅ FIX: Include proofs array for zkSNARK generation
          contributorCount: contributorCount,
          anonymitySetSize: contributorCount,
          timestamp: treeData.timestamp,
          lastUpdate: treeData.lastUpdate,
          treeDepth: treeData.treeDepth,
          hashFunction: treeData.hashFunction,
          freshness: {
            ageHours: ageHours.toFixed(1),
            isStale: ageHours > 48
          }
        });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Contributor tree not yet generated',
        triedPaths: [treePath, absolutePath]
      }, { status: 404 });
    }
    
    const treeDataRaw = fs.readFileSync(treePath, 'utf8');
    const treeData = JSON.parse(treeDataRaw);
    
    const ageMs = Date.now() - treeData.timestamp;
    const ageHours = ageMs / (1000 * 60 * 60);
    
    // Calculate contributor count from array (new format) or use field (old format)
    const contributorCount = Array.isArray(treeData.contributors) 
      ? treeData.contributors.length 
      : (treeData.contributorCount || 0);
    
    return NextResponse.json({
      success: true,
      root: treeData.root,
      leaves: treeData.leaves,
      contributors: treeData.contributors, // ✅ FIX: Include contributors array
      proofs: treeData.proofs, // ✅ FIX: Include proofs array for zkSNARK generation
      contributorCount: contributorCount,
      anonymitySetSize: contributorCount,
      timestamp: treeData.timestamp,
      lastUpdate: treeData.lastUpdate,
      treeDepth: treeData.treeDepth,
      hashFunction: treeData.hashFunction,
      freshness: {
        ageHours: ageHours.toFixed(1),
        isStale: ageHours > 48
      }
    });
    
  } catch (error) {
    console.error('Error in contributor-tree API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
