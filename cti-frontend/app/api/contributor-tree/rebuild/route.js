import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Runs the existing repo script to regenerate contributor-merkle-tree.json.
// This is intended for local/dev and for emergency recovery when the rebuilder daemon is down.
//
// Security note:
// - This endpoint executes a local script. Do NOT expose it publicly without some auth.
// - For now we gate it behind NODE_ENV !== 'production' unless explicitly overridden.

function runNodeScript({ cwd, scriptPath, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const onData = (buf, target) => {
      const s = buf.toString();
      // Keep logs bounded to avoid huge responses.
      if (target.length < 20_000) target += s;
      return target;
    };

    child.stdout.on('data', (d) => {
      stdout = onData(d, stdout);
    });
    child.stderr.on('data', (d) => {
      stderr = onData(d, stderr);
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Tree rebuild timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Tree rebuild failed (exit ${code}). ${stderr || stdout || ''}`.trim()));
    });
  });
}

export async function POST() {
  try {
    const allowInProd = process.env.ALLOW_TREE_REBUILD_IN_PROD === '1';
    if (process.env.NODE_ENV === 'production' && !allowInProd) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Tree rebuild is disabled in production. Set ALLOW_TREE_REBUILD_IN_PROD=1 to enable (not recommended without auth).',
        },
        { status: 403 }
      );
    }

    // cti-frontend/ -> repo root
    const repoRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(repoRoot, 'scripts', 'build-contributor-tree.js');
    const outPath = path.join(repoRoot, 'contributor-merkle-tree.json');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { success: false, error: `Missing rebuild script at ${scriptPath}` },
        { status: 500 }
      );
    }

    const startedAt = Date.now();
    const { stdout, stderr } = await runNodeScript({
      cwd: repoRoot,
      scriptPath,
      timeoutMs: 60_000,
    });

    if (!fs.existsSync(outPath)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rebuild script completed but contributor-merkle-tree.json was not found.',
          logs: { stdout, stderr },
        },
        { status: 500 }
      );
    }

    const tree = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const ageMs = Date.now() - (tree.timestamp || 0);
    const ageHours = ageMs / (1000 * 60 * 60);

    return NextResponse.json({
      success: true,
      elapsedMs: Date.now() - startedAt,
      tree: {
        root: tree.root,
        contributorCount: tree.contributorCount ?? (Array.isArray(tree.contributors) ? tree.contributors.length : 0),
        timestamp: tree.timestamp,
        lastUpdate: tree.lastUpdate,
        treeDepth: tree.treeDepth,
        hashFunction: tree.hashFunction,
        freshness: {
          ageHours: Number.isFinite(ageHours) ? ageHours.toFixed(1) : '0.0',
          isStale: ageHours > 48,
        },
      },
      logs: {
        // These can be helpful in dev, but we keep them bounded.
        stdout,
        stderr,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
