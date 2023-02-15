pragma solidity ^0.8.0; 

// SPDX-License-Identifier: MIT

import "../NFTXVaultUpgradeable.sol";

contract TestVaultUpgrade is NFTXVaultUpgradeable {
   function isUpgraded() public pure returns (bool) { 
     return true;
   }
}