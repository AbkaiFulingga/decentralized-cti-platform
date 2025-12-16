#!/bin/bash

# zkSNARK Test Data Generator
# Generates various test IOCs for comprehensive testing

echo "🧪 zkSNARK Test Data Generator"
echo "================================"
echo ""

# Test Case 2a: 10 IOCs
echo "📋 Test Case 2a: 10 IOCs (Small Batch)"
echo "Copy-paste these into the submission form:"
echo "---"
for i in {1..10}; do
  echo "192.168.1.$i"
done
echo ""
echo ""

# Test Case 2b: 50 IOCs
echo "📋 Test Case 2b: 50 IOCs (Medium Batch)"
echo "---"
for i in {1..50}; do
  echo "10.0.0.$i"
done
echo ""
echo ""

# Test Case 2c: 100 IOCs
echo "📋 Test Case 2c: 100 IOCs (Large Batch)"
echo "Run this in browser console to generate:"
echo "---"
cat << 'EOF'
Array.from({length: 100}, (_, i) => `172.16.0.${i + 1}`).join('\n')
EOF
echo ""
echo ""

# Test Case: Mixed IOC Types
echo "📋 Test Case: Mixed IOC Types"
echo "---"
echo "# Malicious IPs"
echo "192.168.1.100"
echo "10.0.0.50"
echo "172.16.0.200"
echo ""
echo "# Malicious Domains"
echo "malicious-site.com"
echo "phishing-example.net"
echo "trojan-download.org"
echo ""
echo "# File Hashes (MD5)"
echo "5d41402abc4b2a76b9719d911017c592"
echo "098f6bcd4621d373cade4e832627b4f6"
echo "e4d909c290d0fb1ca068ffaddf22cbd0"
echo ""
echo "# File Hashes (SHA256)"
echo "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
echo "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"
echo ""
echo ""

# Test Case: Real-world IOCs (for demo)
echo "📋 Test Case: Real-world Style IOCs (Demo)"
echo "---"
echo "# APT28 Campaign Indicators (Fictional)"
echo "185.220.101.32"
echo "45.142.214.48"
echo "apt28-c2.malicious.net"
echo "backdoor-update.suspicious.com"
echo "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
echo ""
echo ""

# Performance Test Data
echo "📋 Performance Test: Sequential Submissions"
echo "Submit these 3 batches one after another:"
echo "---"
echo "Batch 1:"
echo "192.168.10.1"
echo "192.168.10.2"
echo "192.168.10.3"
echo ""
echo "Batch 2:"
echo "192.168.20.1"
echo "192.168.20.2"
echo "192.168.20.3"
echo ""
echo "Batch 3:"
echo "192.168.30.1"
echo "192.168.30.2"
echo "192.168.30.3"
echo ""
echo ""

# Browser Console Commands
echo "🖥️  Browser Console Commands"
echo "================================"
echo ""

echo "1. Generate 100 IPs:"
echo "---"
cat << 'EOF'
const ips = Array.from({length: 100}, (_, i) => `192.168.${Math.floor(i/255)}.${i%255 + 1}`);
console.log(ips.join('\n'));
EOF
echo ""
echo ""

echo "2. Measure Proof Generation Time:"
echo "---"
cat << 'EOF'
const startTime = Date.now();
// [Submit IOCs here]
// After proof completes, run:
console.log(`Proof generation: ${Date.now() - startTime}ms`);
EOF
echo ""
echo ""

echo "3. Check Tree Data:"
echo "---"
cat << 'EOF'
fetch('http://192.168.1.11:3000/contributor-merkle-tree.json')
  .then(r => r.json())
  .then(data => {
    console.log('Root:', data.root);
    console.log('Contributors:', data.contributorCount);
    console.log('Hash Function:', data.hashFunction);
  });
EOF
echo ""
echo ""

# Gas Cost Comparison Template
echo "📊 Gas Cost Comparison Template"
echo "================================"
echo ""
cat << 'EOF'
| Test | Mode | IOCs | Gas Used | ETH Cost (0.1 gwei) | Time |
|------|------|------|----------|---------------------|------|
| 1 | Public | 5 | ? | ? | ? |
| 2 | Anonymous | 5 | ? | ? | ? |
| 3 | Public | 10 | ? | ? | ? |
| 4 | Anonymous | 10 | ? | ? | ? |
| 5 | Public | 50 | ? | ? | ? |
| 6 | Anonymous | 50 | ? | ? | ? |

Privacy Premium: X% more gas for zkSNARK proofs
EOF
echo ""
echo ""

# Quick Test Commands
echo "🚀 Quick Test Commands"
echo "================================"
echo ""

echo "Check frontend:"
echo "curl http://192.168.1.11:3000"
echo ""

echo "Check tree file:"
echo "curl http://192.168.1.11:3000/contributor-merkle-tree.json | jq '.contributorCount, .hashFunction'"
echo ""

echo "Check contract root:"
echo "ssh sc@192.168.1.11 'cd blockchain-dev && npx hardhat run scripts/check-merkle-root.js --network arbitrumSepolia'"
echo ""

echo "Restart frontend:"
echo "ssh sc@192.168.1.11 'cd blockchain-dev/cti-frontend && pm2 restart dev-server'"
echo ""

echo ""
echo "✅ Test data generated!"
echo "📖 See ZKSNARK_TEST_CASES.md for full test suite"
echo ""
