# 🧪 Encryption Test Case - Step-by-Step

## Test Objective
Prove that AES-256-GCM encryption works end-to-end:
1. IOCs are encrypted before IPFS upload
2. Ciphertext is unreadable without key
3. Decryption with correct key recovers original data
4. CID commitment is stored on-chain (not full CID)

---

## 📋 Pre-Test Checklist
- ✅ Frontend running at http://192.168.1.11:3000
- ✅ MetaMask connected to Sepolia testnet
- ✅ Browser DevTools open (F12) → **Network** tab
- ✅ Filter Network tab by "pinata"

---

## 🎯 Test Case 1: Verify Encryption Toggle

### Steps:
1. Visit: `http://192.168.1.11:3000/submit`
2. Scroll down to find the purple toggle switch
3. **Verify UI elements:**
   - [ ] Toggle labeled "Client-Side Encryption (CP2)"
   - [ ] Description: "Encrypt IOC data with AES-256-GCM before IPFS upload"
   - [ ] Toggle is OFF by default (gray)

### Expected Result:
✅ Toggle switch is visible and functional

---

## 🎯 Test Case 2: Compare Unencrypted vs Encrypted Uploads

### Part A: Baseline (No Encryption)

1. **Keep toggle OFF** (gray)
2. In DevTools → **Console** tab, run:
   ```javascript
   console.clear();
   console.log('🔓 Testing UNENCRYPTED submission...');
   ```
3. Enter test IOCs:
   ```
   192.168.1.100
   evil.example.com
   badfile.exe
   ```
4. Click **"Submit Batch"**
5. In **Network** tab, find the request to `pinata.cloud/pinning/pinJSONToIPFS`
6. Click it → **Payload** tab

### Expected Payload (Unencrypted):
```json
{
  "pinataContent": {
    "version": "1.0",
    "format": "cti-ioc-batch",
    "iocs": ["192.168.1.100", "evil.example.com", "badfile.exe"],  // ← READABLE!
    "metadata": {...}
  }
}
```

7. **Save the IPFS CID** from response (e.g., `QmABC123...`)
8. **Verify on IPFS Gateway:**
   ```bash
   curl https://gateway.pinata.cloud/ipfs/QmABC123...
   ```
   **Expected**: You should see your IOCs in plaintext

---

### Part B: Encrypted Upload

1. **Enable the toggle** (should turn PURPLE) ✅
2. **Wait for yellow warning box** to appear:
   > ⚠️ **Proof-of-Concept:** Encryption key stored in browser localStorage...

3. In DevTools → **Console** tab, run:
   ```javascript
   console.clear();
   console.log('🔐 Testing ENCRYPTED submission...');
   ```

4. Enter **SAME IOCs**:
   ```
   192.168.1.100
   evil.example.com
   badfile.exe
   ```

5. Click **"Submit Batch"**

6. **Watch Console** for encryption logs:
   ```
   ✅ IOC bundle encrypted with AES-256-GCM
      KeyId: 0x123abc...
      Key stored locally (DEMO ONLY)
   ```

7. In **Network** tab, find the Pinata request → **Payload** tab

### Expected Payload (Encrypted):
```json
{
  "pinataContent": {
    "version": "1.0",
    "type": "encrypted-ioc-bundle",
    "algorithm": "AES-256-GCM",
    "ciphertext": [147, 89, 203, 45, 102, ...],  // ← NUMBERS, NOT TEXT!
    "nonce": [18, 56, 92, ...],
    "authTag": [201, 78, ...],
    "keyId": "0x456def...",
    "metadataHash": "0x789abc...",
    "timestamp": 1734567890123
  }
}
```

8. **Save the IPFS CID** (e.g., `QmXYZ789...`)

### 🔍 Critical Verification:
**The two CIDs should be DIFFERENT** even though you submitted the same IOCs!
- Unencrypted CID: `QmABC123...`
- Encrypted CID: `QmXYZ789...`

---

## 🎯 Test Case 3: Verify IPFS Content is Encrypted

### Steps:
1. Open a new browser tab
2. Visit the encrypted CID:
   ```
   https://gateway.pinata.cloud/ipfs/QmXYZ789...
   ```

