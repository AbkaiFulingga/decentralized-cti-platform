# Comprehensive Logging Guide - CTI Platform

## Overview
All major components of the CTI platform now include detailed console logging to help you monitor operations, debug issues, and understand the system flow.

## 📊 Where to View Logs

### Browser Console
Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux) to open Developer Tools, then click the **Console** tab.

---

## 🔍 EnhancedIOCSearch Component

### Batch Indexing Logs

When you click "Index All Batches", you'll see:

```
═══════════════════════════════════════════════════════
🚀 Starting Multi-Chain IOC Indexing
═══════════════════════════════════════════════════════

📡 Indexing from 2 networks in parallel:
   1. Sepolia (Ethereum L1)
   2. Arbitrum Sepolia (L2)

🔍 [Sepolia] Starting batch indexing...
   📡 RPC: https://sepolia.infura.io/v3/...
   📝 Registry: 0x892AD6E47...
📊 [Sepolia] Found 3 batches
🔎 [Sepolia] Fetching BatchAdded events...
✅ [Sepolia] Retrieved 3 events
   📦 Batch 0: QmXxx...
   📦 Batch 1: QmYyy...
   📦 Batch 2: QmZzz...

🔄 [Sepolia] Processing batch 0/2...
   📡 Calling getBatch(0)...
   ✅ Batch 0 fetched: {
     cidCommitment: "0xabcd...",
     merkleRoot: "0x1234...",
     timestamp: 1703260000,
     accepted: true,
     ...
   }
   📍 CID from events: QmXxx...
   🌐 Fetching IOC data from IPFS...
   ✅ Retrieved 50 IOCs
   ✅ Batch 0 indexed successfully

═══════════════════════════════════════════════════════
📊 Indexing Complete - Summary
═══════════════════════════════════════════════════════
   🌐 Sepolia batches: 3
   ⚡ Arbitrum batches: 1
   📦 Total indexed: 4
   ⏱️  Time taken: 12.34s
═══════════════════════════════════════════════════════
```

### Error Logging

If errors occur during indexing:

```
   ❌ Failed to index batch 1: {
     error: "could not decode result data",
     code: "BAD_DATA",
     stack: "Error: could not decode..."
   }
   📊 Error data: 0xf963e4bb...
```

---

## 📤 IOCSubmissionForm Component

### Submission Flow Logs

When you submit IOCs, you'll see a detailed step-by-step log:

```
═══════════════════════════════════════════════════════
🚀 IOC Batch Submission Started
═══════════════════════════════════════════════════════

📋 Submission Configuration:
   👤 Address: 0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82
   🌐 Network: Sepolia
   🔐 Privacy Mode: public
   🔒 Encryption: OFF
   💎 Tier: STANDARD
   ✅ Registered: true

📝 Step 1: Parsing IOCs...
   ✅ Parsed 10 IOCs
   📊 Sample IOCs: ["malware.com", "192.168.1.1", "abc123..."]

🌳 Step 2: Generating Merkle tree...
   📦 Generated 10 leaves
   ✅ Merkle Root: 0x1234567890abcdef...
   🌲 Tree Depth: 4

📤 Step 3: Preparing IPFS upload...
   📦 Payload: {
     version: "1.0",
     format: "cti-ioc-batch",
     iocCount: 10,
     encrypted: false
   }
   📡 POST /api/pinata-upload - Status: 200
   ✅ IPFS CID: QmXYZ123...
   🔗 Gateway URL: https://gateway.pinata.cloud/ipfs/QmXYZ123...

📝 Step 4: Preparing smart contract interaction...
   📍 Registry Address: 0x892AD6E47dbD86aD7855f7eEAe0F4fCa6223C36A
   🌐 Network: Sepolia

🔍 Checking contributor registration...
   ✅ Already registered

📡 Step 5: Public batch submission...
   🔓 Privacy Mode: Public
   📍 CID: QmXYZ123...
   🌲 Merkle Root: 0x1234567890abcdef...
   🔑 ZKP Commitment: 0xabcdef...

💰 Gas Estimation:
   🌐 Network: Sepolia (ChainID: 11155111)
   ⛽ maxFeePerGas: 12.5 Gwei
   📊 Estimated gas: 200000
   💵 Gas cost: 0.0025 ETH
   📈 1% fee: 0.000025 ETH
   🛡️  Safety: 2x
   💰 Final fee: 0.00005 ETH

📤 Sending transaction...
   CID: QmXYZ123...
   Merkle Root: 0x1234567890abcdef...
   Is Public: true
   Value: 0.00005 ETH
   Gas Limit: 350000

✅ Transaction sent!
   📋 TX Hash: 0xabcdef1234567890...
   ⏳ Waiting for confirmation...

✅ Transaction confirmed!
   ⛽ Gas used: 285432
   💰 Gas price: 11.2 Gwei
   💵 Total cost: 0.0031 ETH
   📦 Block: 5123456
   ✅ Status: Success

═══════════════════════════════════════════════════════
✅ IOC Batch Submission Complete
═══════════════════════════════════════════════════════
```

### Anonymous Submission (zkSNARK)

For anonymous submissions with Groth16 proofs:

