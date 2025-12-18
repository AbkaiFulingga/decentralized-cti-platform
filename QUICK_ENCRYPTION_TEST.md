# Quick Encryption Test (30 seconds)

## Step 1: Open DevTools
1. Visit: `http://192.168.1.11:3000/submit`
2. Press **F12** → **Network** tab
3. Filter by "pinata" or "pinJSONToIPFS"

## Step 2: Test WITHOUT Encryption
1. **Leave toggle OFF** (gray)
2. Submit IOC: `test123`
3. Click the Pinata request in Network tab
4. View **Payload** → You'll see:
   ```json
   {
     "pinataContent": {
       "iocs": ["test123"]  // ← READABLE PLAINTEXT
     }
   }
   ```

## Step 3: Test WITH Encryption
1. **Enable toggle** (should turn PURPLE) ✅
2. **Wait for yellow warning to appear**
3. Submit IOC: `test456`
4. Click the Pinata request in Network tab
5. View **Payload** → You'll see:
   ```json
   {
     "pinataContent": {
       "ciphertext": [147, 89, 203, 45, 102, ...],  // ← ENCRYPTED GIBBERISH
       "nonce": [18, 56, 92, ...],
       "authTag": [201, 78, ...]
     }
   }
   ```

## ✅ PROOF:
If you see the **array of numbers** instead of `"test456"`, encryption is working!

## Common Mistakes:
❌ Forgetting to enable the toggle (it defaults to OFF)
❌ Not waiting for yellow warning box (means toggle didn't register)
❌ Looking at wrong request in Network tab (should be to pinata.cloud)

## Screenshots for CP2 Report:
Take screenshots of BOTH payloads side-by-side to show the difference!
