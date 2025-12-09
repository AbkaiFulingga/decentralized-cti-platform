# Powers of Tau - Setup Guide

## What is Powers of Tau?

The **Powers of Tau ceremony** is a one-time trusted setup that generates cryptographic parameters for zkSNARK circuits. Think of it as a universal "randomness battery" that all zkSNARK proofs can use.

**Key Points:**
- ✅ **Universal:** One ceremony file works for ALL circuits (up to a constraint limit)
- ✅ **Trusted:** Created through multi-party computation (100+ participants)
- ✅ **Reusable:** Download once, use forever
- ✅ **Public:** Same file used by ZCash, Tornado Cash, Polygon zkEVM

---

## File Specifications

### For Our Circuit (10,918 constraints)

We need **ptau_15** (supports up to 32,768 constraints):

```
Filename: powersOfTau28_hez_final_15.ptau
Size: 288,734,806 bytes (~275 MB)
MD5: (varies by source, verify size instead)
Ceremony: Hermez/Polygon zkEVM ceremony
Constraints supported: 2^15 = 32,768
```

**Our circuit stats:**
- Constraints: 10,918
- Required ptau: 2^14 (16,384) minimum
- Recommended ptau: 2^15 (32,768) for headroom

---

## Download Options

### Option 1: Google Cloud Storage (RECOMMENDED)

```bash
cd circuits

# Download ptau_15 (275 MB)
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau

# Or with curl (resumable)
curl -L -C - -O https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau

# Verify size
ls -lh powersOfTau28_hez_final_15.ptau
# Should show ~275M
```

### Option 2: SnarkJS GitHub (if available)

```bash
wget https://github.com/iden3/snarkjs/raw/master/tools/powersOfTau28_hez_final_15.ptau
```

### Option 3: Original Hermez S3 (may be deprecated)

```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau
```

### Option 4: Alternative - Use Smaller ptau_14

If ptau_15 is unavailable, use ptau_14 (we have 10,918 constraints < 16,384):

```bash
# Download ptau_14 (137 MB - half the size!)
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau

# Update the script to use ptau_14
sed -i 's/powersOfTau28_hez_final_15/powersOfTau28_hez_final_14/g' setup-circuit.sh
sed -i 's/288734806/144374342/g' setup-circuit.sh  # Update expected size

# Then run setup
./setup-circuit.sh
```

---

## All Available ptau Files

| File | Max Constraints | Size | Use Case |
|------|-----------------|------|----------|
| ptau_08 | 256 | 1 MB | Tiny circuits |
| ptau_10 | 1,024 | 4 MB | Small circuits |
| ptau_12 | 4,096 | 17 MB | Medium circuits |
| ptau_14 | 16,384 | 137 MB | **Our circuit (10,918)** ✅ |
| ptau_15 | 32,768 | 275 MB | **Recommended** ✅ |
| ptau_16 | 65,536 | 550 MB | Large circuits |
| ptau_20 | 1,048,576 | 8 GB | Huge circuits |

**Download any size from:**
```
https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_XX.ptau
```
(Replace XX with 08, 10, 12, 14, 15, 16, 20, etc.)

---

## Verification

### Check File Size

```bash
# macOS
stat -f%z powersOfTau28_hez_final_15.ptau

# Linux
stat -c%s powersOfTau28_hez_final_15.ptau

# Expected: 288734806 (for ptau_15)
```

### Test with SnarkJS

```bash
# If file is valid, this should NOT error
npx snarkjs powersoftau verify powersOfTau28_hez_final_15.ptau
```

---

## Alternative: Generate Your Own (NOT RECOMMENDED)

⚠️ **Warning:** Generating your own ptau is NOT secure for production (you'd know the toxic waste). Only use this for testing.

```bash
# This would take HOURS and is insecure (single party)
npx snarkjs powersoftau new bn128 15 pot15_0000.ptau -v
npx snarkjs powersoftau contribute pot15_0000.ptau pot15_0001.ptau --name="First" -v
# ... many more steps ...
```

**DO NOT USE FOR PRODUCTION.** Always use the official ceremony files from trusted multi-party ceremonies.

---

## Trusted Setup Background

### How It Works

1. **Ceremony:** 100+ participants each contribute randomness
2. **Security:** As long as ONE participant is honest, the setup is secure
3. **Toxic Waste:** Each participant deletes their secret after contributing
4. **Output:** Public parameters (ptau file) that everyone can use

### Notable Ceremonies

- **Zcash Powers of Tau:** 87 participants (2017)
- **Hermez/Polygon:** Extended Zcash ceremony (2020)
- **Ethereum KZG Ceremony:** 140,000+ participants (2023)

### Trust Assumptions

You must trust that:
- ✅ At least ONE of the 100+ participants was honest
- ✅ At least ONE deleted their toxic waste

**In practice:** Extremely safe. Breaking this would require ALL participants to collude.

---

## Troubleshooting

### "Invalid File format" Error

**Cause:** File corrupted during download

**Solution:**
```bash
rm powersOfTau28_hez_final_15.ptau
# Re-download with resume support
curl -L -C - -O https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau
```

### "Not enough constraints" Error

**Cause:** ptau file too small for circuit

**Solution:** Use larger ptau (our circuit needs ptau_14 minimum)

### "File too large" Error

**Cause:** Disk space issue (275 MB required)

**Solution:**
```bash
# Check disk space
df -h .

# Or use smaller ptau_14 (137 MB)
```

### Download Speed Slow

**Solution:** Use a mirror closer to your location:
- Google Cloud: Global CDN (fast everywhere)
- S3 EU-West: Fast in Europe
- GitHub: Good for small files

---

## Quick Commands Reference

```bash
# Download (recommended)
cd circuits
curl -L -C - -O https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau

# Verify size (Linux)
stat -c%s powersOfTau28_hez_final_15.ptau

# Verify size (macOS)
stat -f%z powersOfTau28_hez_final_15.ptau

# Expected: 288734806

# Test file validity
npx snarkjs powersoftau verify powersOfTau28_hez_final_15.ptau

# Run circuit setup
./setup-circuit.sh
```

---

## For Your Specific Case

Since the Hermez S3 URL is down, use:

```bash
cd ~/blockchain-dev/circuits

# Remove corrupted file
rm powersOfTau28_hez_final_15.ptau

# Download from Google Cloud (most reliable)
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau

# Verify size (should be 288734806 bytes)
stat -c%s powersOfTau28_hez_final_15.ptau

# Continue with setup
./setup-circuit.sh
```

**If Google Cloud is also slow/blocked, use ptau_14:**

```bash
# Download smaller file (137 MB instead of 275 MB)
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau

# Update script to use ptau_14
nano setup-circuit.sh
# Change: PTAU_FILE="powersOfTau28_hez_final_14.ptau"
# Change: PTAU_SIZE=144374342

# Run setup
./setup-circuit.sh
```

---

## Need Help?

If all download sources fail, you can:

1. **Use university/company mirror** (if available)
2. **Ask me to upload to alternative location**
3. **Use ptau_14** (works fine, just less headroom)
4. **Download on different network** (some ISPs/firewalls block large files)

The ptau file is deterministic - any valid copy from any source will work!
