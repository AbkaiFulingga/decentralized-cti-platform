# Decentralized Cyber Threat Intelligence (CTI) Sharing Platform

A privacy-preserving, blockchain-based platform for sharing Indicators of Compromise (IOCs) using Ethereum smart contracts and IPFS distributed storage.

## 🎯 Overview

This Final Year Project (FYP) implements a decentralized CTI sharing system that addresses trust, availability, and censorship issues in traditional centralized IOC platforms. The system combines:

- **Blockchain verification**: Ethereum Sepolia testnet for immutable IOC records
- **IPFS storage**: Pinata cloud pinning for distributed, content-addressed storage
- **Privacy preservation**: 256-bit cryptographic commitments for anonymous submissions
- **Threshold governance**: 2-of-3 multi-signature DAO approval workflow
- **Merkle proofs**: Cryptographic validation of individual IOCs
- **STIX 2.1 support**: Industry-standard threat intelligence formatting


## 🚀 Features

- ✅ **Decentralized IOC Submission**: Submit threat intelligence without central authority
- ✅ **Privacy Modes**: Public (identity visible) or Anonymous (256-bit ZKP-like protection)
- ✅ **Merkle Tree Proofs**: Cryptographic verification of individual IOCs
- ✅ **Multi-Signature Governance**: Threshold-based approval (2-of-3 admins)
- ✅ **IPFS Integration**: Distributed storage with Pinata cloud pinning
- ✅ **Staking Mechanism**: 0.05 ETH stake for contributor registration
- ✅ **Real-time Dashboard**: Live platform statistics on Sepolia testnet
- ✅ **STIX 2.1 Format**: Industry-standard threat intelligence formatting

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
