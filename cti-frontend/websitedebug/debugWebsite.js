// cti-frontend/scripts/debugWebsite.js
const fs = require('fs');
const path = require('path');

console.log("=== CTI Platform Frontend Debugging Report ===\n");

// 1. Check if constants.js has correct contract addresses
console.log("1. Checking utils/constants.js...");
const constantsPath = path.join(__dirname, '../utils/constants.js');

if (fs.existsSync(constantsPath)) {
  const constantsContent = fs.readFileSync(constantsPath, 'utf8');
  
  // Check for new Arbitrum addresses (Nov 1 deployment)
  const hasNewArbitrumRegistry = constantsContent.includes('0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E');
  const hasNewSepoliaRegistry = constantsContent.includes('0x5a24Df56a154f4c409F52e7d3CE74d004E6F9472');
  
  // Check for old October 12 addresses
  const hasOldRegistry = constantsContent.includes('0xD63e502605B0B48626bF979c66B68026a35DbA36');
  
  console.log(`  ✅ File exists`);
  console.log(`  ${hasNewSepoliaRegistry ? '✅' : '❌'} Sepolia registry: 0x5a24Df56a154f4c409F52e7d3CE74d004E6F9472`);
  console.log(`  ${hasNewArbitrumRegistry ? '✅' : '❌'} Arbitrum registry: 0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E`);
  
  if (hasOldRegistry) {
    console.log(`  ⚠️  WARNING: Found old October 12 address (0xD63e...)`);
    console.log(`     This will cause "could not decode result data" errors`);
  }
} else {
  console.log(`  ❌ File missing! Create utils/constants.js`);
}

// 2. Check IOCSubmissionForm.jsx for common issues
console.log("\n2. Checking components/IOCSubmissionForm.jsx...");
const submissionFormPath = path.join(__dirname, '../components/IOCSubmissionForm.jsx');

