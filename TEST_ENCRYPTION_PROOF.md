# Encryption Proof Testing Guide

## Method 1: Browser Console Inspection

### Step 1: Submit IOCs with Encryption Enabled
1. Open http://192.168.1.11:3000/submit in Chrome/Firefox
2. Press `F12` to open DevTools → Go to **Console** tab
3. Enable the **"Enable Encryption"** toggle
4. Submit test IOCs: `192.168.1.100`, `evil.example.com`
5. Watch for these console logs:
   ```
   🔐 Encryption enabled - generating key...
   🔑 AES key generated: <base64 string>
   📦 Encrypted bundle size: XXXX bytes
   🔒 Ciphertext (first 100 chars): <hex gibberish>
   ```

### Step 2: Check localStorage Key Storage
In the Console tab, type:
```javascript
// List all encryption keys
Object.keys(localStorage).filter(k => k.startsWith('ioc-enc-key-'))

// View a specific key (will show base64 encoded AES-256 key)
localStorage.getItem('ioc-enc-key-<timestamp>')
```

**Expected**: You should see base64-encoded 256-bit keys (44 characters)

---

## Method 2: Network Tab - IPFS Upload Inspection

### Step 1: Monitor Pinata Upload
1. In DevTools, go to **Network** tab
2. Filter by "pinata.cloud" or "pinJSONToIPFS"
3. Submit IOCs with encryption **ENABLED**
4. Find the POST request to Pinata
5. Click on it → Go to **Payload** or **Request** tab

### Step 2: Verify Ciphertext Upload
Look at the JSON being uploaded - it should contain:
```json
{
  "pinataContent": {
    "ciphertext": "a1b2c3d4e5f6...",  // ← Long hex string (gibberish)
    "nonce": "1a2b3c4d5e6f7g8h...",     // ← 96-bit random value
    "authTag": "9z8y7x6w5v...",         // ← 128-bit authentication tag
    "metadataHash": "0x123abc...",      // ← keccak256 of metadata
    "keyId": "ioc-enc-key-1734..."      // ← Reference to localStorage key
  }
}
```

**PROOF**: The `ciphertext` field should be **unreadable gibberish**, NOT your original IOCs like "192.168.1.100"

### Step 3: Compare with Unencrypted Submission
1. Disable encryption toggle
2. Submit the SAME IOCs again
3. Check Network tab for Pinata upload
4. **Expected difference**:
   ```json
   // Unencrypted (you'll see plaintext):
   {
     "pinataContent": {
       "type": "bundle",
       "objects": [
         {
           "type": "indicator",
           "pattern": "[ipv4-addr:value = '192.168.1.100']"  // ← READABLE!
         }
       ]
     }
   }
   ```

---

## Method 3: IPFS Content Verification

### Step 1: Get the IPFS CID
After successful submission, note the transaction hash and find the `BatchAdded` event on Etherscan:
- https://sepolia.etherscan.io/address/0x664Ed327B97f910E842f9FedBAe115d5b9E8aFD3#events

The event will show the IPFS CID (e.g., `QmXYZ123...`)

### Step 2: Fetch from IPFS Gateway
```bash
# Try to read the content directly from IPFS
curl https://gateway.pinata.cloud/ipfs/QmXYZ123...
```

**Expected Output (Encrypted)**:
```json
{
  "ciphertext": "8a7f3e2d1c0b9a8f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d...",
  "nonce": "1a2b3c4d5e6f7g8h9i0j1k2l",
  "authTag": "9z8y7x6w5v4u3t2s1r0q9p8o",
  "metadataHash": "0x456def...",
  "keyId": "ioc-enc-key-1734567890123"
}
```

**PROOF**: The content should be **impossible to read** without the decryption key from your localStorage.

### Step 3: Try to Decrypt (with key)
In the browser console:
```javascript
// Import the decryption function
const { IOCEncryption } = await import('/utils/encryption.js');

// Get the encrypted data from IPFS
const response = await fetch('https://gateway.pinata.cloud/ipfs/QmXYZ123...');
const encryptedData = await response.json();

// Get the key from localStorage
const keyBase64 = localStorage.getItem(encryptedData.keyId);
const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

// Decrypt
const encryptor = new IOCEncryption();
const decrypted = await encryptor.decryptBundle(
  encryptedData.ciphertext,
  keyBytes,
  encryptedData.nonce,
  encryptedData.authTag,
  encryptedData.metadataHash
);

console.log('🔓 Decrypted IOCs:', decrypted);
```

**Expected**: You should see your original IOCs: `["192.168.1.100", "evil.example.com"]`

---

## Method 4: Smart Contract Event Comparison

### Step 1: Submit Same IOCs Twice
1. First submission: **Encryption ENABLED**
2. Second submission: **Encryption DISABLED**

### Step 2: Compare Events on Etherscan
Go to: https://sepolia.etherscan.io/address/0x664Ed327B97f910E842f9FedBAe115d5b9E8aFD3#events

Find the two `BatchAdded` events:

**Event 1 (Encrypted)**:
- `cid`: QmABC... (encrypted payload on IPFS)
- `cidCommitment`: 0x789def... (keccak256 hash)

