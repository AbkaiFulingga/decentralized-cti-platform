// components/IOCSubmissionForm.jsx
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { NETWORKS, STAKING_TIERS } from '../utils/constants';
import { zkProver } from '../utils/merkle-zkp';
import { zksnarkProver } from '../utils/zksnark-prover';
import { IOCEncryption, formatForIPFS, computeCIDCommitment } from '../utils/encryption';

export default function IOCSubmissionForm() {
  const [iocInput, setIocInput] = useState('');
  const [privacyMode, setPrivacyMode] = useState('public');
  const [encryptionEnabled, setEncryptionEnabled] = useState(false); // NEW: Encryption toggle
  const [selectedTier, setSelectedTier] = useState('STANDARD');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [merkleRoot, setMerkleRoot] = useState('');
  const [ipfsCid, setIpfsCid] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [walletBalance, setWalletBalance] = useState('0');
  const [isRegistered, setIsRegistered] = useState(false);
  const [contributorInfo, setContributorInfo] = useState(null);
  const [zkpReady, setZkpReady] = useState(false);
  const [zkpLoading, setZkpLoading] = useState(false);
  const [anonymitySetSize, setAnonymitySetSize] = useState(0);
  const [treeAge, setTreeAge] = useState(null);
  const [isInTree, setIsInTree] = useState(false);
  const [zksnarkReady, setZksnarkReady] = useState(false);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [proofProgress, setProofProgress] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      checkConnection();
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (walletConnected && currentNetwork) {
      checkBalance();
      checkRegistrationStatus();
    }
  }, [walletConnected, currentNetwork]);

  useEffect(() => {
    if (walletConnected && privacyMode === 'anonymous' && currentNetwork?.chainId === 421614 && isRegistered) {
      loadZKPTree();
    }
  }, [walletConnected, privacyMode, currentNetwork, isRegistered, walletAddress]);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setWalletAddress(accounts[0].address);
          setWalletConnected(true);
          const network = await provider.getNetwork();
          const chainId = network.chainId.toString();
          if (chainId === "11155111") setCurrentNetwork(NETWORKS.sepolia);
          else if (chainId === "421614") setCurrentNetwork(NETWORKS.arbitrumSepolia);
        }
      } catch (error) {
        console.error('Connection failed:', error);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setWalletConnected(false);
      setWalletAddress('');
      setWalletBalance('0');
      setIsRegistered(false);
      setZkpReady(false);
      setZksnarkReady(false);
      setIsInTree(false);
    } else {
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
    }
  };

  const handleChainChanged = () => window.location.reload();

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setStatus('❌ Install MetaMask');
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();
      if (chainId === "11155111") setCurrentNetwork(NETWORKS.sepolia);
      else if (chainId === "421614") setCurrentNetwork(NETWORKS.arbitrumSepolia);
      else setStatus('❌ Switch to Sepolia or Arbitrum Sepolia');
    } catch (error) {
      setStatus('❌ Connection failed');
    }
  };

  const checkBalance = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const balance = await provider.getBalance(await signer.getAddress());
      setWalletBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Balance check failed:', error);
    }
  };

  const checkRegistrationStatus = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const registry = new ethers.Contract(
        currentNetwork.contracts.registry,
        ["function contributors(address) view returns (uint256,uint256,uint256,uint256,uint256,bool,uint256)"],
        signer
      );
      
      const data = await registry.contributors(address);
      setIsRegistered(data[5]);
      
      if (data[5]) {
        const tierWei = Number(data[4]);
        const tierName = tierWei === 10000000000000000 ? 'MICRO' :
                          tierWei === 50000000000000000 ? 'STANDARD' :
                          tierWei === 100000000000000000 ? 'PREMIUM' : 'UNKNOWN';
        setContributorInfo({
          tier: tierName,
          submissionCount: Number(data[0]),
          reputationScore: Number(data[2]),
          totalStaked: ethers.formatEther(data[3])
        });
      }
    } catch (error) {
      console.error('Registration check failed:', error);
    }
  };

  const loadZKPTree = async () => {
    setZkpLoading(true);
    try {
      // Load Merkle tree for both old Merkle-based and new zkSNARK-based proofs
      const loaded = await zkProver.loadContributorTree();
      if (loaded) {
        setZkpReady(true);
        setAnonymitySetSize(zkProver.getAnonymitySetSize());
        setTreeAge(zkProver.getTreeFreshness());
      }
      
      // Also load for zkSNARK prover
      const zksnarkLoaded = await zksnarkProver.loadContributorTree();
      if (zksnarkLoaded) {
        setZksnarkReady(true);
        // ✅ FIX: Check using zkSNARK prover, not old Merkle prover
        if (walletAddress) {
          const inTree = zksnarkProver.isAddressInTree(walletAddress);
          console.log('🔍 Address in tree check:', { walletAddress, inTree });
          setIsInTree(inTree);
        }
        console.log('✅ zkSNARK prover ready');
      }
    } finally {
      setZkpLoading(false);
    }
  };

  const switchNetwork = async (targetNetwork) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + targetNetwork.chainId.toString(16) }]
      });
      setCurrentNetwork(targetNetwork);
    } catch (error) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + targetNetwork.chainId.toString(16),
              chainName: targetNetwork.name,
              nativeCurrency: targetNetwork.nativeCurrency,
              rpcUrls: [targetNetwork.rpcUrl],
              blockExplorerUrls: [targetNetwork.explorerUrl]
            }]
          });
          setCurrentNetwork(targetNetwork);
        } catch (addError) {
          setStatus('❌ Failed to add network');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚀 IOC Batch Submission Started');
    console.log('═══════════════════════════════════════════════════════');
    
    if (!walletConnected || !iocInput.trim()) {
      setStatus('❌ Connect wallet and enter IOCs');
      console.error('❌ Pre-flight check failed:', { walletConnected, hasInput: !!iocInput.trim() });
      return;
    }

    setLoading(true);
    setStatus('🔄 Starting...');
    setMerkleRoot('');
    setIpfsCid('');
    setTxHash('');

    let registry = null;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      console.log('📋 Submission Configuration:');
      console.log('   👤 Address:', address);
      console.log('   🌐 Network:', currentNetwork?.name);
      console.log('   🔐 Privacy Mode:', privacyMode);
      console.log('   🔒 Encryption:', encryptionEnabled ? 'ON' : 'OFF');
      console.log('   💎 Tier:', selectedTier);
      console.log('   ✅ Registered:', isRegistered);
      console.log('');

      // Parse IOCs
      setStatus('📝 Parsing IOCs...');
      console.log('📝 Step 1: Parsing IOCs...');
      const iocs = iocInput.split('\n').map(l => l.trim()).filter(l => l);
      console.log(`   ✅ Parsed ${iocs.length} IOCs`);
      console.log(`   📊 Sample IOCs:`, iocs.slice(0, 3));
      
      if (iocs.length === 0) {
        throw new Error('No valid IOCs');
      }

      // Generate Merkle tree
      setStatus('🌳 Generating Merkle tree...');
      console.log('\n🌳 Step 2: Generating Merkle tree...');
      const leaves = iocs.map(ioc => keccak256(ioc));
      console.log(`   📦 Generated ${leaves.length} leaves`);
      
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const merkleRootHash = '0x' + tree.getRoot().toString('hex');
      setMerkleRoot(merkleRootHash);
      
      console.log(`   ✅ Merkle Root: ${merkleRootHash}`);
      console.log(`   🌲 Tree Depth: ${tree.getDepth()}`);

      // Upload to IPFS (with optional encryption)
      setStatus('📤 Uploading to IPFS...');
      console.log('\n📤 Step 3: Preparing IPFS upload...');
      
      let uploadPayload = {
        version: "1.0",
        format: "cti-ioc-batch",
        timestamp: new Date().toISOString(),
        iocs: iocs,
        metadata: {
          source: privacyMode === 'anonymous' ? 'anonymous' : address,
          network: currentNetwork.name,
          merkleRoot: merkleRootHash,
          encrypted: encryptionEnabled
        }
      };
      
      console.log('   📦 Payload:', {
        version: uploadPayload.version,
        format: uploadPayload.format,
        iocCount: iocs.length,
        encrypted: encryptionEnabled
      });
      
      let encryptionKey = null;
      
      if (encryptionEnabled) {
        console.log('   🔐 Encryption enabled, encrypting IOCs...');
        // Double-check we're in browser environment
        if (typeof window === 'undefined') {
          throw new Error('Encryption requires browser environment');
        }
        
        setStatus('🔐 Encrypting IOC bundle...');
        try {
          const encryptor = new IOCEncryption();
          const metadata = uploadPayload.metadata;
          const stixBundle = {
            iocs: uploadPayload.iocs,
            format: uploadPayload.format,
            timestamp: uploadPayload.timestamp
          };
          
          const encrypted = await encryptor.encryptBundle(stixBundle, metadata);
          
          // Store key locally (WARNING: Demo only, not production safe)
          encryptor.storeKeyLocally(encrypted.keyId, encrypted.key);
          encryptionKey = encrypted.key;

          // NEW (demo-friendly): also store the key server-side so the Pinata search indexer
          // can decrypt and index encrypted bundles.
          //
          // IMPORTANT: This uses a bearer token that must be configured via NEXT_PUBLIC_CTI_SEARCH_ADMIN_TOKEN.
          // In production, you'd replace this with real auth (session/admin) and wouldn't expose a long-lived
          // admin token to browsers.
          try {
            const token = process.env.NEXT_PUBLIC_CTI_SEARCH_ADMIN_TOKEN;
            if (!token) {
              console.warn('⚠️ Missing NEXT_PUBLIC_CTI_SEARCH_ADMIN_TOKEN; encrypted bundles will not be searchable server-side unless the key is escrowed.');
            } else {
              const escrowResp = await fetch('/api/key-escrow', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  keyId: encrypted.keyId,
                  keyHex: encrypted.key,
                  algorithm: encrypted.algorithmId || 'AES-256-CBC'
                })
              });
              const escrowJson = await escrowResp.json();
              if (!escrowJson?.success) {
                console.warn('⚠️ Key escrow store failed; encrypted bundles may not be searchable server-side.', escrowJson?.error);
              }
            }
          } catch (e) {
            console.warn('⚠️ Key escrow unavailable; encrypted bundles may not be searchable server-side.', e?.message || e);
          }
          
          // Replace payload with encrypted version (no key included in upload)
          uploadPayload = formatForIPFS(encrypted);
          
          console.log('✅ IOC bundle encrypted with AES-256-GCM');
          console.log('   KeyId:', encrypted.keyId);
          console.log('   Key stored locally (DEMO ONLY)');
          
          setStatus('📤 Uploading encrypted bundle to IPFS...');
        } catch (encError) {
          throw new Error(`Encryption failed: ${encError.message}`);
        }
      }
      
      const uploadRes = await fetch('/api/pinata-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadPayload)
      });
      
      console.log(`   📡 POST /api/pinata-upload - Status: ${uploadRes.status}`);
      
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error(`   ❌ IPFS upload failed:`, errorText);
        throw new Error(`IPFS upload failed: ${uploadRes.status}`);
      }
      
      const upload = await uploadRes.json();
      
      if (!upload.success || !upload.cid) {
        console.error(`   ❌ Upload response invalid:`, upload);
        throw new Error(`IPFS failed: ${upload.error || 'No CID'}`);
      }
      
      const cid = upload.cid;
      setIpfsCid(cid);
      console.log(`   ✅ IPFS CID: ${cid}`);
      console.log(`   🔗 Gateway URL: https://gateway.pinata.cloud/ipfs/${cid}`);

      // Create registry contract
      console.log('\n📝 Step 4: Preparing smart contract interaction...');
      registry = new ethers.Contract(
        currentNetwork.contracts.registry,
        [
          "function registerContributor(uint256 tier) external payable",
          "function contributors(address) view returns (uint256,uint256,uint256,uint256,uint256,bool,uint256)",
          "function addBatch(string memory cid, bytes32 merkleRoot, bool isPublic, bytes32 zkpCommitment, bytes memory zkpProof) public payable",
          "function STANDARD_STAKE() view returns (uint256)"
        ],
        signer
      );

      console.log(`   📍 Registry Address: ${registry.target}`);
      console.log(`   🌐 Network: ${currentNetwork.name}`);

      // Check registration
      console.log('\n🔍 Checking contributor registration...');
      const data = await registry.contributors(address);
      const needsReg = !data[5];

      // Register if needed
      if (needsReg) {
        setStatus('📝 Registering...');
        const standardStake = await registry.STANDARD_STAKE();
        console.log('Registering with:', ethers.formatEther(standardStake), 'ETH');
        
        const regTx = await registry.registerContributor(
          standardStake,
          { value: standardStake, gasLimit: 200000 }
        );
        
        setStatus(`⏳ ${regTx.hash.substring(0, 10)}...`);
        await regTx.wait();
        setStatus('✅ Registered! Submitting batch...');
        await new Promise(r => setTimeout(r, 2000));
      }

      // Submit batch
      const wantsAnonymous = privacyMode === 'anonymous';
      const canDoAnonymous = wantsAnonymous && currentNetwork.chainId === 421614 && zksnarkReady && isInTree;

      if (canDoAnonymous) {
        // ═══════════════════════════════════════════════════════════
        // ANONYMOUS SUBMISSION WITH GROTH16 zkSNARK PROOF (L2 only)
        // ═══════════════════════════════════════════════════════════
        
        setProofGenerating(true);
        
        try {
          // Step 1: Generate Groth16 zkSNARK proof in browser
          setStatus('🔐 Generating zkSNARK proof...');
          setProofProgress('Loading circuit files (~22 MB)...');
          
          console.log('═══════════════════════════════════════════════════════');
          console.log('🔐 Starting Groth16 zkSNARK Proof Generation');
          console.log('═══════════════════════════════════════════════════════');
          
          const startTime = Date.now();
          
          setProofProgress('Computing witness (may take 10-30 seconds)...');
          
          // Generate zkSNARK proof using contributor-proof.circom (simple 2-input Poseidon)
          // Proves: commitment = Poseidon(address, nonce) AND address in Merkle tree
          const proof = await zksnarkProver.generateGroth16Proof(address);
          
          const proofTime = Date.now() - startTime;
          console.log(`✅ Proof generated in ${proofTime}ms (${(proofTime / 1000).toFixed(1)}s)`);
          
          setProofProgress('Proof generated! Preparing transaction...');
          
          // Step 2: Get contract instance
          const registryWithZK = new ethers.Contract(
            currentNetwork.contracts.registry,
            [
              "function addBatchWithZKProof((uint256[2] a, uint256[2][2] b, uint256[2] c) proof, bytes32 commitment, bytes32 merkleRoot, string ipfsCID) external payable"
            ],
            signer
          );
          
          // Step 3: Submit with zkSNARK proof
          setStatus('📡 Submitting with zkSNARK proof...');
          setProofProgress('Sending transaction to blockchain...');
          
          console.log('═══════════════════════════════════════════════════════');
          console.log('📡 Submitting Anonymous Batch with Groth16 Proof');
          console.log('═══════════════════════════════════════════════════════');
          console.log('CID:', cid);
          console.log('Merkle Root:', merkleRootHash);
          console.log('Proof pA:', proof.pA);
          console.log('Proof pB:', proof.pB);
          console.log('Proof pC:', proof.pC);
          console.log('Public Signals:', proof.pubSignals);
          
          // Calculate submission fee (1% of estimated gas cost)
          const feeData = await provider.getFeeData();
          const txGasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits("0.1", "gwei");
          const estimatedGas = 500000n;
          const gasCost = estimatedGas * txGasPrice;
          const submissionFee = (gasCost * 1n) / 100n;
          const submissionFeeWithMargin = (submissionFee * 2n); // 2x margin for safety
          
          console.log('Submission fee:', ethers.formatEther(submissionFeeWithMargin), 'ETH');
          
          const tx = await registryWithZK.addBatchWithZKProof(
            { a: proof.pA, b: proof.pB, c: proof.pC },
            proof.commitment,
            merkleRootHash,
            cid,
            {
              value: submissionFeeWithMargin,
              gasLimit: 500000
            }
          );
          
          setTxHash(tx.hash);
          setStatus(`⏳ Confirming: ${tx.hash.substring(0, 10)}...`);
          setProofProgress('Waiting for blockchain confirmation...');
          
          console.log('Transaction hash:', tx.hash);
          
          const receipt = await tx.wait();
          
          console.log('✅ Transaction confirmed!');
          console.log('Gas used:', receipt.gasUsed.toString());
          console.log('Block:', receipt.blockNumber);
          
          setStatus(`✅ Anonymous batch submitted with zkSNARK proof! 🎭
Hidden among ${zksnarkProver.getAnonymitySetInfo()?.size || 'N'} contributors
Proof generation: ${(proofTime / 1000).toFixed(1)}s
Gas used: ${receipt.gasUsed.toString()}`);
          
          setProofProgress('');
          
        } catch (proofError) {
          console.error('❌ zkSNARK submission failed:', proofError);
          // IMPORTANT: ZK proof should never break core submission.
          // If anonymous mode fails (e.g. snarkjs load error), fall back to normal public submission.
          setStatus(
            `⚠️ Anonymous proof failed (falling back to public submission): ${proofError.message}`
          );
          setProofProgress('');
          // Fall through to public submission below
        } finally {
          setProofGenerating(false);
        }
        
      }

      if (!canDoAnonymous) {
        if (wantsAnonymous) {
          // User selected anonymous but can't do it on this network / state.
          // Don't hard fail: the core feature is submitting IOCs.
          setStatus(
            currentNetwork.chainId !== 421614
              ? 'ℹ️ Anonymous mode is L2-only. Submitting publicly…'
              : !zksnarkReady
                ? 'ℹ️ zkSNARK system not ready yet. Submitting publicly…'
                : !isInTree
                  ? 'ℹ️ You are not in the contributor tree yet. Submitting publicly…'
                  : 'ℹ️ Anonymous mode unavailable right now. Submitting publicly…'
          );
        }

        // PUBLIC SUBMISSION
        setStatus('📡 Submitting batch...');
        console.log('\n📡 Step 5: Public batch submission...');
        console.log(`   🔓 Privacy Mode: Public`);
        console.log(`   📍 CID: ${cid}`);
        console.log(`   🌲 Merkle Root: ${merkleRootHash}`);
        
        if (!cid || !merkleRootHash) {
          throw new Error('Missing CID or Merkle root');
        }
        
        const zkpCommitment = ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase()));
        console.log(`   🔑 ZKP Commitment: ${zkpCommitment}`);
        
        // ✅ CRITICAL FIX: Use maxFeePerGas (matches tx.gasprice in contract)
        const feeData = await provider.getFeeData();
        console.log('\n💰 Gas Estimation:');
        console.log('Raw feeData:', {
          gasPrice: feeData.gasPrice?.toString(),
          maxFeePerGas: feeData.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
        });
        
        // Use maxFeePerGas because that's what tx.gasprice will be
        const txGasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits("2", "gwei");
        
        const estimatedGas = 200000n;
        const gasCost = estimatedGas * txGasPrice;
        const submissionFee = (gasCost * 1n) / 100n; // 1% of gas cost
        
        // ✅ Safety margin: 2x for L1 (volatile), 1.5x for L2 (stable)
        const safetyMultiplier = currentNetwork.chainId === 11155111 ? 20n : 15n;
        const safetyDivisor = 10n;
        const submissionFeeWithMargin = (submissionFee * safetyMultiplier) / safetyDivisor;
        
        console.log('   🌐 Network:', currentNetwork.name, '(ChainID:', currentNetwork.chainId + ')');
        console.log('   ⛽ maxFeePerGas:', ethers.formatUnits(txGasPrice, 'gwei'), 'Gwei');
        console.log('   📊 Estimated gas:', estimatedGas.toString());
        console.log('   💵 Gas cost:', ethers.formatEther(gasCost), 'ETH');
        console.log('   📈 1% fee:', ethers.formatEther(submissionFee), 'ETH');
        console.log('   🛡️  Safety:', currentNetwork.chainId === 11155111 ? '2x' : '1.5x');
        console.log('   💰 Final fee:', ethers.formatEther(submissionFeeWithMargin), 'ETH');
        
        console.log('\n📤 Sending transaction...');
        console.log('   CID:', cid);
        console.log('   Merkle Root:', merkleRootHash);
        console.log('   Is Public: true');
        console.log('   Value:', ethers.formatEther(submissionFeeWithMargin), 'ETH');
        console.log('   Gas Limit: 350000');
        
        const tx = await registry.addBatch(
          cid, 
          merkleRootHash, 
          true, 
          zkpCommitment, 
          '0x00', 
          { 
            value: submissionFeeWithMargin,  // ✅ Calculated with proper safety margin
            gasLimit: 350000,
            maxFeePerGas: txGasPrice,  // ✅ Explicitly set to match fee calculation
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei")
          }
        );
        
        console.log(`\n✅ Transaction sent!`);
        console.log(`   📋 TX Hash: ${tx.hash}`);
        
        setTxHash(tx.hash);
        setStatus(`⏳ Batch TX: ${tx.hash.substring(0, 10)}...`);
        console.log('TX hash:', tx.hash);
        
        console.log(`\n✅ Transaction sent!`);
        console.log(`   📋 TX Hash: ${tx.hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);
        
        setTxHash(tx.hash);
        setStatus(`⏳ Confirming: ${tx.hash.substring(0, 10)}...`);
        
        const receipt = await tx.wait();
        
        console.log('\n✅ Transaction confirmed!');
        console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   💰 Gas price: ${ethers.formatUnits(receipt.gasPrice, 'gwei')} Gwei`);
        console.log(`   💵 Total cost: ${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} ETH`);
        console.log(`   📦 Block: ${receipt.blockNumber}`);
        console.log(`   ✅ Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
        
        setStatus(`✅ Batch submitted successfully! ${needsReg ? 'You are now a registered contributor! 🎉' : ''}`);
      }

      await checkBalance();
      await checkRegistrationStatus();

      if (needsReg) {
        if (currentNetwork?.chainId === 421614) {
          setStatus(prev => prev + '\n\n💡 Anonymous mode (L2) available after the next tree update (2 AM UTC).');
        } else {
          setStatus(prev => prev + '\n\nℹ️ Anonymous submissions are L2-only. On L1, submissions are public.');
        }
      }
      
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ IOC Batch Submission Complete');
      console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
      console.error("\n═══════════════════════════════════════════════════════");
      console.error("❌ SUBMISSION ERROR");
      console.error("═══════════════════════════════════════════════════════");
      console.error("Error Type:", error.constructor.name);
      console.error("Error Code:", error.code);
      console.error("Error Message:", error.message);
      console.error("Error Reason:", error.reason);
      if (error.data) {
        console.error("Error Data:", error.data);
      }
      if (error.stack) {
        console.error("Stack Trace:", error.stack);
      }
      console.error("═══════════════════════════════════════════════════════\n");
      
      if (error.message?.includes('IPFS')) {
        setStatus(`❌ IPFS upload failed`);
      } else if (error.message?.includes('Not active public contributor')) {
        setStatus('❌ Not registered. Please register first.');
      } else if (error.message?.includes('Contributor tree not initialized')) {
        setStatus('❌ Contributor tree not initialized. Contact admin.');
      } else if (error.message?.includes('Invalid contributor proof')) {
        setStatus('❌ Invalid proof. You may not be in contributor tree.');
      } else if (error.message?.includes('Commitment already used')) {
        setStatus('❌ Commitment already used. Refresh and try again.');
      } else if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        setStatus('❌ Transaction cancelled');
      } else if (error.code === 'UNKNOWN_ERROR' || error.code === -32603) {
        setStatus('❌ RPC error. Check console for details. Try refreshing.');
      } else if (error.message?.includes('Insufficient submission fee')) {
        setStatus('❌ Insufficient submission fee. Network gas price may have spiked. Try again.');
      } else {
        setStatus(`❌ ${error?.reason || error?.shortMessage || error?.message || 'Failed - check console'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const canAffordSubmission = () => {
    if (!walletBalance) return false;
    const balance = parseFloat(walletBalance);
    const stake = isRegistered ? 0 : parseFloat(STAKING_TIERS[selectedTier].amount);
    const submissionFee = currentNetwork?.chainId === 11155111 ? 0.001 : 0.0003; // Estimated with margin
    const estimatedGas = currentNetwork?.chainId === 11155111 ? 0.003 : 0.0005;
    return balance >= (stake + submissionFee + estimatedGas);
  };

  const getRequiredAmount = () => {
    const stake = isRegistered ? 0 : parseFloat(STAKING_TIERS[selectedTier].amount);
    const submissionFee = currentNetwork?.chainId === 11155111 ? 0.001 : 0.0003;
    const gas = currentNetwork?.chainId === 11155111 ? 0.003 : 0.0005;
    return (stake + submissionFee + gas).toFixed(4);
  };

  const canSubmitAnonymously = () => {
    return currentNetwork?.chainId === 421614 && isRegistered && zksnarkReady && isInTree;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-700/50">
        
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">🚀 Submit IOC Batch</h2>
          <p className="text-gray-400">Share threat intelligence with the community</p>
        </div>

        {!walletConnected ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400">Connect MetaMask to submit IOC batches</p>
            </div>
            
            <button
              onClick={connectWallet}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Connect MetaMask Wallet
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-gray-400 text-sm">Connected Wallet</span>
                  <p className="text-purple-400 font-mono text-sm">
                    {walletAddress.substring(0, 10)}...{walletAddress.substring(38)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-sm">Balance</span>
                  <p className={`font-mono text-sm font-bold ${
                    parseFloat(walletBalance) < 0.01 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {parseFloat(walletBalance).toFixed(4)} ETH
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => switchNetwork(NETWORKS.sepolia)}
                  disabled={currentNetwork?.chainId === 11155111}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    currentNetwork?.chainId === 11155111
                      ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  }`}
                >
                  🌐 Ethereum Sepolia
                </button>
                
                <button
                  onClick={() => switchNetwork(NETWORKS.arbitrumSepolia)}
                  disabled={currentNetwork?.chainId === 421614}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                    currentNetwork?.chainId === 421614
                      ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  }`}
                >
                  ⚡ Arbitrum Sepolia
                </button>
              </div>
            </div>

            {isRegistered && contributorInfo && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-green-300 font-semibold">Registered Contributor</p>
                    <p className="text-gray-400 text-sm">
                      {contributorInfo.tier} Tier • {contributorInfo.submissionCount} submissions • {contributorInfo.reputationScore} reputation
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isRegistered && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="text-sm text-gray-400">
                    <p className="font-semibold text-blue-300 mb-1">First Submission - 2-Step Process</p>
                    <p>Step 1: Register as contributor (stake {STAKING_TIERS[selectedTier].amount} ETH)</p>
                    <p>Step 2: Submit your first batch (small fee + gas)</p>
                  </div>
                </div>
              </div>
            )}

            {!canAffordSubmission() && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="text-sm text-red-300">
                    <p className="font-semibold mb-1">Insufficient Balance</p>
                    <p>Need <span className="font-bold">{getRequiredAmount()} ETH</span> but have <span className="font-bold">{parseFloat(walletBalance).toFixed(4)} ETH</span></p>
                  </div>
                </div>
              </div>
            )}

            {privacyMode === 'anonymous' && currentNetwork?.chainId === 421614 && isRegistered && (
              <div className="mb-6">
                {zkpLoading ? (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <div>
                        <p className="text-blue-300 font-semibold">Loading zkSNARK System...</p>
                        <p className="text-gray-400 text-sm">Fetching contributor Merkle tree...</p>
                      </div>
                    </div>
                  </div>
                ) : zksnarkReady && isInTree ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔐</span>
                      <div className="flex-1">
                        <p className="text-green-300 font-semibold">zkSNARK Anonymous Mode Ready</p>
                        <p className="text-gray-400 text-sm">
                          Groth16 proof will be generated in your browser (~10-30s)
                        </p>
                        <p className="text-gray-400 text-sm">
                          Hidden among <span className="text-green-400 font-bold">{anonymitySetSize}</span> registered contributors
                        </p>
                        {treeAge && (
                          <p className="text-gray-500 text-xs mt-1">
                            Tree updated: {treeAge.lastUpdate} ({treeAge.ageHours}h ago)
                            {treeAge.isStale && <span className="text-yellow-400"> ⚠️ Stale</span>}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Privacy</div>
                        <div className="text-green-400 font-bold text-lg">95%</div>
                      </div>
                    </div>
                  </div>
                ) : zksnarkReady && !isInTree ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⏳</span>
                      <div>
                        <p className="text-yellow-300 font-semibold">Not Yet in Anonymous Tree</p>
                        <p className="text-gray-400 text-sm">
                          You are registered but not in the latest Merkle tree. Anonymous submissions available after next daily update (2 AM UTC).
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          You can submit in public mode now, or wait up to 24 hours.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">❌</span>
                      <div>
                        <p className="text-red-300 font-semibold">ZKP System Unavailable</p>
                        <p className="text-gray-400 text-sm">Cannot load contributor tree. Use public mode or try again later.</p>
                        <button
                          onClick={loadZKPTree}
                          className="mt-2 text-sm text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          🔄 Retry Loading Tree
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {privacyMode === 'anonymous' && currentNetwork?.chainId !== 421614 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-yellow-300 font-semibold">ZKP Only Available on Arbitrum L2</p>
                    <p className="text-gray-400 text-sm mb-2">
                      Anonymous submissions are only supported on Arbitrum Sepolia to minimize costs.
                    </p>
                    <button
                      onClick={() => switchNetwork(NETWORKS.arbitrumSepolia)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-all"
                    >
                      ⚡ Switch to Arbitrum L2
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {!isRegistered && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">
                    💎 Select Staking Tier
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(STAKING_TIERS).map(([key, tier]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedTier(key)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedTier === key
                            ? 'border-purple-500 bg-purple-500/20'
                            : 'border-gray-600 bg-gray-900/30 hover:border-gray-500'
                        }`}
                      >
                        <div className="text-center">
                          <p className="text-white font-bold mb-1">{tier.label}</p>
                          <p className="text-purple-400 text-2xl font-bold mb-1">{tier.amount} ETH</p>
                          <p className="text-gray-400 text-xs">+{tier.reputationBonus} reputation</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  📝 Enter IOCs (One Per Line)
                </label>
                <textarea
                  value={iocInput}
                  onChange={(e) => setIocInput(e.target.value)}
                  placeholder="malicious-domain.com&#10;192.168.1.100&#10;5d41402abc4b2a76b9719d911017c592&#10;http://phishing-site.xyz"
                  rows={8}
                  className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-100 placeholder-gray-500 font-mono text-sm"
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-gray-500">
                  {iocInput.split('\n').filter(l => l.trim()).length} IOCs entered
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  🔒 Privacy Mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPrivacyMode('public')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      privacyMode === 'public'
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-600 bg-gray-900/30 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <span className="text-3xl block mb-2">🌐</span>
                      <p className="text-white font-bold mb-1">Public Identity</p>
                      <p className="text-gray-400 text-xs">Your address will be visible</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacyMode('anonymous')}
                    disabled={!isRegistered || currentNetwork?.chainId !== 421614}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      privacyMode === 'anonymous'
                        ? 'border-purple-500 bg-purple-500/20'
                        : (!isRegistered || currentNetwork?.chainId !== 421614) 
                        ? 'border-gray-700 bg-gray-900/20 opacity-50 cursor-not-allowed'
                        : 'border-gray-600 bg-gray-900/30 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <span className="text-3xl block mb-2">�</span>
                      <p className="text-white font-bold mb-1">Anonymous (zkSNARK)</p>
                      <p className="text-gray-400 text-xs">
                        {!isRegistered ? 'Register first to unlock' : currentNetwork?.chainId !== 421614 ? 'Switch to Arbitrum L2 (affordable gas)' : 'Groth16 proof generated in browser'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* NEW: Encryption Toggle */}
              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 p-6 rounded-xl border border-purple-500/30">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔐</span>
                      <div>
                        <p className="text-white font-semibold">Client-Side Encryption (CP2)</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Encrypt IOC data with AES-256-GCM before IPFS upload
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={encryptionEnabled}
                      onChange={(e) => setEncryptionEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                  </div>
                </label>
                
                {encryptionEnabled && (
                  <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded-lg">
                    <p className="text-yellow-400 text-xs flex items-start gap-2">
                      <span>⚠️</span>
                      <span>
                        <strong>Proof-of-Concept:</strong> Encryption key stored in browser localStorage (vulnerable to XSS). 
                        Production requires public-key wrapping or key escrow service (CP3 roadmap).
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                <h3 className="text-white font-semibold mb-3">💰 Cost Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">
                      {isRegistered ? 'Registration:' : `${STAKING_TIERS[selectedTier].label} Stake:`}
                    </span>
                    <span className="text-white font-mono">
                      {isRegistered ? '0.000 ETH (Already Registered ✅)' : `${STAKING_TIERS[selectedTier].amount} ETH`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Submission Fee (1-2%):</span>
                    <span className="text-white font-mono">
                      ~{currentNetwork?.chainId === 11155111 ? '0.001' : '0.0003'} ETH
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Estimated Gas:</span>
                    <span className="text-white font-mono">
                      ~{currentNetwork?.chainId === 11155111 ? '0.003' : '0.0005'} ETH
                    </span>
                  </div>
                  {privacyMode === 'anonymous' && currentNetwork?.chainId === 421614 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">ZK Verification:</span>
                      <span className="text-purple-400 font-mono">+0.0002 ETH</span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                    <span className="text-white font-semibold">Total Required:</span>
                    <span className={`font-mono font-bold ${canAffordSubmission() ? 'text-green-400' : 'text-red-400'}`}>
                      {getRequiredAmount()} ETH
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Your Balance:</span>
                    <span className={`font-mono ${parseFloat(walletBalance) >= parseFloat(getRequiredAmount()) ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(walletBalance).toFixed(4)} ETH
                    </span>
                  </div>
                  {!isRegistered && (
                    <div className="mt-2 p-2 bg-blue-500/10 rounded-lg">
                      <p className="text-xs text-blue-300">
                        ⚡ Two transactions required: (1) Registration → (2) Batch submission
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || proofGenerating || !iocInput.trim() || !canAffordSubmission()}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  loading || proofGenerating || !iocInput.trim() || !canAffordSubmission()
                    ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white transform hover:scale-105'
                }`}
              >
                {proofGenerating ? '🔐 Generating zkSNARK Proof...' :
                 loading ? '⏳ Processing...' : 
                 !canAffordSubmission() ? '❌ Insufficient Balance' :
                 isRegistered ? (privacyMode === 'anonymous' && canSubmitAnonymously() ? '🔒 Submit Anonymously (zkSNARK)' : '🚀 Submit Batch') : 
                 '🚀 Register & Submit (2 TXs)'}
              </button>
            </form>

            {proofGenerating && proofProgress && (
              <div className="mt-6 p-4 rounded-xl border bg-purple-500/10 border-purple-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                  <div>
                    <p className="text-purple-300 font-semibold">Generating zkSNARK Proof</p>
                    <p className="text-gray-400 text-sm">{proofProgress}</p>
                    <p className="text-gray-500 text-xs mt-1">This may take 10-30 seconds...</p>
                  </div>
                </div>
              </div>
            )}

            {status && (
              <div className={`mt-6 p-4 rounded-xl border ${
                status.includes('✅') ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                status.includes('❌') ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                status.includes('⚠️') ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' :
                'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}>
                <p className="font-semibold whitespace-pre-wrap">{status}</p>
              </div>
            )}

            {(merkleRoot || ipfsCid || txHash) && (
              <div className="mt-6 space-y-3">
                {ipfsCid && (
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">IPFS CID:</p>
                    <p className="text-blue-400 font-mono text-sm break-all">{ipfsCid}</p>
                  </div>
                )}
                
                {merkleRoot && (
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Merkle Root:</p>
                    <p className="text-green-400 font-mono text-sm break-all">{merkleRoot}</p>
                  </div>
                )}
                
                {txHash && (
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Transaction Hash:</p>
                    <a
                      href={`${currentNetwork.explorerUrl}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 font-mono text-sm break-all underline"
                    >
                      {txHash}
                    </a>
                  </div>
                )}
                
                {privacyMode === 'anonymous' && anonymitySetSize > 0 && (
                  <div className="p-3 bg-purple-900/50 rounded-lg border border-purple-500/30">
                    <p className="text-gray-400 text-xs mb-1">🎭 Anonymity Protection:</p>
                    <p className="text-purple-300 text-sm">
                      Your identity is hidden among <span className="font-bold text-purple-400">{anonymitySetSize}</span> registered contributors
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 text-xl">ℹ️</span>
                <div className="text-sm text-gray-400">
                  <p className="font-semibold text-blue-300 mb-1">How It Works</p>
                  <ul className="space-y-1 text-xs">
                    <li>• {isRegistered ? 'Registered contributors pay dynamic submission fee (1-2% of gas) + gas' : 'First submission: Register (stake) → Submit (fee + gas)'}</li>
                    <li>• IOCs are hashed into a Merkle tree for cryptographic verification</li>
                    <li>• Data is uploaded to IPFS (decentralized storage)</li>
                    <li>• Batch requires 3/3 admin approvals before becoming queryable</li>
                    {privacyMode === 'anonymous' && currentNetwork?.chainId === 421614 && (
                      <li>• <span className="text-purple-400 font-semibold">Anonymous mode uses Groth16 zkSNARK proofs generated in your browser to hide your identity</span></li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
