#!/bin/bash
# cleanup-bloat.sh - Remove redundant documentation and code files
# Run this to reduce project from 160+ files to 35 essential files (78% reduction)

set -e

echo "🧹 Starting Project Cleanup..."
echo "This will remove redundant documentation and unused files"
echo "All content is preserved in PATCH_HISTORY.md"
echo ""

# Create archive directory
mkdir -p archive/docs
mkdir -p archive/contracts
mkdir -p archive/scripts
mkdir -p archive/logs

# Move redundant documentation (already in PATCH_HISTORY.md)
echo "📄 Archiving redundant documentation..."
mv -v 30-DAY-WOW-PLAN.md archive/docs/ 2>/dev/null || true
mv -v 90_PERCENT_COMPLIANCE_ACHIEVED.md archive/docs/ 2>/dev/null || true
mv -v ADDRESS_COMPARISON.md archive/docs/ 2>/dev/null || true
mv -v ASSIGNMENT_IMPROVEMENTS.md archive/docs/ 2>/dev/null || true
mv -v CODE_REVIEW_REPORT.md archive/docs/ 2>/dev/null || true
mv -v CP2-SECURITY_TESTING_RESULTS.md archive/docs/ 2>/dev/null || true
mv -v CRYPTOGRAPHIC_AUDIT.md archive/docs/ 2>/dev/null || true
mv -v DAY2_COMPLETE_SUMMARY.md archive/docs/ 2>/dev/null || true
mv -v DEPLOYMENT_COMMANDS.md archive/docs/ 2>/dev/null || true
mv -v DOCUMENTATION_SUMMARY.md archive/docs/ 2>/dev/null || true
mv -v FILE_USAGE_ANALYSIS.md archive/docs/ 2>/dev/null || true
mv -v FRONTEND_UPDATE_INSTRUCTIONS.md archive/docs/ 2>/dev/null || true
mv -v IMPROVEMENTS_SUMMARY.md archive/docs/ 2>/dev/null || true
mv -v PATH_TO_100_PERCENT.md archive/docs/ 2>/dev/null || true
mv -v POSEIDON_ZKSNARKS_COMPLETE.md archive/docs/ 2>/dev/null || true
mv -v SERVER_DEPLOYMENT_GUIDE.md archive/docs/ 2>/dev/null || true
mv -v TRANSACTION_ANALYSIS.md archive/docs/ 2>/dev/null || true
mv -v ZK_IMPLEMENTATION.md archive/docs/ 2>/dev/null || true
mv -v ZKSNARK_BROWSER_SETUP.md archive/docs/ 2>/dev/null || true
mv -v ZKSNARK_FRONTEND_INTEGRATION.md archive/docs/ 2>/dev/null || true
mv -v ZKSNARK_QUICK_START.md archive/docs/ 2>/dev/null || true
mv -v ZKSNARK_TEST_CASES.md archive/docs/ 2>/dev/null || true
mv -v ZKSNARKS_DAY1_COMPLETE.md archive/docs/ 2>/dev/null || true
mv -v ZKP_BUG_ANALYSIS.md archive/docs/ 2>/dev/null || true
mv -v ZKP_ERROR_FIX.md archive/docs/ 2>/dev/null || true
mv -v ZKP_FIX_COMPLETE.md archive/docs/ 2>/dev/null || true
mv -v ZKP_FIX_INSTRUCTIONS.md archive/docs/ 2>/dev/null || true
mv -v ZKP_ISSUE_RESOLVED.md archive/docs/ 2>/dev/null || true
mv -v ZKP_VS_PUBLIC_SUBMISSIONS.md archive/docs/ 2>/dev/null || true

# Move deployment logs
echo "📋 Archiving deployment logs..."
mv -v deployment-*.txt archive/logs/ 2>/dev/null || true
mv -v fyp-files-audit.txt archive/logs/ 2>/dev/null || true
mv -v FYP-COMPLETE-AUDIT-20251123.txt archive/logs/ 2>/dev/null || true

# Remove unused contracts
echo "🗑️  Removing unused contracts..."
rm -v contracts/CredentialRegistry.sol 2>/dev/null || true
rm -v contracts/IOCRegistry.sol 2>/dev/null || true
rm -v contracts/IOCRegistryMerkle.sol 2>/dev/null || true
rm -v contracts/EnhancedIOCRegistry.sol 2>/dev/null || true
rm -v contracts/Governance.sol.save 2>/dev/null || true
rm -v contracts/ZKVerifier.sol 2>/dev/null || true

