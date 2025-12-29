// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrivacyPreservingRegistry.sol";

/// @title PrivacyPreservingRegistryL1
/// @notice L1-only variant that stores plaintext IPFS CIDs on-chain so the UI can retrieve
///         them via a view call (no eth_getLogs dependency).
///
/// Rationale:
/// - The base PrivacyPreservingRegistry stores only cidCommitment in storage.
/// - The UI historically relied on BatchAdded logs to recover the CID string.
/// - Some RPCs (and some environments) make log queries unreliable/slow.
/// - On L1 Sepolia (low volume, cheap enough) it's acceptable to store CIDs for UX.
///
/// Compatibility:
/// - Does NOT change the existing Batch struct in the base contract.
/// - Keeps emitting BatchAdded with the CID.
/// - Adds a new view: getBatchCID(batchIndex) -> string.
contract PrivacyPreservingRegistryL1 is PrivacyPreservingRegistry {
    // batchIndex => plaintext IPFS CID (e.g., Qm...)
    mapping(uint256 => string) private batchCids;

    /// @notice Returns the plaintext CID for a batch if known.
    /// @dev Reverts if the index is out of range; returns "" if batch existed before
    ///      this mapping was populated.
    function getBatchCID(uint256 index) external view returns (string memory) {
        require(index < batches.length, "Invalid batch index");
        return batchCids[index];
    }

    /// @notice Override addBatch to additionally store the CID string for L1 UX.
    function addBatch(
        string memory cid,
        bytes32 merkleRoot,
        bool isPublic,
        bytes32 zkpCommitment,
        bytes memory zkpProof
    ) public payable override {
        super.addBatch(cid, merkleRoot, isPublic, zkpCommitment, zkpProof);
        batchCids[batches.length - 1] = cid;
    }
}
