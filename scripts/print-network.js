const hre = require("hardhat");

async function main() {
  console.log("hre.network.name:", hre.network.name);
  console.log("hre.network.config.url:", hre.network.config && hre.network.config.url);

  const net = await hre.ethers.provider.getNetwork();
  console.log("provider chainId:", net.chainId.toString());

  // Helpful sanity check: is provider connected to an RPC or the in-memory hardhat network?
  const block = await hre.ethers.provider.getBlockNumber();
  console.log("blockNumber:", block);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
