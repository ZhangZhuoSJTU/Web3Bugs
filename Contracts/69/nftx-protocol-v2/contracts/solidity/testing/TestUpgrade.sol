// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../NFTXVaultFactoryUpgradeable.sol";

contract TestFactoryUpgrade is NFTXVaultFactoryUpgradeable {
    function isUpgraded() public pure returns (bool) {
        return true;
    }
}
