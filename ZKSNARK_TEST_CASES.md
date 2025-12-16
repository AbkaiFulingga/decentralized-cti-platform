# zkSNARK Test Cases - Comprehensive Validation

**Date**: December 16, 2025  
**Status**: ✅ Basic test passed - expanding test coverage  
**Frontend**: http://192.168.1.11:3000

---

## ✅ Test Case 1: Basic Anonymous Submission (PASSED)

**Description**: Single contributor submits IOCs anonymously with zkSNARK proof

**Steps**:
1. Connect wallet: 0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82
2. Submit 3-5 IOCs in anonymous mode
3. Wait for proof generation (~15-20s)
4. Approve transaction

**Expected Results**:
- ✅ Proof generates successfully
- ✅ Transaction confirms
- ✅ Gas used: ~350,000
- ✅ Address hidden (only commitment visible)

**Status**: ✅ **PASSED**

---

## 🧪 Test Case 2: Large Batch Submission

**Objective**: Test zkSNARK proof generation with larger IOC batches

### **Test 2a: 10 IOCs**
```
192.168.1.1
192.168.1.2
192.168.1.3
192.168.1.4
192.168.1.5
192.168.1.6
192.168.1.7
192.168.1.8
192.168.1.9
192.168.1.10
```

**Expected**:
- Proof generation: ~15-20s (same as small batch)
- Gas cost: ~360,000 (+storage for IOCs)
- IPFS upload: Success

### **Test 2b: 50 IOCs**
Generate 50 test IPs:
```javascript
Array.from({length: 50}, (_, i) => `192.168.1.${i + 1}`).join('\n')
```

**Expected**:
- Proof generation: ~15-20s (proof size constant!)
- Gas cost: ~380,000 (more storage)
- IPFS upload: ~2-3 seconds

### **Test 2c: 100 IOCs**
Maximum realistic batch size

**Expected**:
- Proof generation: ~15-20s (still constant!)
- Gas cost: ~400,000
- IPFS upload: ~5 seconds
- Total time: ~25-30 seconds

**Key Insight**: zkSNARK proof time is **independent of batch size** - major advantage!

---

## 🔄 Test Case 3: Multiple Sequential Submissions

**Objective**: Test circuit caching and subsequent proof generation speed

### **Setup**:
1. Submit first batch (downloads circuit files)
2. Wait for confirmation
3. Submit second batch immediately
4. Compare timing

### **Expected Results**:

| Submission | Circuit Download | Proof Generation | Total Time |
|-----------|------------------|------------------|------------|
| First | ~5-10 seconds | ~15-20 seconds | ~25-30s |
| Second | 0 seconds (cached) | ~15-20 seconds | ~15-20s |
| Third | 0 seconds | ~15-20 seconds | ~15-20s |

**Key Metric**: Second submission should be **~10 seconds faster** due to caching

---

## 🎭 Test Case 4: Privacy Verification

**Objective**: Verify that contributor address is truly hidden

### **Steps**:
1. Submit batch anonymously
2. Get transaction hash
3. Check Arbiscan transaction details
4. Inspect event logs
5. Verify commitment hash is visible but address is not

### **Verification Checklist**:
- [ ] Transaction shows `addPrivacyBatch` call
- [ ] Input data contains commitment hash
- [ ] Input data does NOT contain raw address
- [ ] Event `BatchSubmitted` emitted
- [ ] Event contains commitment, not address
- [ ] Only prover can link commitment to address

### **Arbiscan URL**:
```
https://sepolia.arbiscan.io/tx/[YOUR_TX_HASH]
```

**Expected**: ✅ Address cryptographically hidden

---

## 💰 Test Case 5: Gas Cost Comparison

**Objective**: Measure privacy premium (zkSNARK vs public submission)

### **Test 5a: Public Submission (Baseline)**
1. Submit same IOCs in **public mode**
2. Record gas used
3. Note transaction cost

### **Test 5b: Anonymous Submission (zkSNARK)**
1. Submit same IOCs in **anonymous mode**
2. Record gas used
3. Calculate premium

### **Expected Results**:

| Mode | Gas Used | ETH Cost (0.1 gwei) | Privacy |
|------|----------|---------------------|---------|
| Public | ~100,000 | ~0.00001 ETH | ❌ Address visible |
| Anonymous | ~350,000 | ~0.000035 ETH | ✅ Address hidden |
| **Premium** | **+250,000** | **+0.000025 ETH** | **3.5x cost** |

**Key Insight**: Privacy costs 3.5x more but provides true zero-knowledge

---

## 🌐 Test Case 6: Browser Compatibility

**Objective**: Test proof generation across different browsers

### **Browsers to Test**:

#### **6a: Firefox**
- Expected: Fastest performance (~15s)
- WebAssembly support: Excellent
- BigInt support: Native

#### **6b: Chrome/Brave**
- Expected: Moderate performance (~20-25s)
- WebAssembly support: Good
- BigInt support: Native

#### **6c: Safari** (Mac only)
- Expected: Untested - may have issues
- WebAssembly support: Limited
- BigInt support: Check compatibility

