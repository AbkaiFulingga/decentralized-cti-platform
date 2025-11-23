// contracts/StorageContribution.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRegistry {
    function contributors(address) external view returns (uint256, uint256, uint256, uint256, uint256, bool, uint256);
}

contract StorageContribution {
    struct StorageProvider {
        uint256 collateral;
        uint256 claimedStorageGB;
        uint256 reputationEarned;
        uint256 lastProofTimestamp;
        bool verified;
        string[] pinnedCIDs;
    }
    
    mapping(address => StorageProvider) public storageProviders;
    address public registry;
    address public governance;
    
    uint256 public constant STORAGE_REWARD_MONTHLY = 5;
    uint256 public constant COLLATERAL_PER_GB = 0.0001 ether;
    uint256 public constant MIN_STORAGE_COMMITMENT = 5;
    uint256 public constant MIN_COMMITMENT_PERIOD = 180 days;
    
    event StorageProviderRegistered(address indexed provider, uint256 storageGB, uint256 collateral);
    event StorageProofSubmitted(address indexed provider, string[] cids);
    event StorageVerified(address indexed provider);
    event ReputationRewarded(address indexed provider, uint256 amount);
    event CollateralWithdrawn(address indexed provider, uint256 amount);
    
    constructor(address _registry, address _governance) {
        registry = _registry;
        governance = _governance;
    }
    
    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }
    
    function registerStorageProvider(uint256 storageGB) external payable {
        require(storageGB >= MIN_STORAGE_COMMITMENT, "Minimum 5GB required");
        uint256 requiredCollateral = storageGB * COLLATERAL_PER_GB;
        require(msg.value >= requiredCollateral, "Insufficient collateral");
        require(storageProviders[msg.sender].collateral == 0, "Already registered");
        
        storageProviders[msg.sender] = StorageProvider({
            collateral: msg.value,
            claimedStorageGB: storageGB,
            reputationEarned: 0,
            lastProofTimestamp: block.timestamp,
            verified: false,
            pinnedCIDs: new string[](0)
        });
        
        emit StorageProviderRegistered(msg.sender, storageGB, msg.value);
    }
    
    function submitStorageProof(string[] memory cids) external {
        require(storageProviders[msg.sender].claimedStorageGB > 0, "Not registered");
        require(cids.length >= 5, "Must prove at least 5 CIDs");
        
        storageProviders[msg.sender].pinnedCIDs = cids;
        storageProviders[msg.sender].lastProofTimestamp = block.timestamp;
        
        emit StorageProofSubmitted(msg.sender, cids);
    }
    
    function verifyStorageProvider(address provider) external onlyGovernance {
        require(storageProviders[provider].claimedStorageGB > 0, "Not registered");
        
        storageProviders[provider].verified = true;
        storageProviders[provider].reputationEarned += STORAGE_REWARD_MONTHLY;
        
        emit StorageVerified(provider);
        emit ReputationRewarded(provider, STORAGE_REWARD_MONTHLY);
    }
    
    function getStorageRole(address provider) external view returns (string memory) {
        uint256 storageGB = storageProviders[provider].claimedStorageGB;  // ✅ FIXED: Renamed variable
        
        if (storageGB >= 200) return "Storage Guardian";
        if (storageGB >= 50) return "Power Contributor";
        if (storageGB >= 5) return "Storage Contributor";
        return "Observer";
    }
    
    function withdrawCollateral() external {
        StorageProvider storage provider = storageProviders[msg.sender];
        require(provider.verified, "Must be verified first");
        require(
            block.timestamp >= provider.lastProofTimestamp + MIN_COMMITMENT_PERIOD,
            "Must provide storage for 6 months minimum"
        );
        
        uint256 refund = provider.collateral;
        provider.collateral = 0;
        
        payable(msg.sender).transfer(refund);
        emit CollateralWithdrawn(msg.sender, refund);
    }
    
    function getStorageProvider(address provider) external view returns (
        uint256 collateral,
        uint256 storageGB,
        uint256 reputation,
        bool verified,
        uint256 lastProof
    ) {
        StorageProvider storage sp = storageProviders[provider];
        return (sp.collateral, sp.claimedStorageGB, sp.reputationEarned, sp.verified, sp.lastProofTimestamp);
    }
}
