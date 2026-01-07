/**
 * Decode the input data from a tx hash using the frontend ABI.
 * Usage: TX=0x... node scripts/decode-last-tx.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const hre = require('hardhat');
  const { ethers } = hre;

  const rpcUrl = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL;
  if (!rpcUrl) throw new Error('Missing ARBITRUM_RPC in .env');
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const txHash = process.env.TX;
  if (!txHash) throw new Error('Set TX=0x...');

  const frontAbiPath = path.join(__dirname, '../cti-frontend/registry-abi.json');
  const frontAbi = JSON.parse(fs.readFileSync(frontAbiPath, 'utf8'));
  const frontIface = new ethers.Interface(frontAbi);

  // Also load the on-chain contract ABI from Hardhat artifacts for decoding.
  const hardhatArtifactPath = path.join(
    __dirname,
    '../artifacts/contracts/PrivacyPreservingRegistry.sol/PrivacyPreservingRegistry.json'
  );
  const hardhatAbi = JSON.parse(fs.readFileSync(hardhatArtifactPath, 'utf8')).abi;
  const hardhatIface = new ethers.Interface(hardhatAbi);

  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error('Transaction not found');

  console.log('[decode-last-tx] to', tx.to);
  console.log('[decode-last-tx] dataLen', tx.data ? (tx.data.length - 2) / 2 : null);
  console.log('[decode-last-tx] selector', tx.data ? tx.data.slice(0, 10) : null);

  const tryParse = (label, iface) => {
    try {
      const parsed = iface.parseTransaction({ data: tx.data });
      if (!parsed) return false;
      console.log(`[decode-last-tx] decoded (${label}) name`, parsed.name);
      console.log(`[decode-last-tx] decoded (${label}) signature`, parsed.signature);
      return true;
    } catch {
      return false;
    }
  };

  if (tryParse('frontend-abi', frontIface)) return;
  if (tryParse('hardhat-abi', hardhatIface)) return;
  console.log('[decode-last-tx] could not decode with frontend ABI or hardhat ABI');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
