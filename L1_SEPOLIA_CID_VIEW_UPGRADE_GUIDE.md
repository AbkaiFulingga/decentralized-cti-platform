# Sepolia L1 CID View Upgrade (Option B)

This upgrade makes **Sepolia (L1)** searchable without relying on event log scans (`eth_getLogs`).

It does **NOT** change or redeploy Arbitrum (L2). Your existing L2 deployment remains untouched.

## What changes

### New Sepolia-only registry contract

We deploy a Sepolia-only registry variant:

- `contracts/PrivacyPreservingRegistryL1.sol`
  - stores plaintext IPFS CID strings on-chain in `mapping(uint256 => string)`
  - exposes `getBatchCID(uint256 index) -> string`

The base contract (`PrivacyPreservingRegistry.sol`) is unchanged in behavior, except `addBatch(...)` is now `virtual` to allow the L1 variant to override.

### Frontend behavior

- On Sepolia, the frontend will try `getBatchCID(index)` first.
- On Arbitrum, nothing changes (still uses existing CID lookup behavior).
- `/api/cid-map` will also try `getBatchCID()` on Sepolia; if not available, it falls back to event scanning.

## Safety / principles (anonymity, ZKP, immutability)

This approach is compatible with your principles:

- **Immutability**: the CID is written on-chain; it becomes an immutable reference.
- **ZKP / anonymity**: the CID itself does not reveal the contributor identity; anonymity is provided by the existing commitment + ZKP mechanism.
  - Note: storing the CID on-chain does make the underlying batch payload publicly fetchable by anyone who knows how to resolve IPFS.
  - If your threat intel payload must be hidden, you should encrypt the IPFS payload client-side and store only an encrypted CID/pointer.

## Deploy (Sepolia only) — low-error checklist

### 0) Preconditions

- You have a machine with Node + Hardhat installed.
- Your `.env` contains:
  - `SEPOLIA_RPC_URL`
  - `PRIVATE_KEY_ADMIN1`
  - `PRIVATE_KEY_ADMIN2`
  - `PRIVATE_KEY_ADMIN3`

### 1) Sanity: confirm you are targeting Sepolia

Run a Sepolia-only deploy script that hard-fails if chainId != 11155111:

`scripts/deployL1SepoliaCIDView.js`

### 2) Deploy

Run the deploy for Sepolia:

```bash
npx hardhat run scripts/deployL1SepoliaCIDView.js --network sepolia
```

Expected output:

- A new `PrivacyPreservingRegistry` address (this time it is actually `PrivacyPreservingRegistryL1`)
- `test-addresses.json` updated
- explorer links printed

### 3) Update frontend addresses

In `cti-frontend/utils/constants.js`, update Sepolia addresses to match `test-addresses.json`.

Also update `deploymentBlock` to the `blockNumber` printed by the deploy script.

### 4) Restart frontend server

On your server where Next.js runs:

- `git pull`
- restart your PM2 process

### 5) Warm and verify CID map (Sepolia)

After restart, warm the endpoint:

```text
http://<server>:3000/api/cid-map?chainId=11155111&rpcUrl=<SEPOLIA_RPC_URL>&registry=<NEW_REGISTRY>&deploymentBlock=<DEPLOY_BLOCK>&maxBlocks=2000&force=1
```

You should see in the response meta:

- `mode: "l1-view-getBatchCID"`
- `cidCount` increasing once you have batches

### 6) Verify end-to-end

1. Submit a small batch on Sepolia.
2. In the browser console, verify Search logs show:
   - `CID resolved: <Qm... or bafy...>`
   - no "No CID found" failures on Sepolia

## Rollback plan

If anything looks wrong, rollback is just:

- revert Sepolia addresses in `cti-frontend/utils/constants.js` back to the previous `test-addresses.json`
- redeploy the old contract version if you want (not required; frontend can point back)

Arbitrum is unaffected either way.
