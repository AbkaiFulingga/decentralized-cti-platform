// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PrivacyPreservingRegistry.sol";

contract OracleIOCFeed {
    PrivacyPreservingRegistry public registry;
    address public oracleBot;
    
    struct FeedInfo {
        string name;
        uint256 lastUpdate;
        uint256 totalUpdates;
        uint256 totalIOCs;
        bool active;
    }
    
    mapping(string => FeedInfo) public feeds;
    mapping(string => uint256[]) public feedBatches;  // feedName => batchIds
    string[] public activeFeedNames;
    
    uint256 public updateInterval = 6 hours;
    
    event FeedUpdated(string indexed feedName, string cid, uint256 iocCount, uint256 batchId);
    event FeedRegistered(string feedName);
    
    constructor(address _registry) {
        registry = PrivacyPreservingRegistry(_registry);
        oracleBot = msg.sender;
    }
    
    modifier onlyOracle() {
        require(msg.sender == oracleBot, "Only oracle can call");
        _;
    }
    
    function registerFeed(string memory feedName) external onlyOracle {
        require(!feeds[feedName].active, "Feed already registered");
        
        feeds[feedName] = FeedInfo({
            name: feedName,
            lastUpdate: 0,
            totalUpdates: 0,
            totalIOCs: 0,
            active: true
        });
        
        activeFeedNames.push(feedName);
        
        emit FeedRegistered(feedName);
    }
    
    function submitFeed(
        string memory feedName,
        string memory cid,
        bytes32 merkleRoot,
        uint256 iocCount
    ) external onlyOracle {
        require(feeds[feedName].active, "Feed not registered");
        require(
            block.timestamp >= feeds[feedName].lastUpdate + updateInterval,
            "Update too frequent"
        );
        
        // Submit to main registry as oracle
        bytes32 commitment = keccak256(abi.encodePacked("ORACLE_", feedName));
        
        // Get current batch count before submission
        uint256 batchId = registry.getBatchCount();
        
        // Submit batch
        registry.addBatch(cid, merkleRoot, true, commitment, "0x00");
        
        // Update feed info
        feeds[feedName].lastUpdate = block.timestamp;
        feeds[feedName].totalUpdates++;
        feeds[feedName].totalIOCs += iocCount;
        feedBatches[feedName].push(batchId);
        
        emit FeedUpdated(feedName, cid, iocCount, batchId);
    }
    
    function getFeedInfo(string memory feedName) external view returns (
        string memory name,
        uint256 lastUpdate,
        uint256 totalUpdates,
        uint256 totalIOCs,
        bool active
    ) {
        FeedInfo memory feed = feeds[feedName];
        return (feed.name, feed.lastUpdate, feed.totalUpdates, feed.totalIOCs, feed.active);
    }
    
    function getFeedBatches(string memory feedName) external view returns (uint256[] memory) {
        return feedBatches[feedName];
    }
    
    function getActiveFeeds() external view returns (string[] memory) {
        return activeFeedNames;
    }
    
    function setUpdateInterval(uint256 newInterval) external onlyOracle {
        updateInterval = newInterval;
    }
    
    function setOracleBot(address newOracle) external onlyOracle {
        oracleBot = newOracle;
    }
}
