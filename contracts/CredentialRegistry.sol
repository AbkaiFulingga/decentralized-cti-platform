// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CredentialRegistry {
    mapping(address => bool) public hasCredential;
    address public governance;

    event CredentialIssued(address indexed member);
    event CredentialRevoked(address indexed member);

    modifier onlyGovernance() {
        require(msg.sender == governance, "not governance");
        _;
    }

    constructor(address _governance) {
        governance = _governance;
    }

    function issueCredential(address member) external onlyGovernance {
        hasCredential[member] = true;
        emit CredentialIssued(member);
    }

    function revokeCredential(address member) external onlyGovernance {
        hasCredential[member] = false;
        emit CredentialRevoked(member);
    }
}
