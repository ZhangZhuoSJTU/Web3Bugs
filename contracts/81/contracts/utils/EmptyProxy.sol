// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

// Empty proxy for deploying to an address first and then allows the deployer to upgrade
// to the implementation later.
contract EmptyProxy is UUPSUpgradeable {
    address internal immutable deployer;

    constructor()  {
        deployer = msg.sender;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == deployer);
    }
}