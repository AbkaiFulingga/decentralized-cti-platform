#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "📁 FYP PROJECT FILE STRUCTURE"
echo "════════════════════════════════════════════════════════"
echo ""

echo "🏠 PROJECT ROOT: ~/blockchain-dev/"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📜 SMART CONTRACTS (contracts/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh contracts/*.sol 2>/dev/null | awk '{printf "%-50s %10s   %s %s %s\n", $9, $5, $6, $7, $8}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  DEPLOYMENT SCRIPTS (scripts/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh scripts/*.js 2>/dev/null | awk '{printf "%-50s %10s   %s %s %s\n", $9, $5, $6, $7, $8}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 FRONTEND - APP PAGES (cti-frontend/app/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find cti-frontend/app -name "*.js" -o -name "*.jsx" 2>/dev/null | while read file; do
  size=$(ls -lh "$file" | awk '{print $5}')
  printf "%-50s %10s\n" "$file" "$size"
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧩 FRONTEND - COMPONENTS (cti-frontend/components/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find cti-frontend/components -name "*.js" -o -name "*.jsx" 2>/dev/null | while read file; do
  size=$(ls -lh "$file" | awk '{print $5}')
  printf "%-50s %10s\n" "$file" "$size"
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 FRONTEND - UTILS (cti-frontend/utils/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh cti-frontend/utils/*.js 2>/dev/null | awk '{printf "%-50s %10s   %s %s %s\n", $9, $5, $6, $7, $8}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 FRONTEND - API ROUTES (cti-frontend/app/api/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find cti-frontend/app/api -name "*.js" 2>/dev/null | while read file; do
  size=$(ls -lh "$file" | awk '{print $5}')
  printf "%-50s %10s\n" "$file" "$size"
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  CONFIGURATION FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh hardhat.config.js .env package.json 2>/dev/null | awk '{printf "%-50s %10s   %s %s %s\n", $9, $5, $6, $7, $8}'
ls -lh cti-frontend/package.json cti-frontend/next.config.js cti-frontend/tailwind.config.js 2>/dev/null | awk '{printf "%-50s %10s   %s %s %s\n", $9, $5, $6, $7, $8}'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FILE COUNT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Smart Contracts:    $(ls contracts/*.sol 2>/dev/null | wc -l) files"
echo "Deployment Scripts: $(ls scripts/*.js 2>/dev/null | wc -l) files"
echo "Frontend Pages:     $(find cti-frontend/app -name "*.js" -o -name "*.jsx" 2>/dev/null | wc -l) files"
echo "Components:         $(find cti-frontend/components -name "*.js" -o -name "*.jsx" 2>/dev/null | wc -l) files"
echo "Utils:              $(ls cti-frontend/utils/*.js 2>/dev/null | wc -l) files"
echo "API Routes:         $(find cti-frontend/app/api -name "*.js" 2>/dev/null | wc -l) files"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 DEPLOYED CONTRACTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 ETHEREUM SEPOLIA (L1):"
echo "   Registry:    0xB490aBfFf0639453a8A5e5e52BF4E8055269cfE4"
echo "   Governance:  0x1D9c49C737fE587bdBCE7a2a3e04293004216e18"
echo "   Storage:     0x174d2a6FF20Bb0928B9e39BE8F65d823db73c983"
echo ""
echo "⚡ ARBITRUM SEPOLIA (L2):"
echo "   Registry:    0x892AD6E47dbD86aD7855f7eEAe0F4fCa6223C36A"
echo "   Governance:  0xeB09652Ed1a543C5Ec36873C83cAFC3356AAca52"
echo "   Storage:     0x177fD44E879a162f3b642b313F253D97bD73a301"
echo "   MerkleZK:    0x74A2C817dcB3554CD78cF3EEb513Df97751e01d1"
echo "   OracleFeed:  0xbdFcBE759232c9435FB4AdfF937A6173B5b904bE"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 KEY FEATURES IMPLEMENTED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Multi-tier staking (0.01, 0.05, 0.1 ETH)"
echo "✅ Dual-network deployment (L1 Ethereum + L2 Arbitrum)"
echo "✅ Zero-knowledge proof anonymous submissions (Merkle tree)"
echo "✅ IPFS decentralized storage integration"
echo "✅ 3/3 multi-sig governance (trustless approval)"
echo "✅ Reputation scoring system (on-chain)"
echo "✅ Merkle tree verification for IOCs"
echo "✅ Dynamic gas fee calculation"
echo "✅ MetaMask wallet integration"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 CODE STATISTICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Solidity Lines:  $(find contracts -name "*.sol" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')"
echo "Total JavaScript Lines: $(find cti-frontend -name "*.js" -o -name "*.jsx" | grep -v node_modules | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')"
echo "Total Project Lines:    $(find . -name "*.sol" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')"
echo ""

echo "════════════════════════════════════════════════════════"
echo "✅ FYP FILE AUDIT COMPLETE"
echo "════════════════════════════════════════════════════════"
