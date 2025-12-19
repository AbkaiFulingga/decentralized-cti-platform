# 🔐 Encryption Testing Guide - FIXED

## ✅ Issue Fixed

**Problem**: `IOCEncryption is not defined` error in BatchBrowser
**Solution**: Added missing import: `import { IOCEncryption } from '../utils/encryption';`
**Status**: Deployed to server ✅

---

## 🧪 How to Test Encryption (Step-by-Step)

### Step 1: Submit an ENCRYPTED Batch

1. **Navigate to**: http://192.168.1.11:3000/submit

2. **Connect MetaMask** (top-right button)

3. **Enter test IOCs** (one per line):
   ```
   192.168.1.100
   malicious.example.com
   abc123def456
   ```

4. **CRITICAL: Enable Encryption Toggle** 🟣
   - Look for purple toggle labeled "Enable End-to-End Encryption"
   - Click to enable (should turn purple/active)
   - You should see yellow warning: "⚠️ Keys stored in localStorage (XSS vulnerable)"

5. **Register as contributor** (if not already):
   - Select tier (Standard = 0.05 ETH recommended)
   - Click "Register as Contributor"
   - Approve MetaMask transaction

6. **Open Browser DevTools**:
   - Press F12 or Cmd+Option+I
   - Go to **Network** tab
   - Filter for "pinata"

7. **Submit IOCs**:
   - Click "Submit IOCs" button
   - Watch Network tab for Pinata API request

8. **Check Pinata Payload**:
   - Click on the `pinJSONToIPFS` request
   - Go to **Request** → **Payload** tab
   - Look at `pinataContent` object

### Expected Encrypted Payload ✅

You should see **THIS** (ciphertext gibberish):

```json
{
  "pinataContent": {
    "algorithm": "AES-256-CBC",
    "ciphertext": "d731695983eae30ddfab0ee705a91cfd76479aa30757f76b55dbd6c244ce9755...",
    "iv": "567cabbd25169d60ba824854835480ea",
    "keyId": "0x1fc59246c0633329da36e71ad8dc1dd1e468e4f66be54afa9785af7a6b0be7cb",
    "metadataHash": "0x05c7226e910c54ac0173aa8b95a3c09020b64135d493bee1df5bc0a0c823d2da",
    "timestamp": 1766108439874,
    "type": "encrypted-ioc-bundle",
    "version": "1.0"
  }
}
```

**🚫 WRONG (unencrypted):**

```json
{
  "pinataContent": {
    "version": "1.0",
    "format": "cti-ioc-batch",
    "iocs": ["192.168.1.100", "malicious.example.com"],  // ← PLAINTEXT!
    "metadata": {...}
  }
}
```

---

## Step 2: Verify Encrypted IPFS Content

1. **Copy the CID** from the transaction success message (e.g., `QmXYZ123...`)

2. **Visit IPFS Gateway**:
   ```
   https://gateway.pinata.cloud/ipfs/QmXYZ123...
   ```

3. **Expected Output** (encrypted):
   ```json
   {
     "algorithm": "AES-256-CBC",
     "ciphertext": "d731695983eae30d...",  // ← GIBBERISH (good!)
     "iv": "567cabbd25169d60...",
     "keyId": "0x1fc59246...",
     "type": "encrypted-ioc-bundle"
   }
   ```

4. **🚫 WRONG Output** (unencrypted):
   ```json
   {
     "iocs": ["test"],  // ← READABLE TEXT (bad!)
     "format": "cti-ioc-batch"
   }
   ```

---

## Step 3: Check Browse Section Decryption

1. **Navigate to**: http://192.168.1.11:3000/batches

2. **Wait for batches to load** (may take 10-20 seconds)

3. **Find your encrypted batch**:
   - Look for **🔓 Decrypted** badge (green) on your latest batch
   - If you see this, decryption is WORKING! ✅

4. **Click to expand** the batch details

5. **Expected Encryption Info Panel**:
   ```
   🔓 End-to-End Encrypted (Decrypted Locally)
   
   Algorithm: AES-256-CBC
   Key ID: 0x1fc59246c0633329...6b0be7cb
   
   ✅ Decryption key found in your browser's localStorage.
      Content decrypted successfully.
   ```

6. **Check IOC Details**:
   - Should show your **plaintext IOCs** (192.168.1.100, etc.)
   - NOT ciphertext/gibberish

---

## Step 4: Verify Key Storage

1. **Open DevTools** → **Application** tab → **Local Storage** → `http://192.168.1.11:3000`