### Expected Result:
```json
{
  "version": "1.0",
  "type": "encrypted-ioc-bundle",
  "algorithm": "AES-256-GCM",
  "ciphertext": [147, 89, 203, 45, 102, 88, 72, ...],  // ← GIBBERISH
  "nonce": [18, 56, 92, ...],
  "authTag": [201, 78, ...],
  "keyId": "0x456def...",
  "metadataHash": "0x789abc...",
  "timestamp": 1734567890123
}
```

### ✅ PROOF:
- **NO readable IOCs** like "192.168.1.100" or "evil.example.com"
- Only arrays of numbers (encrypted bytes)
- This proves encryption is working!

---

## 🎯 Test Case 4: Verify localStorage Key Storage

### Steps:
1. In DevTools → **Console** tab, run:
   ```javascript
   // List all encryption keys
   const keys = Object.keys(localStorage).filter(k => k.startsWith('ioc-key-'));
   console.log('🔑 Stored encryption keys:', keys);
   
   // View the most recent key
   if (keys.length > 0) {
     const keyData = JSON.parse(localStorage.getItem(keys[0]));
     console.log('📄 Key details:', {
       keyId: keyData.keyId,
       algorithm: keyData.algorithm,
       keyLength: keyData.key.length + ' bytes',
       timestamp: new Date(keyData.timestamp).toLocaleString()
     });
   }
   ```

### Expected Output:
```javascript
🔑 Stored encryption keys: ['ioc-key-0x456def...']
📄 Key details: {
  keyId: '0x456def...',
  algorithm: 'AES-256-GCM',
  keyLength: '32 bytes',
  timestamp: '12/19/2025, 8:45:30 PM'
}
```

### ✅ PROOF:
- Key is 32 bytes (256 bits) ✓
- Stored with timestamp ✓
- Algorithm is AES-256-GCM ✓

---

## 🎯 Test Case 5: Decrypt Retrieved IOCs

### Steps:
1. In DevTools → **Console** tab, paste this decryption script:

```javascript
// Fetch encrypted data from IPFS
const encryptedCID = 'QmXYZ789...';  // ← Replace with YOUR encrypted CID
const response = await fetch(`https://gateway.pinata.cloud/ipfs/${encryptedCID}`);
const encryptedData = await response.json();

console.log('📦 Retrieved encrypted data:', encryptedData);

// Get the key from localStorage
const keyData = JSON.parse(localStorage.getItem(`ioc-key-${encryptedData.keyId}`));
if (!keyData) {
  console.error('❌ Key not found! KeyId:', encryptedData.keyId);
} else {
  console.log('✅ Key found in localStorage');
  
  // Import the encryption module (if not already loaded)
  const { IOCEncryption } = await import('/utils/encryption.js');
  const encryptor = new IOCEncryption();
  
  // Decrypt
  try {
    const decrypted = await encryptor.decryptBundle(
      encryptedData.ciphertext,
      new Uint8Array(keyData.key),
      encryptedData.nonce,
      encryptedData.authTag,
      encryptedData.metadataHash
    );
    
    console.log('🔓 DECRYPTED IOCs:', decrypted);
    console.log('✅ Decryption successful! Original data recovered:');
    console.log(JSON.stringify(decrypted, null, 2));
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
  }
}
```

2. **Replace `QmXYZ789...` with your actual encrypted CID**
3. Run the script

### Expected Output:
```javascript
📦 Retrieved encrypted data: {ciphertext: Array(256), nonce: Array(12), ...}
✅ Key found in localStorage
🔓 DECRYPTED IOCs: {
  "iocs": ["192.168.1.100", "evil.example.com", "badfile.exe"],
  "format": "cti-ioc-batch",
  "timestamp": "2025-12-19T..."
}
✅ Decryption successful! Original data recovered
```

### ✅ PROOF:
- Decrypted IOCs **EXACTLY MATCH** your original input ✓
- Encryption → Upload → Retrieve → Decrypt roundtrip works! ✓

---

## 🎯 Test Case 6: Verify CID Commitment on Blockchain

### Steps:
1. After successful submission, note the **Transaction Hash** from MetaMask
2. Visit Sepolia Etherscan:
   ```
   https://sepolia.etherscan.io/tx/0xYOURTXHASH
   ```
3. Click **"Logs"** tab
4. Find the `BatchAdded` event

### Expected Event Data:
```
BatchAdded (
  index: 123,
  cid: "QmXYZ789...",              // ← Full IPFS CID (in event for retrieval)
  cidCommitment: 0x456def...,      // ← keccak256(CID) stored on-chain
  merkleRoot: 0x789abc...,
  isPublic: true,
  contributorHash: 0xabc123...
)
```

### ✅ PROOF:
- **On-chain storage**: Only `cidCommitment` (32 bytes hash)
- **Event emission**: Full `cid` (for IPFS retrieval)
- **Privacy preserved**: Can't reverse hash to get CID without event logs

---

## 🎯 Test Case 7: Authentication Tag Validation

### Steps:
1. In DevTools → **Console**, try to decrypt with **wrong auth tag**:

```javascript
// Fetch encrypted data
const encryptedCID = 'QmXYZ789...';  // Your CID
const response = await fetch(`https://gateway.pinata.cloud/ipfs/${encryptedCID}`);
const encryptedData = await response.json();

