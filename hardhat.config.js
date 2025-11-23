// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: false
    }
  },
  
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
      chainId: 11155111,
      accounts: [
        process.env.PRIVATE_KEY_ADMIN1,
        process.env.PRIVATE_KEY_ADMIN2,
        process.env.PRIVATE_KEY_ADMIN3
      ].filter(key => key !== undefined),
      timeout: 60000,
      gasPrice: 20000000000, // 20 Gwei
      gas: 5000000,
      httpHeaders: {
        "User-Agent": "hardhat"
      }
    },
    
    arbitrumSepolia: {
      url: process.env.ARBITRUM_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: [
        process.env.PRIVATE_KEY_ADMIN1,
        process.env.PRIVATE_KEY_ADMIN2,
        process.env.PRIVATE_KEY_ADMIN3
      ].filter(key => key !== undefined),
      timeout: 60000,
      gasPrice: 100000000, // 0.1 Gwei
      gas: 5000000
    }
  },
  
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      }
    ]
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  mocha: {
    timeout: 40000
  }
};
