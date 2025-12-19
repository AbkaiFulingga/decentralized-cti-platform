# 🔐 Start SSH Tunnel for Web Crypto API

## ⚠️ CRITICAL: Why You Need This

**Web Crypto API only works on:**
- ✅ `https://` (secure HTTPS connections)
- ✅ `http://localhost` (special browser exception)
- ❌ `http://192.168.1.11` (NOT ALLOWED - your current URL)

**That's why encryption fails on `http://192.168.1.11:3000`!**

---

## 🚀 Solution: SSH Tunnel

Create a tunnel so you can access the server via `localhost`:

### **Step 1: Open a NEW Terminal Window**

### **Step 2: Run This Command**

```bash
ssh -L 3000:localhost:3000 sc@192.168.1.11 -N
```

**When prompted for password, enter:**
```
Redguard4848@
```

### **Step 3: Leave This Terminal Running**

You'll see nothing after entering the password - **this is normal!** The tunnel is running.

**DO NOT CLOSE THIS TERMINAL!** Keep it open while testing.

---

## 🧪 Testing Encryption

### **Step 4: Visit Localhost URL**

Open your browser and go to:
```
http://localhost:3000/submit
```

⚠️ **IMPORTANT**: Use `localhost`, NOT `192.168.1.11`!

### **Step 5: Test Encryption**

1. **Connect MetaMask**
2. **Enable the encryption toggle** (purple switch)
3. **Submit test IOCs**: `192.168.1.100`, `evil.example.com`
4. **Open DevTools** (F12) → Console tab
5. **Look for**:
   ```
   ✅ IOC bundle encrypted with AES-256-GCM
      KeyId: 0x...
      Key stored locally (DEMO ONLY)
   ```

### **Step 6: Verify in Network Tab**

1. **DevTools** → **Network** tab
2. Filter by "pinata"
3. Click the Pinata request → **Payload**
4. **You should see**:
   ```json
   {
     "ciphertext": [147, 89, 203, ...],  // ← Numbers, not text!
     "nonce": [...],
     "authTag": [...]
   }
   ```

**If you see arrays of numbers instead of your IOCs, encryption is working!** 🎉

---

## 🛑 Stopping the Tunnel

When done testing:
1. Go to the terminal running the SSH tunnel
2. Press `Ctrl+C`

---

## 🔧 Troubleshooting

**Problem**: "Connection refused" error

**Solution**: Make sure Next.js dev server is running on the remote server:
```bash
ssh sc@192.168.1.11
cd blockchain-dev/cti-frontend
npm run dev
```

---

**Problem**: Tunnel disconnects

**Solution**: Re-run the SSH tunnel command

---

**Problem**: Still get "Web Crypto API not available"

**Solution**: Double-check you're using `http://localhost:3000`, NOT `http://192.168.1.11:3000`

---

## 📋 Quick Reference

| What | URL |
|------|-----|
| ❌ **DON'T USE** | `http://192.168.1.11:3000` (Web Crypto won't work) |
| ✅ **DO USE** | `http://localhost:3000` (Web Crypto works!) |

**Tunnel Command**:
```bash
ssh -L 3000:localhost:3000 sc@192.168.1.11 -N
```

**Password**: `Redguard4848@`

---

## 🎓 For Your CP2 Report

Include this note:

> **Development Environment Limitation:**
> Web Crypto API requires a secure context (HTTPS or localhost). During development, an SSH tunnel was used to access the server via `http://localhost:3000`, enabling the Web Crypto API. In production, the platform would be deployed with HTTPS/TLS certificates to ensure security across all access methods.

---

**Now go test the encryption!** 🔒
