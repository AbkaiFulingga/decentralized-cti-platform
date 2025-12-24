// utils/constants.js

export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/OJZ2zwAbqwG_YYm9N6vuj",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "Sepolia ETH",
      symbol: "ETH",
      decimals: 18
    },
    contracts: {
      registry: "0xea816C1B93F5d76e03055BFcFE2ba5645341e09E",  // ✅ CORRECT - from test-addresses.json
      governance: "0xfE4aDfFA3C1d855b21161B1f38167eC5c3C0d919",  // ✅ CORRECT - from test-addresses.json
      storage: "0x6032c74688Be90A9E91d770bCe2d5D07d219ebDd"      // ✅ CORRECT - from test-addresses.json
    },
    gasPrice: 20,
    gasPriceUnit: "Gwei"
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerUrl: "https://sepolia.arbiscan.io",
    nativeCurrency: {
      name: "Arbitrum ETH",
      symbol: "ETH",
      decimals: 18
    },
    contracts: {
      registry: "0xC40827e7dF3a26dFfb7fd2B9FbEB6b3e964599AD", // zkSNARK registry (Dec 19 2025) - HAS 2 BATCHES
      governance: "0x1cB4Ac87e58a6a4865BD9e68C2042e90D8c372A0",
      storage: "0x3BC9a984DF09b5e4CFDFA88da4F3CDBAff7CB7cd",
      merkleZK: "0x8582cf2D5314781d04e7b35e7e553fC9dA14Ac61",
      oracleFeed: "0xbdFcBE759232c9435FB4AdfF937A6173B5b904bE"
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
