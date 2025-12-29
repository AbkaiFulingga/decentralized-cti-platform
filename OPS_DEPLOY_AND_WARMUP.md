# Ops: Deploy (git pull) + Warmup (cid-map)

This doc is the copy/paste checklist for deploying the repo to your server and warming the CID cache endpoints.

## Roles and where commands run

- **Dev machine** (your laptop/desktop): you edit code and **git push**.
- **Server** (where Next.js runs, e.g. `sc@192.168.1.11`): you **git pull** + restart PM2.

## 1) Dev machine: commit + git push

From the repo root:

```bash
git status
git add -A
git commit -m "Sepolia L1 CID view upgrade + frontend CID lookup"
git push
```

## 2) Server: git pull + restart PM2

SSH to your server and go to the repo directory that PM2 uses.

```bash
git pull
pm2 status
pm2 restart nextjs-dev
pm2 logs nextjs-dev --lines 200
```

If your PM2 process name is different, use `pm2 status` to find it.

## 3) Warm the CID map endpoint

Warming prevents the first browser session from triggering an expensive scan.

### Sepolia (11155111)

After the Sepolia upgrade, `/api/cid-map` will prefer the **view-based** mode (`getBatchCID`) and should not need `eth_getLogs`.

Open in a browser (or curl) using your real values:

```text
http://<server>:3000/api/cid-map?chainId=11155111&rpcUrl=<SEPOLIA_RPC_URL>&registry=<SEPOLIA_REGISTRY>&deploymentBlock=<DEPLOY_BLOCK>&maxBlocks=2000&force=1
```

Expected in JSON response:

- `meta.mode: "l1-view-getBatchCID"`
- `meta.cidCount` grows as batches exist

### Arbitrum Sepolia (421614)

Arbitrum remains **unchanged** and still uses event scanning (or any existing fallbacks).

```text
http://<server>:3000/api/cid-map?chainId=421614&rpcUrl=https%3A%2F%2Fsepolia-rollup.arbitrum.io%2Frpc&registry=<ARBITRUM_REGISTRY>&deploymentBlock=<ARBITRUM_DEPLOY_BLOCK>&maxBlocks=20000&force=1
```

## Common gotchas

### “CID map is empty / search skips all batches”

Usually one of:

1) **Wrong registry address** for the selected network.
   - Verify `cti-frontend/utils/constants.js` matches `test-addresses.json` (Sepolia)
   - Verify it matches `test-addresses-arbitrum.json` (Arbitrum)

2) **Wrong deploymentBlock**
   - For Sepolia, set it to the block number printed at deploy time.
   - For Arbitrum, ensure it’s not a placeholder.

3) **RPC log limits**
   - Sepolia free-tier providers often limit log ranges.
   - That’s why Sepolia now uses `getBatchCID()` to avoid logs.

### “Server works but laptop shows old behavior”

The server may not be restarted, or it may be running from a different repo directory.

- Confirm `pm2 logs nextjs-dev` shows the latest commit hash (you can log it at startup if needed)
- Confirm you’re pulling in the same directory PM2 uses
