// scripts/proposeAndVote.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const { IOCRegistryMerkle, Governance } = JSON.parse(
    fs.readFileSync("deployedAddress.json", "utf8")
  );

  const [a, b, c] = await hre.ethers.getSigners();

  const gov = await hre.ethers.getContractAt("Governance", Governance);
  const registry = await hre.ethers.getContractAt("IOCRegistryMerkle", IOCRegistryMerkle);

  const count = Number(await registry.getBatchCount());
  if (count === 0) {
    console.log("No batches in registry. Please run addBatch.js first.");
    return;
  }

  const batchIndex = 0;
  const govAsA = gov.connect(a);

  console.log("Creating proposal on batch", batchIndex);
  const tx = await govAsA.createProposal(batchIndex);
  const rc = await tx.wait();

  // debug: print all logs
  console.log("Tx events:", rc.events);

  let pid;
  if (rc.events) {
    const ev = rc.events.find(e => e.event === "ProposalCreated");
    if (ev && ev.args) {
      pid = Number(ev.args[0]);
    }
  }

  if (pid === undefined) {
    console.log("No ProposalCreated event found. Falling back to pid=0");
    pid = 0;
  }

  console.log("Proposal created id:", pid);

  const govAsB = gov.connect(b);
  await (await govAsB.vote(pid, true)).wait();
  console.log("Member B voted for");

  const govAsC = gov.connect(c);
  await (await govAsC.vote(pid, true)).wait();
  console.log("Member C voted for");

  await hre.network.provider.send("evm_increaseTime", [70]);
  await hre.network.provider.send("evm_mine", []);

  await (await govAsA.finalizeProposal(pid)).wait();
  console.log("Proposal finalized");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