// Get key
const keyData = JSON.parse(localStorage.getItem(`ioc-key-${encryptedData.keyId}`));

// TAMPER with auth tag
const tamperedTag = encryptedData.authTag.map(b => (b + 1) % 256);

// Try to decrypt
const { IOCEncryption } = await import('/utils/encryption.js');
const encryptor = new IOCEncryption();

try {
  await encryptor.decryptBundle(
    encryptedData.ciphertext,
    new Uint8Array(keyData.key),
    encryptedData.nonce,
    tamperedTag,  // ← WRONG TAG
    encryptedData.metadataHash
  );
  console.error('❌ TEST FAILED: Decryption should have failed!');
} catch (error) {
  console.log('✅ TEST PASSED: Authentication tag validation working!');
  console.log('   Error:', error.message);
}
```

### Expected Output:
```
✅ TEST PASSED: Authentication tag validation working!
   Error: IOC decryption failed: OperationError. Possible causes: invalid key, tampered data, or metadata mismatch.
```

### ✅ PROOF:
- AES-GCM authentication prevents tampering ✓
- Modified ciphertext/tag is rejected ✓

---

## 📊 Test Summary Checklist

After completing all tests, you should have verified:

- [x] Encryption toggle is visible and functional
- [x] Unencrypted submissions contain plaintext IOCs
- [x] Encrypted submissions contain ciphertext arrays (no readable text)
- [x] IPFS gateway shows gibberish for encrypted CIDs
- [x] Encryption key (32 bytes) is stored in localStorage
- [x] Decryption with correct key recovers original IOCs
- [x] CID commitment (hash) is stored on-chain, full CID in events
- [x] Wrong authentication tag causes decryption failure

---

## 📸 Screenshots for CP2 Report

Take these screenshots:

1. **Toggle OFF**: Network tab showing plaintext Pinata payload
2. **Toggle ON**: Network tab showing ciphertext array payload
3. **IPFS Gateway**: Browser showing encrypted content (gibberish)
4. **localStorage**: Console showing stored encryption keys
5. **Decryption Success**: Console log with recovered IOCs
6. **Etherscan Event**: BatchAdded event showing cidCommitment

---

## 🎓 Academic Honesty Note

Include this in your CP2 report:

> **Security Limitation Disclosure:**
> This implementation stores encryption keys in browser localStorage, which is vulnerable to XSS attacks. This is an acceptable **proof-of-concept** for academic evaluation but is NOT production-ready. A production system would require:
> - Public-key encryption (ECIES) for key distribution
> - Hardware wallet integration for key derivation
> - Key escrow service with authentication
> 
> See CP3 roadmap in CHAPTER_4_IMPLEMENTATION.md for production hardening plan.

---

## ✅ Test Complete!

If all tests pass, you have successfully proven:
1. ✅ Client-side AES-256-GCM encryption works
2. ✅ IPFS content is unreadable without key
3. ✅ CID commitments provide on-chain privacy
4. ✅ Authentication tags prevent tampering
5. ✅ End-to-end encryption workflow is functional

**Your CP2 encryption implementation is complete!** 🎉
