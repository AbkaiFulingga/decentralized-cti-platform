require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: [
        process.env.PRIVATE_KEY_ADMIN1,
        process.env.PRIVATE_KEY_ADMIN2
      ].filter(key => key !== undefined)
    }
  }
};
