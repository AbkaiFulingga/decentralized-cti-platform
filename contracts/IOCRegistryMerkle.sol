// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract IOCRegistryMerkle is Ownable {
    struct Batch {
        string cid;
        bytes32 merkleRoot;
        uint256 timestamp;
        bool accepted;
    }

    Batch[] public batches;
    address public governance;

    event BatchAdded(uint256 indexed index, string cid, bytes32 merkleRoot, uint256 timestamp);
    event GovernanceUpdated(address governance);

    // ✅ Add constructor to satisfy Ownable
    constructor() Ownable(msg.sender) {}

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }

    function setGovernance(address _gov) external onlyOwner {
        governance = _gov;
        emit GovernanceUpdated(_gov);
    }

    function addBatch(string memory cid, bytes32 merkleRoot) public {
        batches.push(Batch({
            cid: cid,
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            accepted: false
        }));
        emit BatchAdded(batches.length - 1, cid, merkleRoot, block.timestamp);
    }

    function getBatchCount() public view returns (uint256) {
        return batches.length;
    }

    function getBatch(uint256 index) public view returns (string memory, bytes32, uint256, bool) {
        require(index < batches.length, "Invalid batch index");
        Batch storage batch = batches[index];
        return (batch.cid, batch.merkleRoot, batch.timestamp, batch.accepted);
    }

    function verifyIOC(uint256 batchIndex, bytes32 leaf, bytes32[] calldata proof) public view returns (bool) {
        require(batchIndex < batches.length, "Invalid batch index");
        return MerkleProof.verify(proof, batches[batchIndex].merkleRoot, leaf);
    }

    function acceptBatch(uint256 batchIndex) external onlyGovernance {
        require(batchIndex < batches.length, "Invalid batch index");
        batches[batchIndex].accepted = true;
    }
}
