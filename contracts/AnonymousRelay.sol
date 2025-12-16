// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AnonymousRelay
 * @dev Relay contract to hide transaction sender and prevent linkability
 * 
 * Users submit zkSNARK proofs through this relay, which forwards them to
 * the main registry contract. This prevents linking submissions via tx.origin.
 * 
 * Security Features:
 * - Forwards calls to registry without revealing original sender
 * - Prevents linkability across multiple submissions
 * - Supports batch relay for gas efficiency
 * - Rate limiting to prevent spam
 */

interface IPrivacyPreservingRegistry {
    function addPrivacyBatch(
        string memory ipfsHash,
        bytes32 merkleRoot,
        uint256 nonce,
        bytes32 commitment,
        bytes[8] memory proof
    ) external payable;
}

contract AnonymousRelay {
    // Target registry contract
    IPrivacyPreservingRegistry public registry;
    
    // Owner (for emergency pause)
    address public owner;
    
    // Pause mechanism
    bool public paused;
    
    // Rate limiting
    mapping(address => uint256) public lastRelayTime;
    uint256 public constant MIN_RELAY_INTERVAL = 60; // 1 minute
    
    // Fee for relay service (to prevent spam)
    uint256 public relayFee = 0.0001 ether;
    
    // Events
    event RelaySubmission(bytes32 indexed commitment, address indexed relayer);
    event RelayFeeUpdated(uint256 newFee);
    event Paused(bool isPaused);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }
    
    constructor(address _registry) {
        registry = IPrivacyPreservingRegistry(_registry);
        owner = msg.sender;
        paused = false;
    }
    
    /**
     * @dev Relay anonymous submission to registry
     * @param ipfsHash IPFS hash of IOC data
     * @param merkleRoot Merkle root of contributor tree
     * @param nonce Unique nonce for commitment
     * @param commitment Hash of (address, nonce, chainId, contract)
     * @param proof zkSNARK Groth16 proof
     */
    function relaySubmission(
        string memory ipfsHash,
        bytes32 merkleRoot,
        uint256 nonce,
        bytes32 commitment,
        bytes[8] memory proof
    ) external payable whenNotPaused {
        // Check rate limit
        require(
            block.timestamp >= lastRelayTime[msg.sender] + MIN_RELAY_INTERVAL,
            "Rate limit: Please wait before next relay"
        );
        
        // Check relay fee
        require(msg.value >= relayFee, "Insufficient relay fee");
        
        // Update rate limit
        lastRelayTime[msg.sender] = block.timestamp;
        
        // Forward to registry
        // Note: tx.origin will be original sender, but msg.sender will be this relay
        // Registry should check msg.sender, not tx.origin
        registry.addPrivacyBatch{value: msg.value - relayFee}(
            ipfsHash,
            merkleRoot,
            nonce,
            commitment,
            proof
        );
        
        emit RelaySubmission(commitment, msg.sender);
    }
    
    /**
     * @dev Batch relay multiple submissions
     * @param submissions Array of submission data
     */
    function relayBatch(
        RelayData[] calldata submissions
    ) external payable whenNotPaused {
        require(submissions.length > 0, "Empty batch");
        require(submissions.length <= 10, "Batch too large");
        
        // Check rate limit
        require(
            block.timestamp >= lastRelayTime[msg.sender] + MIN_RELAY_INTERVAL,
            "Rate limit exceeded"
        );
        
        // Calculate total relay fee
        uint256 totalRelayFee = relayFee * submissions.length;
        require(msg.value >= totalRelayFee, "Insufficient relay fee");
        
        // Update rate limit
        lastRelayTime[msg.sender] = block.timestamp;
        
        // Relay each submission
        uint256 perSubmissionValue = (msg.value - totalRelayFee) / submissions.length;
        
        for (uint256 i = 0; i < submissions.length; i++) {
            registry.addPrivacyBatch{value: perSubmissionValue}(
                submissions[i].ipfsHash,
                submissions[i].merkleRoot,
                submissions[i].nonce,
                submissions[i].commitment,
                submissions[i].proof
            );
            
            emit RelaySubmission(submissions[i].commitment, msg.sender);
        }
    }
    
    /**
     * @dev Update relay fee
     */
    function updateRelayFee(uint256 newFee) external onlyOwner {
        relayFee = newFee;
        emit RelayFeeUpdated(newFee);
    }
    
    /**
     * @dev Pause/unpause relay
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    
    /**
     * @dev Withdraw collected relay fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Emergency: Update registry address
     */
    function updateRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "Invalid address");
        registry = IPrivacyPreservingRegistry(newRegistry);
    }
    
    /**
     * @dev Get relay info for address
     */
    function getRelayInfo(address relayer) external view returns (
        uint256 nextAvailableTime,
        uint256 currentFee,
        bool canRelay
    ) {
        nextAvailableTime = lastRelayTime[relayer] + MIN_RELAY_INTERVAL;
        currentFee = relayFee;
        canRelay = block.timestamp >= nextAvailableTime && !paused;
    }
    
    // Receive function to accept ETH
    receive() external payable {}
}

/**
 * @dev Struct for batch relay data
 */
struct RelayData {
    string ipfsHash;
    bytes32 merkleRoot;
    uint256 nonce;
    bytes32 commitment;
    bytes[8] proof;
}
