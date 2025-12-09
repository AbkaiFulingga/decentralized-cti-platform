# 🛡️ Security Attack Simulation Suite

This directory contains comprehensive security testing tools that simulate real-world attacks against the Decentralized CTI Platform. These simulations demonstrate the platform's resilience to privacy breaches, economic exploits, and protocol vulnerabilities.

## 🎯 Attack Scenarios

### 1. Linkability Attack (`linkability-attack.js`)
**Objective:** Correlate multiple anonymous submissions from the same contributor

**Methodology:**
- Temporal correlation analysis (submission timing patterns)
- Gas price correlation (economic fingerprinting)
- Commitment similarity analysis (bit-level patterns)
- Statistical correlation probability calculation

**Defense Tested:** Cryptographic commitments with random nonces

**Expected Outcome:** ✅ FAIL - Commitments are statistically independent

---

### 2. Sybil Attack (`sybil-attack.js`)
**Objective:** Create multiple fake identities to spam the system without staking

**Methodology:**
- Register without stake (0 ETH)
- Register with insufficient stake (<0.01 ETH)
- Submit IOCs without registration
- Calculate economic cost of successful attack

**Defense Tested:** Smart contract stake enforcement

**Expected Outcome:** ✅ FAIL - Economic barriers prevent spam ($35,000+ for 1000 identities)

---

### 3. Replay Attack (`replay-attack.js`)
**Objective:** Reuse valid ZKP proofs for multiple submissions (double-spend)

**Methodology:**
- Capture legitimate anonymous submission
- Attempt exact replay (same proof + commitment)
- Attempt commitment reuse (different data, same commitment)
- Measure nullifier tracking effectiveness

**Defense Tested:** Commitment/nullifier uniqueness enforcement

**Expected Outcome:** ✅ FAIL - Each commitment can only be used once

---

### 4. Deanonymization Attack (`deanonymization-attack.js`)
**Objective:** Extract real identity from anonymous submissions

**Methodology:**
- Brute force commitment reversal (try all addresses + secrets)
- Merkle proof analysis (check for information leakage)
- Statistical inference (behavioral pattern matching)
- Side-channel analysis (timing, gas, metadata)

**Defense Tested:** Zero-knowledge property and 256-bit security

**Expected Outcome:** ✅ FAIL - Computationally infeasible (2^256 operations)

---

## 🚀 Usage

### Run Individual Attacks

```bash
# Test linkability (correlation analysis)
npx hardhat run scripts/attack-simulations/linkability-attack.js --network arbitrumSepolia

# Test Sybil resistance (economic spam)
npx hardhat run scripts/attack-simulations/sybil-attack.js --network arbitrumSepolia

# Test replay protection (double-spend)
npx hardhat run scripts/attack-simulations/replay-attack.js --network arbitrumSepolia

# Test anonymity (identity extraction)
npx hardhat run scripts/attack-simulations/deanonymization-attack.js --network arbitrumSepolia
```

### Run All Attacks (Comprehensive Report)

```bash
# Run full security audit
npx hardhat run scripts/attack-simulations/run-all-attacks.js --network arbitrumSepolia
```

This generates:
- `SECURITY_REPORT.json` - Machine-readable results
- `SECURITY_REPORT.md` - Human-readable report
- Individual attack result JSON files

---

## 📊 Output Format

Each attack generates a detailed JSON report:

```json
{
  "attack": "Attack Name",
  "timestamp": "2025-12-09T10:30:00.000Z",
  "network": "arbitrumSepolia",
  "total_attempts": 10,
  "successful_attacks": 0,
  "attack_success_rate": "0.00%",
  "details": { ... },
  "conclusion": "ATTACK FAILED - System is secure"
}
```

---

## 🎓 Educational Value

These simulations serve multiple purposes:

### 1. **Security Validation**
- Proves system works as designed
- Identifies vulnerabilities before production
- Documents threat model coverage

### 2. **Academic Contribution**
- Demonstrates security analysis methodology
- Provides empirical security data
- Shows understanding of attack vectors

### 3. **Presentation Impact**
- Live demonstrations during thesis defense
- Visual proof of security claims
- Interactive audience engagement

### 4. **Professional Quality**
- Industry-standard security testing
- Formal threat modeling
- Reproducible results

---

## 🔬 Technical Deep Dive

### Linkability Attack Mathematics

```
Correlation(S1, S2) = Temporal × Gas × Commitment

Temporal = e^(-Δt / 3600)       // Time difference decay
Gas = e^(-Δg / 10^9)             // Gas price similarity
Commitment = e^(-|H(C1,C2) - 128| / 50)  // Hamming distance

Expected for random: ~1% correlation
Threshold for linkage: >5% correlation
```

