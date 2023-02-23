// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../SafeOwnableUpgradeable.sol";

contract SafeOwnableUpgradeableTest is SafeOwnableUpgradeable {
  function initialize() public initializer {
    __Ownable_init();
  }
}
