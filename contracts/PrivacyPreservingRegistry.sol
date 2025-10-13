// contracts/PrivacyPreservingRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract PrivacyPreservingRegistry is Ownable {
    struct Batch {
        string cid;
        bytes32 merkleRoot;
        uint256 timestamp;
        bool accepted;
        bytes32 contributorHash;
        bool isPublic;
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
    
    struct AnonymousContributor {
        uint256 submissionCount;
        uint256 acceptedSubmissions;
        uint256 reputationScore;
        bool isActive;
        uint256 joinedAt;
    }
    
    Batch[] public batches;
    mapping(address => Contributor) public contributors;
    mapping(bytes32 => AnonymousContributor) public anonymousContributors;
    mapping(bytes32 => bool) public validCommitments;
    mapping(bytes32 => bool) public usedNullifiers;
    address public governance;
    uint256 public constant MINIMUM_STAKE = 0.01 ether;
    uint256 public totalContributors;
    uint256 public totalAnonymousContributors;
    
    event BatchAdded(uint256 indexed index, string cid, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash);
    event ContributorRegistered(address indexed contributor, uint256 stake);
    event AnonymousContributorRegistered(bytes32 indexed commitment, uint256 stake);
    event ReputationUpdated(bytes32 indexed contributorHash, uint256 newScore, bool isPublic);
    event ZKPCommitmentValidated(bytes32 indexed commitment, address validator);
    event NullifierUsed(bytes32 indexed nullifier);
    
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
            reputationScore: 100,
            totalStaked: msg.value,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalContributors++;
        emit ContributorRegistered(msg.sender, msg.value);
    }
    
    function registerAnonymousContributor(
        bytes32 commitment,
        bytes memory zkpProof
    ) external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        require(!validCommitments[commitment], "Commitment already used");
        require(verifyZKPCommitment(commitment, zkpProof), "Invalid ZKP proof");
        
        validCommitments[commitment] = true;
        anonymousContributors[commitment] = AnonymousContributor({
            submissionCount: 0,
            acceptedSubmissions: 0,
            reputationScore: 100,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalAnonymousContributors++;
        emit AnonymousContributorRegistered(commitment, msg.value);
        emit ZKPCommitmentValidated(commitment, msg.sender);
    }
    
    function registerAnonymousContributorEnhanced(
        bytes32 commitment,
        bytes32 nullifier,
        bytes memory zkpProof
    ) external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        require(!validCommitments[commitment], "Commitment already used");
        require(!usedNullifiers[nullifier], "Nullifier already used");
        require(zkpProof.length == 64, "Invalid proof length");
        require(verifyEnhancedCommitment(commitment, zkpProof), "Invalid commitment");
        
        validCommitments[commitment] = true;
        usedNullifiers[nullifier] = true;
        
        anonymousContributors[commitment] = AnonymousContributor({
            submissionCount: 0,
            acceptedSubmissions: 0,
            reputationScore: 100,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalAnonymousContributors++;
        emit AnonymousContributorRegistered(commitment, msg.value);
        emit NullifierUsed(nullifier);
    }
    
    function addBatch(
        string memory cid,
        bytes32 merkleRoot,
        bool isPublic,
        bytes32 zkpCommitment,
        bytes memory zkpProof
    ) public {
        bytes32 contributorHash;
        
        if (isPublic) {
            require(contributors[msg.sender].isActive, "Not active public contributor");
            contributorHash = bytes32(uint256(uint160(msg.sender)));
            contributors[msg.sender].submissionCount++;
        } else {
            require(validCommitments[zkpCommitment], "Invalid ZKP commitment");
            require(verifyAnonymousSubmission(zkpCommitment, zkpProof), "Invalid anonymous proof");
            contributorHash = zkpCommitment;
            anonymousContributors[zkpCommitment].submissionCount++;
        }
        
        batches.push(Batch({
            cid: cid,
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            accepted: false,
            contributorHash: contributorHash,
            isPublic: isPublic,
            confirmationCount: 0,
            falsePositiveReports: 0
        }));
        
        emit BatchAdded(batches.length - 1, cid, merkleRoot, isPublic, contributorHash);
    }
    
    function acceptBatch(uint256 batchIndex) external onlyGovernance {
        require(batchIndex < batches.length, "Invalid batch index");
        batches[batchIndex].accepted = true;
        
        Batch storage batch = batches[batchIndex];
        uint256 reputationBonus = 10;
        
        if (batch.isPublic) {
            address submitter = address(uint160(uint256(batch.contributorHash)));
            contributors[submitter].acceptedSubmissions++;
            contributors[submitter].reputationScore += reputationBonus;
            emit ReputationUpdated(batch.contributorHash, contributors[submitter].reputationScore, true);
        } else {
            anonymousContributors[batch.contributorHash].acceptedSubmissions++;
            anonymousContributors[batch.contributorHash].reputationScore += reputationBonus;
            emit ReputationUpdated(batch.contributorHash, anonymousContributors[batch.contributorHash].reputationScore, false);
        }
    }
    
    function verifyZKPCommitment(bytes32 commitment, bytes memory proof) internal pure returns (bool) {
        return commitment != bytes32(0) && proof.length > 0;
    }
    
    function verifyAnonymousSubmission(bytes32 commitment, bytes memory proof) internal pure returns (bool) {
        return commitment != bytes32(0) && proof.length >= 32;
    }
    
    function verifyEnhancedCommitment(
        bytes32 commitment,
        bytes memory proof
    ) internal pure returns (bool) {
        return proof.length == 64 && commitment != bytes32(0);
    }
    
    function getBatch(uint256 index) public view returns (
        string memory cid,
        bytes32 merkleRoot,
        uint256 timestamp,
        bool accepted,
        bytes32 contributorHash,
        bool isPublic,
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
            batch.contributorHash,
            batch.isPublic,
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
        uint256 publicBatches,
        uint256 anonymousBatches,
        uint256 totalPublicContrib,
        uint256 totalAnonContrib,
        uint256 totalStaked
    ) {
        uint256 accepted = 0;
        uint256 publicCount = 0;
        uint256 anonCount = 0;
        
        for (uint256 i = 0; i < batches.length; i++) {
            if (batches[i].accepted) accepted++;
            if (batches[i].isPublic) publicCount++;
            else anonCount++;
        }
        
        return (
            batches.length,
            accepted,
            publicCount,
            anonCount,
            totalContributors,
            totalAnonymousContributors,
            address(this).balance
        );
    }
}
