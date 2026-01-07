const hre = require("hardhat");

async function main() {
  const a = require("../test-addresses-arbitrum.json");
  const registryAddress = a.PrivacyPreservingRegistry;
  if (!registryAddress) throw new Error('Missing PrivacyPreservingRegistry in test-addresses-arbitrum.json');

  const registry = await hre.ethers.getContractAt("PrivacyPreservingRegistry", registryAddress);
  const zkVerifierAddress = await registry.zkVerifier();
  const zk = await hre.ethers.getContractAt("ZKVerifier", zkVerifierAddress);

  const net = await hre.ethers.provider.getNetwork();
  console.log("chainId:", net.chainId.toString());
  console.log("registry:", registryAddress);
  console.log("zkVerifier (from registry):", zkVerifierAddress);

  const current = await zk.currentMerkleRoot();
  console.log("currentMerkleRoot:", current.toString());

  // Known roots: print validity
  const roots = [
    current,
    // possible demo roots (as uint256)
    0x7b64f8b7caae2d5ddd3a9c061d1a0ac7e5cfb63b41d974456aa754152812e19n,
    0x1e1785ccddaa68c0e25b32d994b4f50dad1aaeda1a64f6a12c569b3c8a4a15cen
  ];

  for (const r of roots) {
    const ok = await zk.isMerkleRootValid(r);
    console.log("isValid", "0x" + r.toString(16), ":", ok);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