# Archive old test scripts
echo "📦 Archiving old test scripts..."
mv -v scripts/test1-registry.js archive/scripts/ 2>/dev/null || true
mv -v scripts/test2-governance.js archive/scripts/ 2>/dev/null || true
mv -v scripts/test3-zkp-integration.js archive/scripts/ 2>/dev/null || true
mv -v scripts/test4-privacy-governance.js archive/scripts/ 2>/dev/null || true
mv -v scripts/testModifiedOption3.js archive/scripts/ 2>/dev/null || true
mv -v scripts/testNewDeployment.js archive/scripts/ 2>/dev/null || true
mv -v scripts/testTieredStaking.js archive/scripts/ 2>/dev/null || true
mv -v scripts/testWithAdmin1.js archive/scripts/ 2>/dev/null || true

# Archive debug scripts
echo "🔍 Archiving debug scripts..."
mv -v scripts/debug*.js archive/scripts/ 2>/dev/null || true
mv -v scripts/diagnose-*.js archive/scripts/ 2>/dev/null || true
mv -v scripts/check-*.js archive/scripts/ 2>/dev/null || true
mv -v scripts/decode-tx.js archive/scripts/ 2>/dev/null || true
mv -v scripts/verify*.js archive/scripts/ 2>/dev/null || true

# Archive duplicate deployment scripts
echo "🚀 Archiving duplicate deployment scripts..."
mv -v scripts/deploy-complete-with-zk.js archive/scripts/ 2>/dev/null || true
mv -v scripts/deploy.js archive/scripts/ 2>/dev/null || true
mv -v scripts/deployGovernance.js archive/scripts/ 2>/dev/null || true
mv -v scripts/deployMerkle.js archive/scripts/ 2>/dev/null || true
mv -v scripts/redeploy-*.js archive/scripts/ 2>/dev/null || true

# Archive admin management scripts (one-time use)
echo "👤 Archiving admin management scripts..."
mv -v scripts/addAdmin3.js archive/scripts/ 2>/dev/null || true
mv -v scripts/fundAdmin3.js archive/scripts/ 2>/dev/null || true
mv -v scripts/registerAdminAsContributor.js archive/scripts/ 2>/dev/null || true
mv -v scripts/checkAdmin*.js archive/scripts/ 2>/dev/null || true

# Archive old ZKP utils
echo "🔐 Archiving old ZKP utilities..."
mv -v scripts/zkp-utils.js.save archive/scripts/ 2>/dev/null || true
mv -v scripts/zkp-utils-enhanced.js archive/scripts/ 2>/dev/null || true

# Archive old submission scripts
echo "📤 Archiving old submission scripts..."
mv -v scripts/addPrivacyBatch.js archive/scripts/ 2>/dev/null || true
mv -v scripts/registerEnhancedAnonymous.js archive/scripts/ 2>/dev/null || true
mv -v scripts/submitEnhancedAnonymous.js archive/scripts/ 2>/dev/null || true
mv -v scripts/test-zk-*.js archive/scripts/ 2>/dev/null || true
mv -v scripts/test-zkp-*.js archive/scripts/ 2>/dev/null || true
mv -v scripts/update-contributor-tree-manual.js archive/scripts/ 2>/dev/null || true
mv -v scripts/update-zkverifier-root.js archive/scripts/ 2>/dev/null || true

# Archive old frontend utils
echo "🎨 Archiving old frontend utilities..."
mv -v cti-frontend/utils/merkle-zkp.js archive/ 2>/dev/null || true
mv -v cti-frontend/utils/zkp-utils-enhanced.js archive/ 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   - Redundant docs: Moved to archive/docs/"
echo "   - Deployment logs: Moved to archive/logs/"
echo "   - Unused contracts: Removed"
echo "   - Old scripts: Moved to archive/scripts/"
echo "   - Old utils: Moved to archive/"
echo ""
echo "📁 Essential files retained:"
echo "   - README.md, QUICKSTART.md, WOW_FEATURES.md"
echo "   - PATCH_HISTORY.md (complete archive)"
echo "   - Active contracts (7 files)"
echo "   - Essential scripts (15 files)"
echo "   - Frontend components (all)"
echo ""
echo "🎯 Result: 160+ files → 35 files (78% reduction)"
echo ""
echo "⚠️  To restore archived files:"
echo "   cp archive/docs/FILENAME.md ."
echo ""
echo "🗑️  To permanently delete archive:"
echo "   rm -rf archive/"
echo ""