2. **Look for key** starting with `ioc-key-`:
   ```
   Key: ioc-key-0x1fc59246c0633329da36e71ad8dc1dd1e468e4f66be54afa9785af7a6b0be7cb
   Value: {"key":"3a5f8c2e...","timestamp":1766108439874}
   ```

3. **This proves** the encryption key is stored locally ✅

---

## ❓ Why Was Your Last Batch Unencrypted?

Your batch showing:
```json
{
  "iocs": ["test"],
  "format": "cti-ioc-batch"
}
```

This happened because **you did NOT enable the encryption toggle** when submitting.

### Comparison

| Encryption Toggle | IPFS Format | Type Field | IOCs Visible? |
|-------------------|-------------|------------|---------------|
| ❌ **OFF** | `cti-ioc-batch` | ❌ None | ✅ **YES** (plaintext) |
| ✅ **ON** | `encrypted-ioc-bundle` | ✅ Present | ❌ **NO** (ciphertext) |

---

## 📸 Screenshots for CP2 Report

### Required Screenshots

1. **Submission Form with Toggle Enabled**:
   - Purple encryption toggle in ON state
   - Yellow warning visible below toggle
   - Screenshot before clicking "Submit IOCs"

2. **Network Tab - Encrypted Payload**:
   - DevTools Network tab showing `pinJSONToIPFS` request
   - Request Payload tab showing `ciphertext` field (gibberish hex)
   - Highlight the `type: "encrypted-ioc-bundle"` line

3. **IPFS Gateway - Encrypted Content**:
   - Browser showing `https://gateway.pinata.cloud/ipfs/QmXYZ...`
   - JSON response with `ciphertext` field (not readable IOCs)

4. **Browse Section - Decryption Badge**:
   - `/batches` page showing encrypted batch
   - Green 🔓 "Decrypted" badge visible
   - Click to expand → show encryption metadata panel

5. **localStorage Key Storage**:
   - DevTools Application tab
   - Local Storage showing `ioc-key-...` entry
   - Value showing encrypted key material

---

## 🐛 Troubleshooting

### Issue: Toggle doesn't appear
**Fix**: Clear browser cache, hard refresh (Cmd+Shift+R)

### Issue: Network tab shows plaintext IOCs
**Cause**: You forgot to enable encryption toggle BEFORE submitting
**Fix**: Submit again with toggle ON

### Issue: "IOCEncryption is not defined" error
**Fix**: Already deployed! Refresh the page (http://192.168.1.11:3000)

### Issue: Browse section shows "🔒 Encrypted" (orange)
**Cause**: You're viewing from different browser/device (no key in localStorage)
**Fix**: This is EXPECTED behavior - only submitter can decrypt

### Issue: IPFS shows plaintext even with toggle ON
**Cause**: JavaScript error during encryption (check Console tab)
**Fix**: Check Console for errors, ensure crypto-js is loaded

---

## ✅ Success Criteria Checklist

- [ ] Encryption toggle is visible and functional on Submit page
- [ ] Network tab shows `ciphertext` field (not plaintext IOCs)
- [ ] IPFS gateway shows encrypted content (`type: "encrypted-ioc-bundle"`)
- [ ] Browse section shows 🔓 Decrypted badge on your batch
- [ ] Encryption metadata panel displays algorithm, keyId, success message
- [ ] localStorage contains `ioc-key-...` entry
- [ ] IOC Details show plaintext IOCs (decrypted successfully)

If ALL checkboxes are ✅, your encryption is **100% working**!

---

## 🎯 Quick Test Command

Run this in browser Console (on `/submit` page):

```javascript
// Check if encryption module is available
import('/utils/encryption.js').then(module => {
  const enc = new module.IOCEncryption();
  console.log('✅ Encryption module loaded:', enc.algorithm);
  
  // Test encryption
  const key = enc.generateKey();
  console.log('✅ Generated key:', key.substring(0, 20) + '...');
}).catch(err => {
  console.error('❌ Encryption module failed:', err);
});
```

Expected output:
```
✅ Encryption module loaded: AES-256-CBC
✅ Generated key: 3a5f8c2e1d4b7a9c...
```

---

## 📋 Summary

**Your current issue**: You submitted WITHOUT encryption toggle enabled

**Fix**: 
1. ✅ Import error fixed (deployed)
2. ⏳ You need to submit NEW batch WITH encryption toggle ON
3. 📸 Take screenshots of encrypted payload for CP2

**Next action**: Go to http://192.168.1.11:3000/submit and try again with toggle **ENABLED**! 🟣
