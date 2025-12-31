import { request } from 'node:http';
import { URL } from 'node:url';

const base = process.env.BASE_URL || 'http://localhost:3000';

const paths = [
  '/circuits/contributor-proof.wasm',
  '/circuits/contributor-proof_final.zkey',
  '/circuits/verification_key.json',
];

function head(u) {
  return new Promise((resolve, reject) => {
    const req = request(
      u,
      {
        method: 'HEAD',
        headers: {
          // Some setups require explicit accept; harmless otherwise.
          Accept: '*/*',
        },
      },
      (res) => {
        res.resume();
        resolve({
          url: u.toString(),
          status: res.statusCode,
          contentType: res.headers['content-type'],
          contentLength: res.headers['content-length'],
          cacheControl: res.headers['cache-control'],
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const baseUrl = new URL(base);
  const results = [];

  for (const p of paths) {
    const u = new URL(p, baseUrl);
    try {
      results.push(await head(u));
    } catch (e) {
      results.push({ url: u.toString(), error: e?.message || String(e) });
    }
  }

  // Pretty output that’s easy to paste into logs.
  for (const r of results) {
    if (r.error) {
      // eslint-disable-next-line no-console
      console.log(`FAIL ${r.url} :: ${r.error}`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(
      `OK   ${r.url} :: ${r.status} :: len=${r.contentLength || '??'} :: type=${r.contentType || '??'}`,
    );
  }

  const failures = results.filter((r) => r.error || (r.status && r.status >= 400));
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