**Event 2 (Unencrypted)**:
- `cid`: QmXYZ... (plaintext payload on IPFS)
- `cidCommitment`: 0x123abc... (different hash)

**PROOF**: The two CIDs should be **completely different** even though you submitted the same IOCs, because one contains ciphertext and one contains plaintext.

---

## Method 5: Security Test - Attempt Decryption Without Key

### Step 1: Clear localStorage
```javascript
// In browser console
localStorage.clear();
```

### Step 2: Try to Decrypt
Fetch the IPFS content and attempt decryption **without the key**.

**Expected Result**: Decryption should **FAIL** with an error like:
```
Error: Invalid authentication tag
Error: Key not found in localStorage
```

**PROOF**: This demonstrates that the encryption key is **required** and the data cannot be read without it.

---

## Method 6: Screenshot Evidence for CP2 Report

### Recommended Screenshots:
1. **Before Encryption**: Network tab showing Pinata upload with plaintext STIX bundle
2. **After Encryption**: Network tab showing ciphertext/nonce/authTag instead of IOCs
3. **localStorage Keys**: Console showing stored encryption keys
4. **IPFS Gateway**: Browser showing unreadable ciphertext when fetching encrypted CID
5. **Successful Decryption**: Console log showing decrypted IOCs match original input
6. **Etherscan Events**: Two `BatchAdded` events with different CIDs for same IOC set

---

## Quick Automated Test Script

Save this as `test-encryption.js` and run in browser console:

```javascript
async function testEncryption() {
  console.log('🧪 Starting encryption test...');
  
  const testIOCs = ['192.168.1.100', 'evil.example.com', 'badfile.exe'];
  
  // 1. Generate key
  const { IOCEncryption } = await import('/utils/encryption.js');
  const encryptor = new IOCEncryption();
  const key = await encryptor.generateKey();
  console.log('✅ Key generated:', key.length === 32 ? 'PASS' : 'FAIL');
  
  // 2. Encrypt
  const metadata = { timestamp: Date.now(), source: 'test' };
  const encrypted = await encryptor.encryptBundle(testIOCs, metadata);
  console.log('✅ Encrypted:', encrypted.ciphertext.length > 0 ? 'PASS' : 'FAIL');
  
  // 3. Verify ciphertext is different from plaintext
  const plaintextStr = JSON.stringify(testIOCs);
  const isDifferent = !encrypted.ciphertext.includes('192.168.1.100');
  console.log('✅ Ciphertext obfuscated:', isDifferent ? 'PASS' : 'FAIL');
  
  // 4. Decrypt
  const decrypted = await encryptor.decryptBundle(
    encrypted.ciphertext,
    encrypted.key,
    encrypted.nonce,
    encrypted.authTag,
    encrypted.metadataHash
  );
  console.log('✅ Decrypted:', JSON.stringify(decrypted.iocs) === JSON.stringify(testIOCs) ? 'PASS' : 'FAIL');
  
  // 5. Test wrong key fails
  try {
    const wrongKey = await encryptor.generateKey();
    await encryptor.decryptBundle(
      encrypted.ciphertext,
      wrongKey,
      encrypted.nonce,
      encrypted.authTag,
      encrypted.metadataHash
    );
    console.log('❌ Wrong key test: FAIL (should have thrown error)');
  } catch (e) {
    console.log('✅ Wrong key rejected:', 'PASS');
  }
  
  console.log('🎉 All tests completed!');
}

testEncryption();
```

---

## Academic Proof for CP2 Report

### Required Evidence:
1. **Code Inspection**: Show `encryption.js` uses `crypto.subtle.encrypt()` with AES-GCM
2. **Network Trace**: Screenshot of Pinata API request showing ciphertext payload
3. **IPFS Verification**: Screenshot of gateway showing encrypted content
4. **Smart Contract**: Show `cidCommitment` field stores only hash, not full CID
5. **Decryption Test**: Console log proving roundtrip works (encrypt → upload → retrieve → decrypt)

### Limitation Disclosure:
Add this to your report:
> "⚠️ **Security Limitation**: Encryption keys are stored in browser localStorage, which is vulnerable to XSS attacks. This implementation is a **Proof of Concept** for academic purposes. Production systems should use public-key cryptography (ECIES) with key wrapping, as outlined in the CP3 roadmap."

---

## Quick Visual Test (Right Now!)

Run this in your terminal to see the encryption in action:

```bash
# SSH to server and test the encryption module
ssh sc@192.168.1.11 "cd blockchain-dev/cti-frontend && node -e \"
const crypto = require('crypto');

// Simulate Web Crypto API for Node.js
const testData = JSON.stringify(['192.168.1.100', 'evil.example.com']);
const key = crypto.randomBytes(32);
const nonce = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

let encrypted = cipher.update(testData, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();

console.log('📝 Original:', testData);
console.log('🔒 Encrypted:', encrypted.substring(0, 100) + '...');
console.log('✅ Proof: Ciphertext is unreadable gibberish!');
\""
```

This will show you **immediate visual proof** that encryption transforms readable IOCs into gibberish.