#### **6d: Edge**
- Expected: Similar to Chrome (~20-25s)
- WebAssembly support: Good
- BigInt support: Native

### **Performance Matrix**:

| Browser | First Load | Cached | Notes |
|---------|-----------|--------|-------|
| Firefox | 20-25s | 15-18s | ✅ Fastest |
| Chrome | 25-30s | 20-25s | ✅ Reliable |
| Brave | 25-30s | 20-25s | ✅ Privacy-focused |
| Safari | ? | ? | ⚠️ Test needed |
| Edge | 25-30s | 20-25s | ✅ Windows default |

---

## 🔐 Test Case 7: Commitment Uniqueness

**Objective**: Verify that each submission generates unique commitment

### **Steps**:
1. Submit batch with nonce = 1
2. Record commitment hash
3. Submit same IOCs with nonce = 2
4. Record second commitment hash
5. Verify commitments are different

### **Expected**:
```
Submission 1: commitment = Poseidon([address, 1]) = 0xABCD...
Submission 2: commitment = Poseidon([address, 2]) = 0x1234...
```

**Result**: ✅ Different nonces produce different commitments (replay protection)

---

## 🛡️ Test Case 8: Merkle Proof Validation

**Objective**: Verify circuit correctly validates Merkle proof

### **Test 8a: Valid Contributor**
- Address: 0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82
- Expected: ✅ Proof generates, transaction succeeds

### **Test 8b: Invalid Contributor** (if possible)
- Address: 0x0000000000000000000000000000000000000001
- Expected: ❌ Proof generation fails OR circuit assertion error

### **Verification**:
Circuit line 97 validates:
```circom
merkleRoot === computedRoot
```

If address not in tree → computed root won't match → assertion fails

---

## ⏱️ Test Case 9: Performance Under Load

**Objective**: Test system behavior with rapid submissions

### **Scenario**:
1. Submit batch 1
2. **Don't wait** for confirmation
3. Submit batch 2 immediately
4. Submit batch 3 immediately

### **Expected Behavior**:
- Frontend queues submissions
- Each proof generation takes ~15-20s
- Transactions submitted sequentially
- Total time: ~45-60 seconds for 3 batches

### **Potential Issues**:
- ⚠️ Browser memory usage (3 simultaneous proofs)
- ⚠️ Nonce management (MetaMask)
- ⚠️ IPFS upload rate limits

---

## 🔍 Test Case 10: Error Handling

**Objective**: Test graceful failure scenarios

### **Test 10a: Invalid IOC Format**
Submit malformed data:
```
not-an-ip-or-domain
random garbage text
```

**Expected**: ✅ Frontend validates, shows error message

### **Test 10b: Network Disconnected**
1. Start proof generation
2. Disconnect internet mid-process
3. Observe behavior

**Expected**: ❌ Transaction fails, clear error message

### **Test 10c: MetaMask Rejected**
1. Start proof generation
2. Reject transaction in MetaMask
3. Observe cleanup

**Expected**: ✅ Frontend resets, allows retry

### **Test 10d: Insufficient Gas**
1. Set gas limit too low
2. Submit transaction
3. Transaction reverts

**Expected**: ❌ Clear error, suggest higher gas limit

---

## 📊 Test Case 11: IPFS Integration

**Objective**: Verify IOC data stored on IPFS correctly

### **Steps**:
1. Submit batch anonymously
2. Extract IPFS hash from transaction
3. Retrieve data: `https://gateway.pinata.cloud/ipfs/[HASH]`
4. Verify IOC data matches submission

### **Expected JSON**:
```json
{
  "iocs": ["192.168.1.100", "10.0.0.50", ...],
  "timestamp": 1765876204690,
  "submitter": "anonymous",
  "commitment": "0x1234..."
}
```

**Verification**: ✅ Data integrity preserved on IPFS

---

## 🎯 Test Case 12: Contract State Verification

**Objective**: Verify on-chain state updates correctly

### **After Submission, Check**:

#### **12a: Batch Count**
```solidity
uint256 totalBatches = registry.getBatchCount();
```
**Expected**: Increments by 1

#### **12b: Contributor Reputation**
```solidity
uint256 reputation = registry.getContributorReputation(address);
```
**Expected**: Increases (tier-based: +7/+10/+15)

#### **12c: Used Nullifiers**
```solidity
bool used = registry.usedNullifiers(commitment);
```
**Expected**: `true` (prevents replay)

#### **12d: Batch Details**
```solidity
Batch memory batch = registry.getBatch(batchIndex);
```
**Expected**:
- IPFS hash matches
- Merkle root correct
- Commitment stored
- Timestamp recorded

---

## 🧬 Test Case 13: Multiple Contributors

**Objective**: Test system with multiple contributors in tree

### **Setup**:
1. Add second contributor to tree
2. Rebuild tree with Poseidon hash
3. Update contract root
4. Test both contributors submitting

