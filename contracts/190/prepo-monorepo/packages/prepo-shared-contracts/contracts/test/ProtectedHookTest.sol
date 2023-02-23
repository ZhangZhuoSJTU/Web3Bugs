// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../ProtectedHook.sol";

contract ProtectedHookTest is ProtectedHook {
  function testOnlyAllowedContract() external onlyAllowedContract {}
}
