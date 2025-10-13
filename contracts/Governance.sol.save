// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRegistry {
    function acceptBatch(uint256 batchIndex) external;
}

contract Governance {
    struct Proposal {
        address proposer;
        uint256 batchIndex;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        mapping(address => bool) voted;
    }

    Proposal[] public proposals;
    mapping(address => bool) public members;
    uint256 public votingPeriod; // in seconds

    event ProposalCreated(
        uint256 indexed id,
        address proposer,
        uint256 batchIndex,
        uint256 startTime,
        uint256 endTime
    );
    event Voted(uint256 indexed id, address voter, bool support);
    event ProposalFinalized(uint256 indexed id, bool passed);

    address public registry; // registry contract to call acceptBatch

    modifier onlyMember() {
        require(members[msg.sender], "not member");
        _;
    }

    constructor(address[] memory _members, uint256 _votingPeriod, address _registry) {
        for (uint i = 0; i < _members.length; i++) {
            members[_members[i]] = true;
        }
        votingPeriod = _votingPeriod;
        registry = _registry;
    }

    function createProposal(uint256 batchIndex) external onlyMember returns (uint256) {
        Proposal storage p = proposals.push();
        p.proposer = msg.sender;
        p.batchIndex = batchIndex;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + votingPeriod; // ✅ FIX: set end time

        uint256 proposalId = proposals.length - 1;
        emit ProposalCreated(proposalId, msg.sender, batchIndex, p.startTime, p.endTime); // ✅ FIX: event
        return proposalId;
    }

    function vote(uint256 id, bool support) external onlyMember {
        Proposal storage p = proposals[id];
        require(block.timestamp < p.endTime, "voting closed");
        require(!p.voted[msg.sender], "already voted");

        p.voted[msg.sender] = true;
        if (support) {
            p.forVotes++;
        } else {
            p.againstVotes++;
        }

        emit Voted(id, msg.sender, support);
    }

    function finalizeProposal(uint256 id) external onlyMember {
        Proposal storage p = proposals[id];
        require(block.timestamp >= p.endTime, "voting not ended");
        require(!p.executed, "already executed");

        p.executed = true;
        bool passed = p.forVotes > p.againstVotes;

        if (passed) {
            IRegistry(registry).acceptBatch(p.batchIndex);
        }

        emit ProposalFinalized(id, passed);
    }

    function getProposal(uint256 id)
        external
        view
        returns (
            address proposer,
            uint256 batchIndex,
            uint256 startTime,
            uint256 endTime,
            uint256 forVotes,
            uint256 againstVotes,
            bool executed
        )
    {
        Proposal storage p = proposals[id];
        return (p.proposer, p.batchIndex, p.startTime, p.endTime, p.forVotes, p.againstVotes, p.executed);
    }
}
