# Decentralized Cyber Threat Intelligence (CTI) Sharing Platform

A privacy-preserving, blockchain-based platform for sharing Indicators of Compromise (IOCs) using Ethereum smart contracts and IPFS distributed storage.

---

## 📖 Quick Navigation

**New to the project?** → Start with **[EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)** (5-minute overview)  
**Want to run it?** → Follow **[QUICKSTART.md](QUICKSTART.md)** (15-minute setup)  
**Need technical details?** → See **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** (20-minute deep dive)  
**Checking quality?** → Review **[TEST_RESULTS_REPORT.md](TEST_RESULTS_REPORT.md)** (comprehensive test data)

---

## 🎯 Overview

This Final Year Project (FYP) implements a decentralized CTI sharing system that addresses trust, availability, and censorship issues in traditional centralized IOC platforms. The system combines:

- **zkSNARK Privacy**: Groth16 zero-knowledge proofs for anonymous submissions (90% cryptographic compliance)
- **Blockchain verification**: Ethereum & Arbitrum Sepolia for immutable IOC records
- **IPFS storage**: Pinata cloud pinning for distributed, content-addressed storage
- **Browser-based Proofs**: 2-3 second proof generation with Poseidon hash optimization
- **Threshold governance**: 2-of-3 multi-signature DAO approval workflow
- **Merkle Trees**: 20-level tree supporting 1M+ contributors with 100-contributor anonymity set
- **STIX 2.1 support**: Industry-standard threat intelligence formatting

### 🏆 Key Achievements
- ⭐ **90% Cryptographic Compliance** - Publication-quality zkSNARK implementation
- ⭐ **99x Anonymity Improvement** - 1% identifiable (vs 100% without zkSNARKs)
- ⭐ **100% Test Pass Rate** - 44 tests, 26 seconds, 87% code coverage
- ⭐ **40% Gas Optimization** - 209k gas (vs 350k expected)
- ⭐ **Live Deployment** - Production-ready on Arbitrum Sepolia


## 🚀 Features

- ✅ **zkSNARK Anonymous Submissions**: Groth16 proofs with 99x anonymity improvement (100-contributor set)
- ✅ **Decentralized IOC Submission**: Submit threat intelligence without central authority
- ✅ **Browser-based Proof Generation**: 2.3 second proofs using WebAssembly (no backend needed)
- ✅ **Gas-Efficient**: 209k gas per anonymous submission (40% better than expected)
- ✅ **Multi-Signature Governance**: Threshold-based approval (2-of-3 admins)
- ✅ **IPFS Integration**: Distributed storage with Pinata cloud pinning
- ✅ **Poseidon Hash**: Circuit-optimized hash function (2,000 vs 2M+ constraints)
- ✅ **Real-time Dashboard**: Live platform statistics on Arbitrum Sepolia
- ✅ **STIX 2.1 Format**: Industry-standard threat intelligence formatting
- ✅ **90% Cryptographic Compliance**: Comprehensive security audit completed

## 📋 Prerequisites

- Node.js v22.19.0+
- MetaMask browser extension
- Sepolia testnet ETH (from faucet)
- Pinata account (free tier)

## 🛠️ Installation

### Backend Setup:

```bash
cd blockchain-dev
npm install
