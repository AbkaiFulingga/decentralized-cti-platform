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
      registry: "0xB490aBfFf0639453a8A5e5e52BF4E8055269cfE4",
      governance: "0x1D9c49C737fE587bdBCE7a2a3e04293004216e18",
      storage: "0x174d2a6FF20Bb0928B9e39BE8F65d823db73c983"
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
      registry: "0x70Fa3936b036c62341f8F46DfF0bC45389e4dC44", // NEW: Latest deployment with ZKP fix
      governance: "0xa186FEE32e311f65C55612fc98195B27113d1e48", // NEW: Latest deployment
      storage: "0xBBCC5a5c29Fbf3aB8B97a4869871C70fADE6C0Cd", // NEW: Latest deployment
      merkleZK: "0x22f2060fbe50403e588d70156776F72ab060Ab9c", // NEW: Redeployed, linked to correct Registry
      oracleFeed: "0xbdFcBE759232c9435FB4AdfF937A6173B5b904bE" // SAME: Existing Oracle
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
    "function acceptBatch(uint256 batchIndex) external",
    "function getBatch(uint256 index) public view returns (string, bytes32, uint256, bool, bytes32, bool, uint256, uint256)",
    "function getBatchCount() public view returns (uint256)",
    "function contributors(address) external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256)",
    "function getPlatformStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
    "function verifyIOC(uint256 batchIndex, bytes32 leaf, bytes32[] calldata proof) public view returns (bool)",
    "function confirmBatch(uint256 batchIndex) external",
    "function disputeBatch(uint256 batchIndex) external",
    "function MICRO_STAKE() external view returns (uint256)",
    "function STANDARD_STAKE() external view returns (uint256)",
    "function PREMIUM_STAKE() external view returns (uint256)"
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
