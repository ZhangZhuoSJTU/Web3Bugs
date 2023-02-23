// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../SafeAccessControlEnumerableUpgradeable.sol";

contract SafeAccessControlEnumerableUpgradeableTest is SafeAccessControlEnumerableUpgradeable {
  function initialize() public initializer {
    __SafeAccessControlEnumerable_init();
  }
}
