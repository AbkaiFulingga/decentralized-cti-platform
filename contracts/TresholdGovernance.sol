// contracts/ThresholdGovernance.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEnhancedRegistry {
    function acceptBatch(uint256 batchIndex) external;
    function slashContributor(address contributor, uint256 amount) external;
}

contract ThresholdGovernance {
    struct BatchApproval {
        uint256 approvalCount;
        mapping(address => bool) hasApproved;
        bool executed;
        uint256 createdAt;
    }
    
    mapping(address => bool) public admins;
    mapping(uint256 => BatchApproval) public batchApprovals;
    address public registry;
    uint256 public threshold; // How many approvals needed
    uint256 public adminCount;
    uint256 public constant APPROVAL_TIMEOUT = 7 days;
    
    event BatchApproved(uint256 indexed batchIndex, address indexed admin);
    event BatchExecuted(uint256 indexed batchIndex);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event SlashExecuted(address indexed contributor, uint256 amount);
    
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }
    
    constructor(address[] memory _admins, uint256 _threshold, address _registry) {
        require(_threshold <= _admins.length && _threshold > 0, "Invalid threshold");
        require(_admins.length > 0, "Need at least one admin");
        
        for (uint i = 0; i < _admins.length; i++) {
            require(_admins[i] != address(0), "Invalid admin address");
            admins[_admins[i]] = true;
        }
        adminCount = _admins.length;
        threshold = _threshold;
        registry = _registry;
    }
    
    function approveBatch(uint256 batchIndex) external onlyAdmin {
        BatchApproval storage approval = batchApprovals[batchIndex];
        
        // Initialize if first approval
        if (approval.createdAt == 0) {
            approval.createdAt = block.timestamp;
        }
        
        require(!approval.hasApproved[msg.sender], "Already approved");
        require(!approval.executed, "Already executed");
        require(block.timestamp <= approval.createdAt + APPROVAL_TIMEOUT, "Approval timeout");
        
        approval.hasApproved[msg.sender] = true;
        approval.approvalCount++;
        
        emit BatchApproved(batchIndex, msg.sender);
        
        // Auto-execute if threshold reached
        if (approval.approvalCount >= threshold) {
            approval.executed = true;
            IEnhancedRegistry(registry).acceptBatch(batchIndex);
            emit BatchExecuted(batchIndex);
        }
    }
    
    function slashContributor(address contributor, uint256 amount) external onlyAdmin {
        require(contributor != address(0), "Invalid contributor");
        require(amount > 0, "Amount must be positive");
        
        IEnhancedRegistry(registry).slashContributor(contributor, amount);
        emit SlashExecuted(contributor, amount);
    }
    
    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        require(!admins[newAdmin], "Already admin");
        
        admins[newAdmin] = true;
        adminCount++;
        emit AdminAdded(newAdmin);
    }
    
    function removeAdmin(address admin) external onlyAdmin {
        require(admins[admin], "Not admin");
        require(adminCount > threshold, "Cannot remove, would break threshold");
        
        admins[admin] = false;
        adminCount--;
        emit AdminRemoved(admin);
    }
    
    function getBatchApprovalStatus(uint256 batchIndex) 
        external view returns (uint256 approvals, bool executed, uint256 createdAt) {
        BatchApproval storage approval = batchApprovals[batchIndex];
        return (approval.approvalCount, approval.executed, approval.createdAt);
    }
    
    function updateThreshold(uint256 newThreshold) external onlyAdmin {
        require(newThreshold > 0 && newThreshold <= adminCount, "Invalid threshold");
        threshold = newThreshold;
    }
}