```
═══════════════════════════════════════════════════════
🔐 Starting Groth16 zkSNARK Proof Generation
═══════════════════════════════════════════════════════

📝 Step 1: Getting Merkle proof...
   ✅ Leaf: 0xca3f375f...
   ✅ Path elements: 10
   ✅ Path indices: 10
   ✅ Root: 0x1d1a346f...

🎲 Step 2: Generating commitment nonce...
   ✅ Nonce: 12345678901234567890...

🔐 Step 3: Computing Poseidon commitment...
   ✅ Commitment: 0x22d0d382...

📋 Step 3: Preparing circuit inputs...
   ✅ Address: 115792089237316195...
   - Nonce: 12345678901234567890...
   - Merkle proof depth: 10

⚙️  Step 4: Computing witness (calculating circuit)...
   ⏱️  This may take 5-10 seconds...
   ✅ Witness computed in 8234ms

📦 Step 5: Formatting proof for Groth16Verifier.sol...
   ✅ Proof formatted
   - pA: [0x123..., 0x456...]
   - pB: 2x2 matrix
   - pC: [0x789..., 0xabc...]
   - Public signals: 2

✅ Groth16 zkSNARK proof generation complete!
   Total time: 8234ms
   Proof size: ~768 bytes (Groth16)
   Anonymity set: 1024 contributors

═══════════════════════════════════════════════════════
📡 Submitting Anonymous Batch with Groth16 Proof
═══════════════════════════════════════════════════════
CID: QmXYZ123...
Merkle Root: 0x1234567890abcdef...
Proof pA: [0x123..., 0x456...]
...
```

### Error Handling

All errors are logged with full details:

```
═══════════════════════════════════════════════════════
❌ SUBMISSION ERROR
═══════════════════════════════════════════════════════
Error Type: Error
Error Code: BAD_DATA
Error Message: could not decode result data
Error Reason: undefined
Error Data: 0xf963e4bb...
Stack Trace: Error: could not decode...
    at contract.getBatch (ethers.js:123)
    at handleSubmit (IOCSubmissionForm.jsx:456)
═══════════════════════════════════════════════════════
```

---

## 🔐 zksnark-prover Utility

The zkSNARK proof generator includes detailed logging (already present):

- Tree loading progress
- Merkle proof generation steps
- Circuit input preparation
- Witness computation (with timing)
- Proof formatting

---

## 🎯 Key Logging Features

### 1. **Structured Sections**
All major operations use clear section headers with emoji icons for easy scanning.

### 2. **Timing Information**
- IPFS upload time
- Transaction confirmation time
- Proof generation time
- Total indexing time

### 3. **Gas Metrics**
- Estimated gas
- Actual gas used
- Gas price (in Gwei)
- Total ETH cost

### 4. **Network Information**
- Chain ID
- Network name (Sepolia/Arbitrum)
- Contract addresses
- RPC endpoints

### 5. **Transaction Details**
- Transaction hash
- Block number
- Confirmation status
- Receipt details

### 6. **Error Details**
- Error type and code
- Full error message
- Stack traces
- Contract revert reasons

---

## 🛠️ Troubleshooting with Logs

### Problem: Batch indexing fails
**Look for:** `❌ Failed to index batch X`
**Check:** Error code, error data, cidCommitment value

### Problem: Transaction reverts
**Look for:** `❌ SUBMISSION ERROR` section
**Check:** Error reason, error data, gas estimation

### Problem: IPFS upload fails
**Look for:** `❌ IPFS upload failed`
**Check:** HTTP status code, response body

### Problem: zkSNARK proof generation fails
**Look for:** `❌ zkSNARK submission failed`
**Check:** Tree loading, Merkle proof, circuit inputs

---

## 📝 Example Console Session

Here's what a successful submission looks like in the console:

```
[12:34:56] 🚀 IOC Batch Submission Started
[12:34:57] ✅ Parsed 10 IOCs
[12:34:57] ✅ Merkle Root: 0x1234...
[12:34:59] ✅ IPFS CID: QmXYZ...
[12:35:00] ✅ Already registered
[12:35:01] 💰 Final fee: 0.00005 ETH
[12:35:02] ✅ Transaction sent!
[12:35:15] ✅ Transaction confirmed!
[12:35:15] ⛽ Gas used: 285432
[12:35:15] ✅ IOC Batch Submission Complete
```

---

## 🎨 Log Emoji Legend

- 🚀 = Starting operation
- ✅ = Success
- ❌ = Error
- ⚠️  = Warning
- 📡 = Network call
- 🔐 = Cryptographic operation
- 💰 = Financial/gas information
- 📊 = Statistics/summary
- 🔍 = Inspection/verification
- 🌐 = IPFS/external service
- ⏳ = Waiting/in progress
- 📦 = Data/package
- 🌲 = Merkle tree operation
- 🔑 = Key/commitment
- ⛽ = Gas

---

## 💡 Tips

1. **Keep Console Open**: Always have the browser console open when using the platform
2. **Filter Logs**: Use browser console filters to focus on specific components
3. **Copy Logs**: Right-click any log entry to copy for bug reports
4. **Timestamps**: Browser adds timestamps to all console messages
5. **Export Logs**: Right-click in console → "Save as..." to export full session

---

## 🐛 Reporting Issues

When reporting issues, please include:
1. Full console log output (copy from browser console)
2. Browser and version
3. Wallet (MetaMask) version
4. Network you're connected to
5. Steps to reproduce

The detailed logging makes it much easier to diagnose and fix issues!
