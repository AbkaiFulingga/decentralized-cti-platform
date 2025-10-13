// contracts/IOCRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IOCRegistry {
    struct IOC {
        string cid;        // IPFS CID of the IOC data
        string iocType;    // Type of IOC (e.g., "IP", "Hash", "Domain", "Report")
        uint256 timestamp; // When it was submitted
        address submitter; // Who submitted it
    }

    IOC[] public iocs;

    event IOCAdded(uint256 indexed id, string cid, string iocType, address indexed submitter);

    function addIOC(string memory cid, string memory iocType) public {
        iocs.push(IOC(cid, iocType, block.timestamp, msg.sender));
        emit IOCAdded(iocs.length - 1, cid, iocType, msg.sender);
    }

    function getIOC(uint256 id) public view returns (string memory, string memory, uint256, address) {
        require(id < iocs.length, "Invalid IOC ID");
        IOC memory ioc = iocs[id];
        return (ioc.cid, ioc.iocType, ioc.timestamp, ioc.submitter);
    }

    function totalIOCs() public view returns (uint256) {
        return iocs.length;
    }
}
