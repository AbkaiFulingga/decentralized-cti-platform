const hre = require("hardhat");

async function main() {
  const a = require("../test-addresses-arbitrum.json");
  const addrs = {
    registry: a.PrivacyPreservingRegistry,
    governance: a.ThresholdGovernance,
    storage: a.StorageContribution,
    merkleZK: a.MerkleZKRegistry,
    zkVerifier: a.zkVerifier,
    groth16Verifier: a.groth16Verifier
  };

  const net = await hre.ethers.provider.getNetwork();
  console.log("chainId:", net.chainId.toString());

  for (const [name, addr] of Object.entries(addrs)) {
    const code = await hre.ethers.provider.getCode(addr);
    console.log(`${name}: ${addr} codeLen=${code.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
