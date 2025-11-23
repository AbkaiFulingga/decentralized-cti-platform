// components/config.js

// Contract addresses - UPDATE HERE after redeployment
export const CONTRACT_ADDRESSES = {
  registryAddress: "0x708745e9fFdAc7Be01936a7cBBaF991520631288",
  governanceAddress: "0xf5DBEE3d9c710f1a5108700C57D67306C847fBcC"
};

// Network configuration
export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/...",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "Sepolia ETH",
      symbol: "ETH",
      decimals: 18
    }
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    nativeCurrency: {
      name: "Arbitrum ETH",
      symbol: "ETH",
      decimals: 18
    }
  }
};

// Admin addresses
export const ADMIN_ADDRESSES = [
  "0x26337D3C3C26979ABD78A0209eF1b9372f6EAe82",
  "0xf78afa5E41eDF35c05c1aEB082C1789283b09d3B",
  "0x0D5CaD75D37adA5A81EbEe04387229a40B0a457f"
];

// Governance threshold
export const GOVERNANCE_THRESHOLD = 2;

// IPFS gateways
export const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/"
];
