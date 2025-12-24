#!/bin/bash
# Deploy all updated components with Infura helpers integration

cd /Users/user/decentralized-cti-platform-3

echo "🔧 Updating all components to use infura-helpers..."

# List of components to update
COMPONENTS=(
  "AnalyticsDashboard.jsx"
  "EnhancedIOCSearch.jsx"
  "BatchBrowser.jsx"
  "TransactionHistory.jsx"
  "AdminGovernancePanel.jsx"
)

for component in "${COMPONENTS[@]}"; do
  echo "📝 Processing $component..."
  
  # Backup
  cp "cti-frontend/components/$component" "cti-frontend/components/${component}.pre-infura-fix"
  
done

echo "✅ Backups created"
echo ""
echo "Next: Update each component to:"
echo "1. Import smartQueryEvents from infura-helpers"
echo "2. Replace queryFilter calls with smartQueryEvents"
echo "3. Remove manual fallback code"
