// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IPrivacyPreservingRegistry {
    function addBatch(
        string memory cid,
        bytes32 merkleRoot,
        bool isPublic,
        bytes32 zkpCommitment,
        bytes memory zkpProof
    ) external payable;
}

contract MerkleZKRegistry is Ownable {
    IPrivacyPreservingRegistry public mainRegistry;
    
    // Merkle root of all registered contributors
    bytes32 public contributorMerkleRoot;
    uint256 public lastRootUpdate;
    uint256 public contributorCount;
    
    // Prevent commitment reuse (replay attack protection)
    mapping(bytes32 => bool) public usedCommitments;
    
    // Track anonymous submissions
    uint256 public totalAnonymousSubmissions;
    mapping(uint256 => bytes32) public submissionCommitments;
    
    event ContributorRootUpdated(bytes32 indexed newRoot, uint256 contributorCount, uint256 timestamp);
    event AnonymousSubmission(bytes32 indexed commitment, uint256 submissionId, uint256 anonymitySetSize);
    event CommitmentUsed(bytes32 indexed commitment);
    
    constructor(address _registry) Ownable(msg.sender) {
        mainRegistry = IPrivacyPreservingRegistry(_registry);
    }
    
    /**
     * @notice Update the Merkle root of registered contributors
     * @dev Called by backend cron job daily
     * @param newRoot New Merkle root containing all contributor addresses
     * @param count Total number of contributors in tree
     */
    function updateContributorRoot(bytes32 newRoot, uint256 count) external onlyOwner {
        require(newRoot != bytes32(0), "Invalid root");
        require(count > 0, "Empty contributor set");
        
        contributorMerkleRoot = newRoot;
        contributorCount = count;
        lastRootUpdate = block.timestamp;
        
        emit ContributorRootUpdated(newRoot, count, block.timestamp);
    }
    
    /**
     * @notice Submit a batch anonymously with zero-knowledge proof
     * @param cid IPFS content identifier
     * @param batchMerkleRoot Merkle root of IOCs in batch
     * @param commitment Unique commitment (keccak256(address + secret + timestamp))
     * @param contributorProof Merkle proof showing contributor is in registered set
     * @param contributorLeaf The leaf being proven (keccak256(address))
     */
    function submitBatchAnonymous(
        string memory cid,
        bytes32 batchMerkleRoot,
        bytes32 commitment,
        bytes32[] memory contributorProof,
        bytes32 contributorLeaf
    ) external payable {
        // 1. Verify contributor Merkle root exists
        require(contributorMerkleRoot != bytes32(0), "Contributor tree not initialized");
        require(lastRootUpdate > 0, "Tree never updated");
        
        // 2. Verify commitment is unique (prevent replay attacks)
        require(!usedCommitments[commitment], "Commitment already used");
        
        // 3. Verify contributor is in the registered set via Merkle proof
        require(
            MerkleProof.verify(contributorProof, contributorMerkleRoot, contributorLeaf),
            "Invalid contributor proof - not in registered set"
        );
        
        // 4. Mark commitment as used
        usedCommitments[commitment] = true;
        emit CommitmentUsed(commitment);
        
        // 5. Forward to main registry (no stake required, already registered)
        mainRegistry.addBatch{value: msg.value}(
            cid,
            batchMerkleRoot,
            false,  // isPublic = false (anonymous)
            commitment,
            abi.encodePacked(contributorProof)  // Store proof for verification
        );
        
        // 6. Track for analytics
        uint256 submissionId = totalAnonymousSubmissions++;
        submissionCommitments[submissionId] = commitment;
        
        emit AnonymousSubmission(commitment, submissionId, contributorCount);
    }
    
    /**
     * @notice Verify an anonymous submission's proof (anyone can verify legitimacy)
     * @param contributorProof Merkle proof
     * @param contributorLeaf Leaf being proven
     * @return bool True if proof is valid
     */
    function verifyAnonymousContributor(
        bytes32[] memory contributorProof,
        bytes32 contributorLeaf
    ) external view returns (bool) {
        return MerkleProof.verify(contributorProof, contributorMerkleRoot, contributorLeaf);
    }
    
    /**
     * @notice Get tree freshness information
     * @return age Time since last update in seconds
     * @return isStale True if tree is older than 48 hours
     */
    function getTreeFreshness() external view returns (uint256 age, bool isStale) {
        age = block.timestamp - lastRootUpdate;
        isStale = age > 48 hours;
    }
    
    /**
     * @notice Get anonymity set size
     * @return uint256 Number of contributors in current tree
     */
    function getAnonymitySetSize() external view returns (uint256) {
        return contributorCount;
    }
    
    /**
     * @notice Get total anonymous submissions made through this contract
     * @return uint256 Total count
     */
    function getTotalAnonymousSubmissions() external view returns (uint256) {
        return totalAnonymousSubmissions;
    }
    
    // Emergency pause if tree is compromised
    bool public paused;
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
}