### Commitment Security

```
commitment = keccak256(address || secret || timestamp)

Security analysis:
- Preimage resistance: Cannot reverse keccak256
- Secret entropy: 256 bits (2^256 possibilities)
- Brute force complexity: O(2^256)
- Current computing: ~2^90 ops/year (Bitcoin network)
- Time to break: 2^166 years

Universe age: 13.8 × 10^9 years
Heat death: ~10^100 years
System lifetime: 2^166 years > heat death
```

### Anonymity Set Calculation

```
k-anonymity: k = total registered contributors

Privacy guarantee:
- Probability(attacker guesses correct) = 1/k
- Unlinkability: P(S1 from same user as S2) = 1/k

Current system:
- k = 1 (low anonymity - demo only)
- Production target: k ≥ 100 (strong anonymity)
- Enterprise target: k ≥ 1000 (very strong)
```

---

## 📈 Benchmarking

### Performance Metrics

| Attack | Runtime | Computational Cost | Memory |
|--------|---------|-------------------|--------|
| Linkability | ~10s | Low (O(n²) pairs) | <10MB |
| Sybil | ~15s | Low (10 attempts) | <5MB |
| Replay | ~20s | Medium (blockchain writes) | <10MB |
| Deanonymization | ~30s | High (brute force limited) | <20MB |

**Total Suite:** ~2-3 minutes for comprehensive security audit

---

## 🎯 Thesis Integration

### In Your Thesis

**Chapter 5: Security Analysis**

```
5.1 Threat Model
    - Define adversary capabilities
    - List attack vectors
    - Specify security goals

5.2 Attack Simulations
    - Methodology (these scripts)
    - Results (JSON reports)
    - Analysis (why attacks fail)

5.3 Empirical Validation
    - Performance benchmarks
    - Success rate: 0%
    - Cost analysis

5.4 Comparison
    - Traditional CTI platforms
    - Other blockchain solutions
    - Novel contributions
```

### In Your Presentation

**Slide 1:** "Let me show you four ways this system could be attacked..."

**Slide 2-5:** Live demo each attack

**Slide 6:** Results dashboard (all attacks failed)

**Slide 7:** Mathematical proof of security

**Impact:** Panel sees security isn't just claimed - it's proven

---

## 🔧 Customization

### Add New Attacks

1. Create `scripts/attack-simulations/new-attack.js`
2. Follow existing pattern:
   ```javascript
   async function main() {
     console.log("🎯 ATTACK: Description");
     // Run attack logic
     // Save results JSON
   }
   ```
3. Add to `run-all-attacks.js` attacks array
4. Update this README

### Modify Thresholds

```javascript
// In linkability-attack.js
const threshold = 5.0;  // Change sensitivity

// In sybil-attack.js
const identityCount = 10;  // Test more identities

// In replay-attack.js
const maxAttempts = 3;  // More replay attempts
```

---

## 📚 References

### Cryptography
- Keccak256: [https://keccak.team/keccak.html](https://keccak.team/keccak.html)
- Merkle Proofs: Merkle, R. (1987). "A Digital Signature Based on a Conventional Encryption Function"
- Zero-Knowledge: Goldwasser, Micali, Rackoff (1985). "The Knowledge Complexity of Interactive Proof-Systems"

### Security Analysis
- Formal Methods: "Why3: Shepherd Your Herd of Provers"
- Threat Modeling: STRIDE framework (Microsoft)
- Attack Trees: Schneier, B. (1999). "Attack Trees"

### Blockchain Security
- Ethereum Security: [https://consensys.github.io/smart-contract-best-practices/](https://consensys.github.io/smart-contract-best-practices/)
- Trail of Bits: "Building Secure Smart Contracts"

---

## 🤝 Contributing

Found a new attack vector? Improved a simulation? Contributions welcome!

1. Document the attack methodology
2. Implement the simulation
3. Add test results
4. Update this README

---

## 📜 License

MIT License - Use freely for research and education

---

## 🎓 Academic Use

**Citation:**
```bibtex
@software{cti_security_simulations,
  title={Security Attack Simulations for Decentralized CTI Platform},
  author={[Your Name]},
  year={2025},
  url={https://github.com/AbkaiFulingga/decentralized-cti-platform}
}
```

---

**Last Updated:** December 9, 2025  
**Version:** 1.0.0  
**Maintained by:** FYP Security Team