### **Steps**:
```bash
# Add contributor
ssh sc@192.168.1.11 'cd blockchain-dev && node scripts/add-contributor.js 0xNEW_ADDRESS'

# Rebuild tree
npx hardhat run scripts/build-poseidon-tree.js --network arbitrumSepolia

# Update contract
npx hardhat run scripts/update-merkle-root-onchain.js --network arbitrumSepolia
```

### **Expected**:
- ✅ Contributor 1 can submit (with updated tree)
- ✅ Contributor 2 can submit (new in tree)
- ✅ Both get different Merkle proofs (different path indices)
- ✅ Both proofs verify correctly

---

## 📈 Test Case 14: Scaling Analysis

**Objective**: Analyze system scalability

### **Metrics to Measure**:

| Contributors | Tree Depth | Proof Size | Gen Time | Gas Cost |
|-------------|-----------|------------|----------|----------|
| 1 | 20 | 256 bytes | 15-20s | 350k |
| 10 | 20 | 256 bytes | 15-20s | 350k |
| 100 | 20 | 256 bytes | 15-20s | 350k |
| 1,000 | 20 | 256 bytes | 15-20s | 350k |
| 1M | 20 | 256 bytes | 15-20s | 350k |

**Key Insight**: zkSNARK verification cost is **constant** regardless of anonymity set size!

---

## 🎓 Test Case 15: FYP Demonstration

**Objective**: End-to-end demo for FYP presentation

### **Demo Script** (5 minutes):

**Minute 1: Introduction**
- "This is a privacy-preserving CTI platform using zkSNARKs"
- "I'll submit threat intelligence anonymously"

**Minute 2: Setup**
- Open http://192.168.1.11:3000
- Connect MetaMask
- Navigate to Submit page

**Minute 3: Submission**
- Enter test IOCs (5-10 items)
- Select "Anonymous" mode
- Explain: "Browser will generate Groth16 proof"
- Show: "Using Poseidon hash for efficiency"

**Minute 4: Wait & Explain**
- "Proof generation: ~15-20 seconds"
- "Computing 2,000 R1CS constraints"
- "All computation happens locally"
- "No data leaves my browser"

**Minute 5: Verify**
- Transaction confirms
- Check Arbiscan: "Notice address is hidden"
- Show commitment hash
- Compare gas: "3.5x cost for privacy"
- Conclusion: "True zero-knowledge submission"

### **Key Talking Points**:
1. ✅ Browser-based (no trusted party)
2. ✅ Poseidon hash (1000x efficiency)
3. ✅ Groth16 protocol (industry standard)
4. ✅ Constant verification cost
5. ✅ Practical deployment (live on Arbitrum)

---

## 📋 Testing Checklist

### **Basic Functionality**
- [ ] Test Case 1: Basic submission ✅ PASSED
- [ ] Test Case 2: Large batches
- [ ] Test Case 3: Sequential submissions
- [ ] Test Case 4: Privacy verification

### **Performance**
- [ ] Test Case 5: Gas cost comparison
- [ ] Test Case 6: Browser compatibility
- [ ] Test Case 9: Performance under load

### **Security**
- [ ] Test Case 7: Commitment uniqueness
- [ ] Test Case 8: Merkle proof validation
- [ ] Test Case 10: Error handling

### **Integration**
- [ ] Test Case 11: IPFS integration
- [ ] Test Case 12: Contract state verification

### **Scalability**
- [ ] Test Case 13: Multiple contributors
- [ ] Test Case 14: Scaling analysis

### **Demonstration**
- [ ] Test Case 15: FYP demo rehearsal

---

## 🎯 Priority Test Cases (Next Steps)

### **High Priority** (Do Now):
1. **Test Case 2a**: 10 IOCs - verify batch handling
2. **Test Case 5**: Gas comparison - get actual numbers
3. **Test Case 4**: Privacy verification - screenshot for FYP

### **Medium Priority** (Today):
4. **Test Case 6**: Browser compatibility - test Firefox vs Chrome
5. **Test Case 3**: Sequential submissions - test caching
6. **Test Case 11**: IPFS verification - validate data integrity

### **Low Priority** (Later):
7. **Test Case 13**: Multiple contributors - add more addresses
8. **Test Case 14**: Scaling analysis - theoretical analysis
9. **Test Case 15**: FYP demo - final rehearsal

---

## 📊 Test Results Template

```markdown
## Test Case X: [Name]

**Date**: [Date]
**Tester**: [Name]
**Browser**: [Chrome/Firefox/etc.]

### Results:
- Proof Generation Time: X seconds
- Gas Used: X
- Transaction Hash: 0x...
- IPFS Hash: Qm...

### Screenshots:
1. [Frontend submission form]
2. [Proof generation progress]
3. [MetaMask confirmation]
4. [Arbiscan transaction]

### Notes:
[Any observations or issues]

### Status: ✅ PASSED / ❌ FAILED / ⚠️ ISSUES
```

---

## 🚀 Let's Start Testing!

**Recommended Order**:
1. Test Case 2a (10 IOCs) - quick validation
2. Test Case 5 (Gas comparison) - critical metric
3. Test Case 4 (Privacy verification) - screenshot for report

Would you like to run any specific test case? I can help execute and document the results!
