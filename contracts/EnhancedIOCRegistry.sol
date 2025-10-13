// contracts/EnhancedIOCRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract EnhancedIOCRegistry is Ownable {
    struct Batch {
        string cid;
        bytes32 merkleRoot;
        uint256 timestamp;
        bool accepted;
        address submitter;
        uint256 confirmationCount;
        uint256 falsePositiveReports;
    }
    
    struct Contributor {
        uint256 submissionCount;
        uint256 acceptedSubmissions;
        uint256 reputationScore;
        uint256 totalStaked;
        bool isActive;
        uint256 joinedAt;
    }
    
    Batch[] public batches;
    mapping(address => Contributor) public contributors;
    address public governance;
    uint256 public constant MINIMUM_STAKE = 0.01 ether;
    uint256 public totalContributors;
    
    event BatchAdded(uint256 indexed index, string cid, bytes32 merkleRoot, address submitter);
    event ContributorRegistered(address indexed contributor, uint256 stake);
    event ReputationUpdated(address indexed contributor, uint256 newScore);
    event BatchConfirmed(uint256 indexed batchIndex, address indexed confirmer);
    event FalsePositiveReported(uint256 indexed batchIndex, address indexed reporter);
    
    constructor() Ownable(msg.sender) {}
    
    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }
    
    modifier onlyActiveContributor() {
        require(contributors[msg.sender].isActive, "Not active contributor");
        _;
    }
    
    function registerContributor() external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        require(!contributors[msg.sender].isActive, "Already registered");
        
        contributors[msg.sender] = Contributor({
            submissionCount: 0,
            acceptedSubmissions: 0,
            reputationScore: 100, // Starting reputation
            totalStaked: msg.value,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalContributors++;
        emit ContributorRegistered(msg.sender, msg.value);
    }
    
    function addBatch(string memory cid, bytes32 merkleRoot) public onlyActiveContributor {
        batches.push(Batch({
            cid: cid,
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            accepted: false,
            submitter: msg.sender,
            confirmationCount: 0,
            falsePositiveReports: 0
        }));
        
        contributors[msg.sender].submissionCount++;
        emit BatchAdded(batches.length - 1, cid, merkleRoot, msg.sender);
    }
    
    function acceptBatch(uint256 batchIndex) external onlyGovernance {
        require(batchIndex < batches.length, "Invalid batch index");
        batches[batchIndex].accepted = true;
        
        // Update contributor reputation
        address submitter = batches[batchIndex].submitter;
        contributors[submitter].acceptedSubmissions++;
        contributors[submitter].reputationScore += 10;
        
        emit ReputationUpdated(submitter, contributors[submitter].reputationScore);
    }
    
    function getBatch(uint256 index) public view returns (
        string memory cid,
        bytes32 merkleRoot,
        uint256 timestamp,
        bool accepted,
        address submitter,
        uint256 confirmations,
        uint256 falsePositives
    ) {
        require(index < batches.length, "Invalid batch index");
        Batch storage batch = batches[index];
        return (
            batch.cid,
            batch.merkleRoot,
            batch.timestamp,
            batch.accepted,
            batch.submitter,
            batch.confirmationCount,
            batch.falsePositiveReports
        );
    }
    
    function getContributor(address addr) external view returns (
        uint256 submissions,
        uint256 accepted,
        uint256 reputation,
        uint256 staked,
        bool active,
        uint256 joinedAt
    ) {
        Contributor storage c = contributors[addr];
        return (c.submissionCount, c.acceptedSubmissions, c.reputationScore, c.totalStaked, c.isActive, c.joinedAt);
    }
    
    function getBatchCount() public view returns (uint256) {
        return batches.length;
    }
    
    function verifyIOC(uint256 batchIndex, bytes32 leaf, bytes32[] calldata proof) public view returns (bool) {
        require(batchIndex < batches.length, "Invalid batch index");
        return MerkleProof.verify(proof, batches[batchIndex].merkleRoot, leaf);
    }
    
    function setGovernance(address _gov) external onlyOwner {
        governance = _gov;
    }
    
    function getPlatformStats() external view returns (
        uint256 totalBatches,
        uint256 totalAccepted,
        uint256 totalContrib,
        uint256 totalStaked
    ) {
        uint256 accepted = 0;
        for (uint256 i = 0; i < batches.length; i++) {
            if (batches[i].accepted) accepted++;
        }
        
        return (batches.length, accepted, totalContributors, address(this).balance);
    }
}
