// utils/constants.js

export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/OJZ2zwAbqwG_YYm9N6vuj",
    explorerUrl: "https://sepolia.etherscan.io",
  // Sepolia L1 CID-view upgrade deployment block
  deploymentBlock: 9936626,
    nativeCurrency: {
      name: "Sepolia ETH",
      symbol: "ETH",
      decimals: 18
    },
    contracts: {
      registry: "0x98692b63ce6dDb5b6E944dEFEbD4A98068Ba121B",  // ✅ Sepolia L1 registry (CID view)
      governance: "0xF195062B11FD4B62535c2335A86b3A9D66fFb7cD",  // ✅ Sepolia ThresholdGovernance
      storage: "0xfB493122A23cbdF829743332e97a6b8437630d59"      // ✅ Sepolia StorageContribution
    },
    gasPrice: 20,
    gasPriceUnit: "Gwei"
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerUrl: "https://sepolia.arbiscan.io",
    deploymentBlock: 215861533, // From deployments/merkle-zk-arbitrum.json (main registry deploy block)
    nativeCurrency: {
      name: "Arbitrum ETH",
      symbol: "ETH",
      decimals: 18
    },
    contracts: {
      registry: "0x83b2f9036FE1EBE5B79376Afae42Af1946c0A91C", // ✅ PrivacyPreservingRegistry (ZK-enabled) - synced from test-addresses-arbitrum.json
      governance: "0x1309C1a3166Cd31FA0f0A234aBf760254722Cf5B", // ✅ ThresholdGovernance - synced from test-addresses-arbitrum.json
      storage: "0x768899dC8F79004c4f4635A6C54f696b0BeA0233", // ✅ StorageContribution - synced from test-addresses-arbitrum.json
      merkleZK: "0x8582cf2D5314781d04e7b35e7e553fC9dA14Ac61", // MerkleZKRegistry (for anonymous submissions)
      oracleFeed: "0xbdFcBE759232c9435FB4AdfF937A6173B5b904bE",
      // ZK verifier currently used by the registry on Arbitrum Sepolia.
      // Keep this in sync with on-chain `PrivacyPreservingRegistry.zkVerifier()`.
      zkVerifier: "0xb509f336BB067225Fb2a2C3e7781593010036F57"
    },
    gasPrice: 0.1,
    gasPriceUnit: "Gwei"
  }
};

export const DEFAULT_NETWORK = "arbitrumSepolia";

export const IPFS_GATEWAYS = {
  pinata: "https://gateway.pinata.cloud/ipfs",
  ipfsIo: "https://ipfs.io/ipfs",
  cloudflare: "https://cloudflare-ipfs.com/ipfs",
  local: "http://192.168.1.3:8080/ipfs"
};

export const DEFAULT_GATEWAY = IPFS_GATEWAYS.pinata;

export const ADMIN_ADDRESSES = [
  "0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82",
  "0xf78afa5E41eDF35c05c1aEB082C1789283b09d3B",
  "0x0D5CaD75D37adA5A81EbEe04387229a40B0a457f"
];

export const STAKING_TIERS = {
  MICRO: {
    amount: "0.01",
    wei: "10000000000000000",
    reputationBonus: 7,
    label: "Micro Contributor"
  },
  STANDARD: {
    amount: "0.05",
    wei: "50000000000000000",
    reputationBonus: 10,
    label: "Standard Contributor"
  },
  PREMIUM: {
    amount: "0.1",
    wei: "100000000000000000",
    reputationBonus: 15,
    label: "Premium Contributor"
  }
};

export const CONTRACT_ABIS = {
  registry: [
    "function registerContributor(uint256 tier) external payable",
    "function addBatch(string memory cid, bytes32 merkleRoot, bool isPublic, bytes32 zkpCommitment, bytes memory zkpProof) public payable",
    "function addBatchWithZKProof((uint256[2] a, uint256[2][2] b, uint256[2] c) proof, bytes32 commitment, bytes32 merkleRoot, string ipfsCID) external",
    "function acceptBatch(uint256 batchIndex) external",
    "function getBatch(uint256 index) public view returns (bytes32 cidCommitment, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmations, uint256 falsePositives)",
    "function getBatchCount() public view returns (uint256)",
    "function contributors(address) external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)",
    "function getPlatformStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
    "function verifyIOC(uint256 batchIndex, bytes32 leaf, bytes32[] calldata proof) public view returns (bool)",
    "function confirmBatch(uint256 batchIndex) external",
    "function disputeBatch(uint256 batchIndex) external",
    "function MICRO_STAKE() external view returns (uint256)",
    "function STANDARD_STAKE() external view returns (uint256)",
    "function PREMIUM_STAKE() external view returns (uint256)",
    "function batches(uint256) external view returns (bytes32 cidCommitment, string memory ipfsCID, bytes32 merkleRoot, uint256 timestamp, bool accepted, bytes32 contributorHash, bool isPublic, uint256 confirmationCount, uint256 falsePositiveReports, bytes32 merkleRootHash)"
  ],
  governance: [
    "function admins(address) external view returns (bool)",
    "function approveBatch(uint256 batchIndex) external",
    "function getBatchApprovalStatus(uint256 batchIndex) external view returns (uint256 approvals, bool executed, uint256 createdAt)",
    "function threshold() external view returns (uint256)",
    "function adminCount() external view returns (uint256)"
  ],
  storage: [
    "function registerStorageProvider(uint256 storageGB) external payable",
    "function submitStorageProof(string[] memory cids) external",
    "function getStorageRole(address provider) external view returns (string)"
  ],
  oracleFeed: [
    "function submitFeed(string memory feedName, string memory cid, bytes32 merkleRoot, uint256 iocCount) external",
    "function registerFeed(string memory feedName) external",
    "function getActiveFeeds() external view returns (string[] memory)",
    "function getFeedInfo(string memory feedName) external view returns (string name, uint256 lastUpdate, uint256 totalUpdates, uint256 totalIOCs, bool active)",
    "function getFeedBatches(string memory feedName) external view returns (uint256[] memory)",
    "function feeds(string) external view returns (string name, uint256 lastUpdate, uint256 totalUpdates, uint256 totalIOCs, bool active)"
  ]
};

export const ORACLE_FEEDS = {
  AbuseIPDB: {
    icon: '🛡️',
    color: 'blue',
    description: 'IP addresses reported for malicious activity',
    website: 'https://www.abuseipdb.com',
    updateInterval: '6 hours'
  },
  URLhaus: {
    icon: '🔗',
    color: 'red',
    description: 'Malware distribution sites and malicious URLs',
    website: 'https://urlhaus.abuse.ch',
    updateInterval: '6 hours'
  },
  MalwareBazaar: {
    icon: '🦠',
    color: 'purple',
    description: 'Malware sample hashes and indicators',
    website: 'https://bazaar.abuse.ch',
    updateInterval: '12 hours'
  },
  PhishTank: {
    icon: '🎣',
    color: 'orange',
    description: 'Verified phishing websites and scam domains',
    website: 'https://www.phishtank.com',
    updateInterval: '12 hours'
  }
};
