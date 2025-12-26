/**
 * Debug Governance Transaction Revert Issue
 * 
 * This script diagnoses why governance approval transactions are reverting
 * by checking:
 * 1. Admin authorization status
 * 2. Batch existence and state
 * 3. Previous approval status
 * 4. Threshold configuration
 * 5. Contract function availability
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function debugGovernanceRevert() {
  console.log('🔍 Debugging Governance Transaction Revert Issue\n');
  
  // Load deployed addresses
  const addressesPath = path.join(__dirname, '..', 'test-addresses.json');
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ test-addresses.json not found!');
    return;
  }
  
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  console.log('📄 Loaded contract addresses:');
  console.log(`   Registry: ${addresses.registry}`);
  console.log(`   Governance: ${addresses.governance}\n`);
  
  // Get signers
  const [deployer, admin1, admin2, admin3] = await ethers.getSigners();
  
  // User's address from error logs
  const userAddress = '0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82';
  
  console.log('👤 Addresses:');
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Admin1: ${admin1.address}`);
  console.log(`   Admin2: ${admin2.address}`);
  console.log(`   Admin3: ${admin3.address}`);
  console.log(`   User from error: ${userAddress}\n`);
  
  // Connect to contracts
  const governance = await ethers.getContractAt('ThresholdGovernance', addresses.governance);
  const registry = await ethers.getContractAt('PrivacyPreservingRegistry', addresses.registry);
  
  console.log('=== GOVERNANCE CONTRACT STATE ===\n');
  
  // 1. Check threshold
  try {
    const threshold = await governance.threshold();
    const adminCount = await governance.adminCount();
    console.log(`✅ Threshold: ${threshold}`);
    console.log(`✅ Admin Count: ${adminCount}`);
    
    if (threshold > adminCount) {
      console.log(`⚠️  WARNING: Threshold (${threshold}) > Admin Count (${adminCount})!`);
    }
  } catch (error) {
    console.error('❌ Error getting threshold:', error.message);
  }
  
  // 2. Check admin status for all addresses
  console.log('\n=== ADMIN AUTHORIZATION ===\n');
  const checkAddresses = [deployer.address, admin1.address, admin2.address, admin3.address, userAddress];
  
  for (const addr of checkAddresses) {
    try {
      const isAdmin = await governance.isAdmin(addr);
      const emoji = isAdmin ? '✅' : '❌';
      const label = addr === userAddress ? '(User from error)' : 
                    addr === deployer.address ? '(Deployer)' :
                    addr === admin1.address ? '(Admin1)' :
                    addr === admin2.address ? '(Admin2)' :
                    addr === admin3.address ? '(Admin3)' : '';
      console.log(`${emoji} ${addr} ${label}: ${isAdmin ? 'IS ADMIN' : 'NOT ADMIN'}`);
    } catch (error) {
      console.error(`❌ Error checking ${addr}:`, error.message);
    }
  }
  
  // 3. Get batch count and check batches
  console.log('\n=== BATCH STATUS ===\n');
  try {
    const batchCount = await registry.getBatchCount();
    console.log(`✅ Total batches: ${batchCount}\n`);
    
    if (batchCount > 0) {
      // Check last 3 batches
      const checkCount = Math.min(3, Number(batchCount));
      console.log(`Checking last ${checkCount} batch(es):\n`);
      
      for (let i = Number(batchCount) - checkCount; i < Number(batchCount); i++) {
        console.log(`--- Batch ${i} ---`);
        
        try {
          const batch = await registry.batches(i);
          console.log(`   Submitter: ${batch.submitter}`);
          console.log(`   IPFS Hash: ${batch.ipfsHash}`);
          console.log(`   Status: ${batch.status === 0 ? 'Pending' : batch.status === 1 ? 'Accepted' : 'Rejected'}`);
          console.log(`   Timestamp: ${new Date(Number(batch.timestamp) * 1000).toISOString()}`);
          
          // Check approval status for each admin
          console.log(`   Approval status:`);
          for (const addr of [deployer.address, admin1.address, admin2.address, admin3.address]) {
            try {
              const hasApproved = await governance.hasAdminApproved(i, addr);
              const isAdmin = await governance.isAdmin(addr);
              if (isAdmin) {
                const emoji = hasApproved ? '✅' : '⏳';
                console.log(`      ${emoji} ${addr.slice(0, 10)}...: ${hasApproved ? 'APPROVED' : 'Not approved'}`);
              }
            } catch (err) {
              console.log(`      ❌ Error checking approval for ${addr.slice(0, 10)}...: ${err.message}`);
            }
          }
          
          // Get approval count
          try {
            const approvalCount = await governance.getApprovalCount(i);
            console.log(`   Total approvals: ${approvalCount}`);
          } catch (err) {
            console.log(`   ❌ Error getting approval count: ${err.message}`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error getting batch ${i}:`, error.message);
        }
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error getting batch count:', error.message);
  }
  
  // 4. Check contract functions availability
  console.log('\n=== CONTRACT FUNCTIONS ===\n');
  try {
    const governanceInterface = governance.interface;
    const functions = ['approveBatch', 'rejectBatch', 'isAdmin', 'hasAdminApproved', 'getApprovalCount', 'threshold', 'adminCount'];
    
    console.log('Available functions:');
    for (const funcName of functions) {
      try {
        const fragment = governanceInterface.getFunction(funcName);
        console.log(`   ✅ ${funcName}(${fragment.inputs.map(i => i.type).join(', ')})`);
      } catch (err) {
        console.log(`   ❌ ${funcName} - NOT FOUND`);
      }
    }
  } catch (error) {
    console.error('❌ Error checking functions:', error.message);
  }
  
  // 5. Simulate approval transaction
  console.log('\n=== SIMULATED TRANSACTION ===\n');
  if (await governance.isAdmin(deployer.address)) {
    try {
      const batchCount = await registry.getBatchCount();
      if (batchCount > 0) {
        const latestBatchIndex = Number(batchCount) - 1;
        const hasApproved = await governance.hasAdminApproved(latestBatchIndex, deployer.address);
        
        console.log(`Simulating approval of batch ${latestBatchIndex} by ${deployer.address}:`);
        console.log(`   Already approved: ${hasApproved}`);
        
        if (!hasApproved) {
          // Estimate gas
          try {
            const gasEstimate = await governance.approveBatch.estimateGas(latestBatchIndex);
            console.log(`   ✅ Gas estimate: ${gasEstimate}`);
            console.log(`   Transaction should succeed`);
          } catch (estimateError) {
            console.error(`   ❌ Gas estimation failed:`, estimateError.message);
            console.error(`   This means the transaction would REVERT`);
            
            // Try to decode revert reason
            if (estimateError.data) {
              console.log(`   Revert data: ${estimateError.data}`);
            }
          }
        } else {
          console.log(`   ⚠️  Batch already approved by this admin`);
        }
      } else {
        console.log('   No batches to test with');
      }
    } catch (error) {
      console.error('❌ Error simulating transaction:', error.message);
    }
  } else {
    console.log(`⚠️  Deployer (${deployer.address}) is not an admin, cannot simulate approval`);
  }
  
  // 6. Recommendations
  console.log('\n=== RECOMMENDATIONS ===\n');
  
  const userIsAdmin = await governance.isAdmin(userAddress);
  if (!userIsAdmin) {
    console.log('🔧 ISSUE FOUND: User address is NOT an admin');
    console.log('   Solution: Add user as admin using:');
    console.log(`   await governance.addAdmin("${userAddress}")`);
    console.log('   Or user needs to connect with an admin wallet');
  } else {
    console.log('✅ User is authorized as admin');
  }
  
  const threshold = await governance.threshold();
  const adminCount = await governance.adminCount();
  if (threshold > adminCount) {
    console.log('🔧 ISSUE FOUND: Threshold exceeds admin count');
    console.log(`   Solution: Add more admins or reduce threshold to ${adminCount}`);
  }
  
  const batchCount = await registry.getBatchCount();
  if (batchCount === 0n) {
    console.log('ℹ️  No batches exist yet - submit a batch first');
  }
  
  console.log('\n✅ Diagnostic complete!\n');
}

// Run diagnostic
debugGovernanceRevert()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