if (fs.existsSync(submissionFormPath)) {
  const formContent = fs.readFileSync(submissionFormPath, 'utf8');
  
  // Check if using NETWORKS constant (correct) or hardcoded address (wrong)
  const usesNetworksConstant = formContent.includes('NETWORKS.sepolia.contracts.registry') ||
                                formContent.includes('NETWORKS.arbitrumSepolia.contracts.registry');
  const hasHardcodedAddress = formContent.match(/registryAddress = ["']0x[a-fA-F0-9]{40}["']/);
  
  // Check for account change listener
  const hasAccountListener = formContent.includes('accountsChanged');
  const hasChainListener = formContent.includes('chainChanged');
  
  // Check for network switcher buttons
  const hasNetworkSwitcher = formContent.includes('switchNetwork');
  
  // Check for gasLimit parameter
  const hasGasLimit = formContent.includes('gasLimit: 350000');
  
  // Check for submission fee
  const hasSubmissionFee = formContent.includes('submissionFee');
  
  // Check for correct contributor field index
  const checkingWrongField = formContent.includes('contributor[4]') && formContent.includes('isRegistered');
  const checkingCorrectField = formContent.includes('contributor[5]') && formContent.includes('isRegistered');
  
  console.log(`  ✅ File exists`);
  console.log(`  ${usesNetworksConstant ? '✅' : '❌'} Uses NETWORKS constant (multi-network support)`);
  console.log(`  ${hasHardcodedAddress ? '⚠️' : '✅'} ${hasHardcodedAddress ? 'Has hardcoded address (should use NETWORKS)' : 'No hardcoded addresses'}`);
  console.log(`  ${hasAccountListener ? '✅' : '❌'} Has account change listener`);
  console.log(`  ${hasChainListener ? '✅' : '❌'} Has network change listener`);
  console.log(`  ${hasNetworkSwitcher ? '✅' : '❌'} Has network switcher UI`);
  console.log(`  ${hasGasLimit ? '✅' : '❌'} Has gasLimit: 350000 for addBatch()`);
  console.log(`  ${hasSubmissionFee ? '✅' : '❌'} Calculates 1% submission fee`);
  console.log(`  ${checkingCorrectField ? '✅' : checkingWrongField ? '❌' : '⚠️'} Checks contributor[5] for isActive`);
  
} else {
  console.log(`  ❌ File missing!`);
}

// 3. Check TransactionHistory.jsx
console.log("\n3. Checking components/TransactionHistory.jsx...");
const historyPath = path.join(__dirname, '../components/TransactionHistory.jsx');

if (fs.existsSync(historyPath)) {
  const historyContent = fs.readFileSync(historyPath, 'utf8');
  
  const usesNetworksConstant = historyContent.includes('NETWORKS.sepolia') ||
                                historyContent.includes('NETWORKS.arbitrumSepolia');
  const hasHardcodedAddress = historyContent.match(/registryAddress = ["']0x[a-fA-F0-9]{40}["']/);
  const hasAccountListener = historyContent.includes('accountsChanged');
  const checkingCorrectField = historyContent.includes('contributor[5]');
  const checkingWrongField = historyContent.includes('contributor[4]') && !historyContent.includes('tier');
  
  console.log(`  ✅ File exists`);
  console.log(`  ${usesNetworksConstant ? '✅' : '❌'} Uses NETWORKS constant`);
  console.log(`  ${hasHardcodedAddress ? '⚠️' : '✅'} ${hasHardcodedAddress ? 'Has hardcoded address' : 'No hardcoded addresses'}`);
  console.log(`  ${hasAccountListener ? '✅' : '❌'} Has account change listener`);
  console.log(`  ${checkingCorrectField ? '✅' : checkingWrongField ? '❌' : '⚠️'} Checks contributor[5] for isActive`);
  
} else {
  console.log(`  ❌ File missing!`);
}

// 4. Check PlatformDashboard.jsx
console.log("\n4. Checking components/PlatformDashboard.jsx...");
const dashboardPath = path.join(__dirname, '../components/PlatformDashboard.jsx');

if (fs.existsSync(dashboardPath)) {
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  
  const usesNetworksConstant = dashboardContent.includes('NETWORKS');
  const hasHeatmap = dashboardContent.includes('heatmap') || dashboardContent.includes('chart');
  const hasNetworkDetection = dashboardContent.includes('chainId');
  
  console.log(`  ✅ File exists`);
  console.log(`  ${usesNetworksConstant ? '✅' : '⚠️'} Uses NETWORKS constant`);
  console.log(`  ${hasHeatmap ? '✅' : '⚠️'} Has heatmap/chart visualization`);
  console.log(`  ${hasNetworkDetection ? '✅' : '❌'} Has network detection`);
  
} else {
  console.log(`  ❌ File missing!`);
}

// 5. Check backend deployment files
console.log("\n5. Checking backend deployment files...");
const backendPath = path.join(__dirname, '../../test-addresses.json');
const arbitrumPath = path.join(__dirname, '../../test-addresses-arbitrum.json');

if (fs.existsSync(backendPath)) {
  const sepoliaData = JSON.parse(fs.readFileSync(backendPath));
  console.log(`  ✅ test-addresses.json exists`);
  console.log(`     Registry: ${sepoliaData.PrivacyPreservingRegistry}`);
  console.log(`     Governance: ${sepoliaData.ThresholdGovernance}`);
} else {
  console.log(`  ❌ test-addresses.json missing!`);
}

if (fs.existsSync(arbitrumPath)) {
  const arbitrumData = JSON.parse(fs.readFileSync(arbitrumPath));
  console.log(`  ✅ test-addresses-arbitrum.json exists`);
  console.log(`     Registry: ${arbitrumData.PrivacyPreservingRegistry}`);
  console.log(`     Governance: ${arbitrumData.ThresholdGovernance}`);
} else {
  console.log(`  ⚠️  test-addresses-arbitrum.json missing (L2 not deployed yet)`);
}

// 6. Check for .env.local (Pinata JWT)
console.log("\n6. Checking environment configuration...");
const envPath = path.join(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasPinataJWT = envContent.includes('NEXT_PUBLIC_PINATA_JWT');
  
  console.log(`  ✅ .env.local exists`);
  console.log(`  ${hasPinataJWT ? '✅' : '❌'} Has NEXT_PUBLIC_PINATA_JWT`);
} else {
  console.log(`  ❌ .env.local missing! IPFS uploads will fail`);
  console.log(`     Copy .env.local.example to .env.local and add your Pinata JWT`);
}

// 7. Summary and recommendations
console.log("\n=== SUMMARY ===\n");

const issues = [];

if (!fs.existsSync(constantsPath)) {
  issues.push("❌ CRITICAL: utils/constants.js missing");
}

if (!fs.existsSync(envPath)) {
  issues.push("❌ CRITICAL: .env.local missing (IPFS uploads won't work)");
}

const constantsContent = fs.existsSync(constantsPath) ? fs.readFileSync(constantsPath, 'utf8') : '';
if (constantsContent.includes('0xD63e502605B0B48626bF979c66B68026a35DbA36')) {
  issues.push("❌ CRITICAL: constants.js using old October 12 addresses");
}

const formContent = fs.existsSync(submissionFormPath) ? fs.readFileSync(submissionFormPath, 'utf8') : '';
if (!formContent.includes('accountsChanged')) {
  issues.push("⚠️  IOCSubmissionForm missing account change listener");
}

if (!formContent.includes('gasLimit: 350000')) {
  issues.push("⚠️  IOCSubmissionForm missing gasLimit (transactions may fail)");
}

const historyContent = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '';
if (historyContent.includes('contributor[4]') && !historyContent.includes('tier')) {
  issues.push("❌ CRITICAL: TransactionHistory checking wrong field index");
}

if (issues.length === 0) {
  console.log("✅ No critical issues found!");
  console.log("\nYour frontend should be working correctly.");
  console.log("\nIf you're still experiencing issues:");
  console.log("  1. Clear Next.js cache: rm -rf .next");
  console.log("  2. Restart dev server: npm run dev");
  console.log("  3. Hard refresh browser: Ctrl+Shift+R");
} else {
  console.log("❌ Found issues:\n");
  issues.forEach(issue => console.log(`   ${issue}`));
  
  console.log("\n🔧 RECOMMENDED FIXES:\n");
  
  if (constantsContent.includes('0xD63e502605B0B48626bF979c66B68026a35DbA36')) {
    console.log("1. Update utils/constants.js with latest deployment addresses:");
    console.log("   Sepolia registry: 0x5a24Df56a154f4c409F52e7d3CE74d004E6F9472");
    console.log("   Arbitrum registry: 0x2Ae7d8E4801a95D1243d1BD7131046F778Af5f6E");
  }
  
  if (!formContent.includes('accountsChanged')) {
    console.log("\n2. Add account change listener to IOCSubmissionForm.jsx:");
    console.log("   window.ethereum.on('accountsChanged', handleAccountsChanged);");
  }
  
  if (historyContent.includes('contributor[4]') && !historyContent.includes('tier')) {
    console.log("\n3. Fix TransactionHistory.jsx line 101:");
    console.log("   Change: contributor[4]");
    console.log("   To: contributor[5]");
  }
  
  if (!fs.existsSync(envPath)) {
    console.log("\n4. Create .env.local file:");
    console.log("   cp .env.local.example .env.local");
    console.log("   nano .env.local");
    console.log("   Add your NEXT_PUBLIC_PINATA_JWT");
  }
}

console.log("\n=== END OF REPORT ===");
