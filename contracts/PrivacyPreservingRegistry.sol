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
        uint256 tier;
        bool isActive;
        uint256 joinedAt;
    }
    
    struct AnonymousContributor {
        uint256 submissionCount;
        uint256 acceptedSubmissions;
        uint256 reputationScore;
        uint256 tier;
        bool isActive;
        uint256 joinedAt;
    }
    
    struct CommunityFeedback {
        uint256 confirmations;
        uint256 disputes;
        mapping(address => bool) hasVoted;
    }
    
    Batch[] public batches;
    mapping(address => Contributor) public contributors;
    mapping(bytes32 => AnonymousContributor) public anonymousContributors;
    mapping(bytes32 => bool) public validCommitments;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(uint256 => CommunityFeedback) public communityFeedback;
    
    address public governance;
    
    // Tiered staking amounts
    uint256 public constant MICRO_STAKE = 0.01 ether;
    uint256 public constant STANDARD_STAKE = 0.05 ether;
    uint256 public constant PREMIUM_STAKE = 0.1 ether;
    
    // Admin reward system
    uint256 public constant SUBMISSION_FEE_PERCENT = 1;
    uint256 public adminRewardPool;
    
    uint256 public totalContributors;
    uint256 public totalAnonymousContributors;
    
    event BatchAdded(uint256 indexed index, string cid, bytes32 merkleRoot, bool isPublic, bytes32 contributorHash);
    event ContributorRegistered(address indexed contributor, uint256 stake, uint256 tier);
    event AnonymousContributorRegistered(bytes32 indexed commitment, uint256 stake, uint256 tier);
    event ReputationUpdated(bytes32 indexed contributorHash, uint256 newScore, bool isPublic);
    event ZKPCommitmentValidated(bytes32 indexed commitment, address validator);
    event NullifierUsed(bytes32 indexed nullifier);
    event ContributorSlashed(address indexed contributor, uint256 amount, string reason);
    event BatchConfirmed(uint256 indexed batchIndex, address indexed confirmer);
    event BatchDisputed(uint256 indexed batchIndex, address indexed disputer, string reason);
    event BatchFlaggedForReview(uint256 indexed batchIndex, string reason);
    event AdminRewardPoolUpdated(uint256 newBalance);
    
    constructor() Ownable(msg.sender) {}
    
    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }
    
    modifier onlyActiveContributor() {
        require(contributors[msg.sender].isActive, "Not active contributor");
        _;
    }
    
    // TIERED REGISTRATION - PUBLIC
    function registerContributor(uint256 tier) external payable {
        require(
            tier == MICRO_STAKE || tier == STANDARD_STAKE || tier == PREMIUM_STAKE,
            "Invalid tier: must be 0.01, 0.05, or 0.1 ETH"
        );
        require(msg.value >= tier, "Insufficient stake for selected tier");
        require(!contributors[msg.sender].isActive, "Already registered");
        
        contributors[msg.sender] = Contributor({
            submissionCount: 0,
            acceptedSubmissions: 0,
            reputationScore: 100,
            totalStaked: msg.value,
            tier: tier,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalContributors++;
        emit ContributorRegistered(msg.sender, msg.value, tier);
    }
    
    // TIERED REGISTRATION - ANONYMOUS
    function registerAnonymousContributor(
        bytes32 commitment,
        bytes memory zkpProof,
        uint256 tier
    ) external payable {
        require(
            tier == MICRO_STAKE || tier == STANDARD_STAKE || tier == PREMIUM_STAKE,
            "Invalid tier"
        );
        require(msg.value >= tier, "Insufficient stake");
        require(!validCommitments[commitment], "Commitment already used");
        require(verifyZKPCommitment(commitment, zkpProof), "Invalid ZKP proof");
        
        validCommitments[commitment] = true;
        anonymousContributors[commitment] = AnonymousContributor({
            submissionCount: 0,
            acceptedSubmissions: 0,
            reputationScore: 100,
            tier: tier,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalAnonymousContributors++;
        emit AnonymousContributorRegistered(commitment, msg.value, tier);
        emit ZKPCommitmentValidated(commitment, msg.sender);
    }
    
    // ENHANCED ANONYMOUS REGISTRATION WITH NULLIFIERS
    function registerAnonymousContributorEnhanced(
        bytes32 commitment,
        bytes32 nullifier,
        bytes memory zkpProof,
        uint256 tier
    ) external payable {
        require(
            tier == MICRO_STAKE || tier == STANDARD_STAKE || tier == PREMIUM_STAKE,
            "Invalid tier"
        );
        require(msg.value >= tier, "Insufficient stake");
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
            tier: tier,
            isActive: true,
            joinedAt: block.timestamp
        });
        
        totalAnonymousContributors++;
        emit AnonymousContributorRegistered(commitment, msg.value, tier);
        emit NullifierUsed(nullifier);
    }
    
    // BATCH SUBMISSION WITH 1% FEE
    function addBatch(
        string memory cid,
        bytes32 merkleRoot,
        bool isPublic,
        bytes32 zkpCommitment,
        bytes memory zkpProof
    ) public payable {
        bytes32 contributorHash;
        
        // Calculate 1% submission fee for admin reward pool
        uint256 estimatedGasCost = 200000 * tx.gasprice;
        uint256 submissionFee = (estimatedGasCost * SUBMISSION_FEE_PERCENT) / 100;
        require(msg.value >= submissionFee, "Insufficient submission fee");
        
        adminRewardPool += submissionFee;
        emit AdminRewardPoolUpdated(adminRewardPool);
        
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
    
    // TIER-BASED REPUTATION BOOST ON ACCEPTANCE
    function acceptBatch(uint256 batchIndex) external onlyGovernance {
        require(batchIndex < batches.length, "Invalid batch index");
        batches[batchIndex].accepted = true;
        
        Batch storage batch = batches[batchIndex];
        
        if (batch.isPublic) {
            address submitter = address(uint160(uint256(batch.contributorHash)));
            uint256 tier = contributors[submitter].tier;
            
            // Tier-based reputation boost
            uint256 reputationBonus;
            if (tier == PREMIUM_STAKE) {
                reputationBonus = 15;  // +50% bonus for Premium
            } else if (tier == STANDARD_STAKE) {
                reputationBonus = 10;  // Standard bonus
            } else {
                reputationBonus = 7;   // MICRO tier
            }
            
            contributors[submitter].acceptedSubmissions++;
            contributors[submitter].reputationScore += reputationBonus;
            emit ReputationUpdated(batch.contributorHash, contributors[submitter].reputationScore, true);
            
        } else {
            bytes32 commitment = batch.contributorHash;
            uint256 tier = anonymousContributors[commitment].tier;
            
            uint256 reputationBonus;
            if (tier == PREMIUM_STAKE) {
                reputationBonus = 15;
            } else if (tier == STANDARD_STAKE) {
                reputationBonus = 10;
            } else {
                reputationBonus = 7;
            }
            
            anonymousContributors[commitment].acceptedSubmissions++;
            anonymousContributors[commitment].reputationScore += reputationBonus;
            emit ReputationUpdated(commitment, anonymousContributors[commitment].reputationScore, false);
        }
    }
    
    // COMMUNITY CONFIRMATION SYSTEM
    function confirmBatch(uint256 batchIndex) external {
        require(batchIndex < batches.length, "Invalid batch index");
        require(batches[batchIndex].accepted, "Batch not approved yet");
        require(contributors[msg.sender].isActive, "Not registered");
        require(!communityFeedback[batchIndex].hasVoted[msg.sender], "Already voted");
        
        communityFeedback[batchIndex].hasVoted[msg.sender] = true;
        communityFeedback[batchIndex].confirmations++;
        
        // Small reputation reward for participation
        contributors[msg.sender].reputationScore += 1;
        
        emit BatchConfirmed(batchIndex, msg.sender);
    }
    
    function disputeBatch(uint256 batchIndex, string memory reason) external {
        require(batchIndex < batches.length, "Invalid batch index");
        require(batches[batchIndex].accepted, "Batch not approved yet");
        require(contributors[msg.sender].isActive, "Not registered");
        require(!communityFeedback[batchIndex].hasVoted[msg.sender], "Already voted");
        
        communityFeedback[batchIndex].hasVoted[msg.sender] = true;
        communityFeedback[batchIndex].disputes++;
        
        emit BatchDisputed(batchIndex, msg.sender, reason);
        
        // Flag for admin review if disputes exceed threshold
        if (communityFeedback[batchIndex].disputes >= 5) {
            emit BatchFlaggedForReview(batchIndex, "High dispute count");
        }
    }
    
    function getCommunityFeedback(uint256 batchIndex) external view returns (
        uint256 confirmations,
        uint256 disputes,
        uint256 ratio
    ) {
        CommunityFeedback storage feedback = communityFeedback[batchIndex];
        uint256 total = feedback.confirmations + feedback.disputes;
        uint256 approvalRatio = total > 0 ? (feedback.confirmations * 100) / total : 0;
        
        return (feedback.confirmations, feedback.disputes, approvalRatio);
    }
    
    // BAD ACTOR DETECTION
    function getBatchQualityScore(uint256 batchIndex) public view returns (uint256) {
        require(batchIndex < batches.length, "Invalid batch index");
        Batch storage batch = batches[batchIndex];
        CommunityFeedback storage feedback = communityFeedback[batchIndex];
        
        uint256 score = 100;
        
        // Factor 1: Community approval ratio
        uint256 totalVotes = feedback.confirmations + feedback.disputes;
        if (totalVotes > 0) {
            uint256 approvalRatio = (feedback.confirmations * 100) / totalVotes;
            if (approvalRatio < 50) score -= 30;
        }
        
        // Factor 2: False positive reports
        if (batch.falsePositiveReports > 5) score -= 20;
        
        // Factor 3: Confirmation count
        if (batch.confirmationCount < 2) score -= 10;
        
        return score;
    }
    
    function isContributorBadActor(address contributor) public view returns (bool) {
        Contributor storage c = contributors[contributor];
        
        // Criterion 1: Less than 50% acceptance rate
        uint256 acceptanceRate = c.submissionCount > 0 
            ? (c.acceptedSubmissions * 100) / c.submissionCount 
            : 100;
        
        if (acceptanceRate < 50 && c.submissionCount >= 5) {
            return true;
        }
        
        // Criterion 2: Reputation dropped below 50
        if (c.reputationScore < 50 && c.submissionCount > 0) {
            return true;
        }
        
        // Criterion 3: Multiple low-quality batches
        uint256 lowQualityCount = 0;
        for (uint256 i = 0; i < batches.length; i++) {
            if (batches[i].contributorHash == bytes32(uint256(uint160(contributor)))) {
                if (getBatchQualityScore(i) < 50) {
                    lowQualityCount++;
                }
            }
        }
        
        if (lowQualityCount >= 3) {
            return true;
        }
        
        return false;
    }
    
    // SLASHING FUNCTION
    function slashContributor(address contributor, uint256 amount) external onlyGovernance {
        require(contributors[contributor].isActive, "Not active contributor");
        require(contributors[contributor].totalStaked >= amount, "Insufficient stake");
        
        contributors[contributor].totalStaked -= amount;
        contributors[contributor].reputationScore = contributors[contributor].reputationScore > 30 
            ? contributors[contributor].reputationScore - 30 
            : 0;
        
        // Transfer slashed amount to governance for admin rewards
        payable(governance).transfer(amount);
        
        emit ContributorSlashed(contributor, amount, "Bad actor criteria met");
    }
    
    // TRANSFER ADMIN REWARD POOL TO GOVERNANCE
    function transferRewardsToGovernance(uint256 amount) external onlyGovernance {
        require(amount <= adminRewardPool, "Insufficient pool balance");
        
        adminRewardPool -= amount;
        payable(governance).transfer(amount);
    }
    
    // REPUTATION-BASED ACCESS TIERS
    function getAccessTier(address user) public view returns (string memory) {
        uint256 rep = contributors[user].reputationScore;
        
        if (rep >= 200) return "PLATINUM";
        if (rep >= 150) return "GOLD";
        if (rep >= 100) return "STANDARD";
        return "OBSERVER";
    }
    
    function getAccessTierAnonymous(bytes32 commitment) public view returns (string memory) {
        uint256 rep = anonymousContributors[commitment].reputationScore;
        
        if (rep >= 200) return "PLATINUM";
        if (rep >= 150) return "GOLD";
        if (rep >= 100) return "STANDARD";
        return "OBSERVER";
    }
    
    // VIEW HELPER FUNCTIONS
    function getTierName(uint256 tier) public pure returns (string memory) {
        if (tier == MICRO_STAKE) return "MICRO";
        if (tier == STANDARD_STAKE) return "STANDARD";
        if (tier == PREMIUM_STAKE) return "PREMIUM";
        return "UNKNOWN";
    }
    
    function getReputationBonus(address contributor) public view returns (uint256) {
        uint256 tier = contributors[contributor].tier;
        
        if (tier == PREMIUM_STAKE) return 15;
        if (tier == STANDARD_STAKE) return 10;
        return 7;
    }
    
    function getBatchesToPlatinum(address contributor) public view returns (uint256) {
        uint256 currentRep = contributors[contributor].reputationScore;
        if (currentRep >= 200) return 0;
        
        uint256 needed = 200 - currentRep;
        uint256 bonus = getReputationBonus(contributor);
        
        return (needed + bonus - 1) / bonus;
    }
    
    // VERIFICATION FUNCTIONS
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
    
    // QUERY FUNCTIONS
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
        uint256 tier,
        bool active,
        uint256 joinedAt
    ) {
        Contributor storage c = contributors[addr];
        return (
            c.submissionCount, 
            c.acceptedSubmissions, 
            c.reputationScore, 
            c.totalStaked, 
            c.tier,
            c.isActive, 
            c.joinedAt
        );
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
    
    function getAdminRewardPool() external view returns (uint256) {
        return adminRewardPool;
    }
}
