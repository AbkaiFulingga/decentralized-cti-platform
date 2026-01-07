// scripts/register-admin3-as-contributor.js
// Register Admin3 as contributor if not already active.
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Registering Admin 3 as Contributor (STANDARD 0.05 ETH) ===\n");

  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  const testDataFile = chainId === "421614" ? "test-addresses-arbitrum.json" : "test-addresses.json";
  const testData = JSON.parse(fs.readFileSync(testDataFile, "utf8"));

  const registry = await hre.ethers.getContractAt(
    "PrivacyPreservingRegistry",
    testData.PrivacyPreservingRegistry
  );

  const signers = await hre.ethers.getSigners();
  if (signers.length < 3) {
    throw new Error(
      "Hardhat has <3 signers for this network. Make sure PRIVATE_KEY_ADMIN1/2/3 are set in .env"
    );
  }

  const admin3 = signers[2];
  console.log("Admin 3:", admin3.address);
  console.log("Network:", chainId === "421614" ? "Arbitrum Sepolia" : "Ethereum Sepolia");

  const contributor = await registry.contributors(admin3.address);
  const isActive = Boolean(contributor?.[5]);

  if (isActive) {
    console.log("✅ Already registered");
    console.log("  Submissions:", contributor?.[0]?.toString?.() ?? String(contributor?.[0]));
    console.log("  Reputation:", contributor?.[2]?.toString?.() ?? String(contributor?.[2]));
    console.log("  Tier:", hre.ethers.formatEther(contributor?.[4] ?? 0n), "ETH");
    return;
  }

  const stake = hre.ethers.parseEther("0.05");
  console.log("\nRegistering as STANDARD contributor (0.05 ETH)...");

  const tx = await registry.connect(admin3).registerContributor(stake, { value: stake });
  console.log("Tx:", tx.hash);
  await tx.wait();

  console.log("✅ Admin 3 registered as contributor");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
