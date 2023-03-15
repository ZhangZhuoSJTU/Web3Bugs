// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './IJBDirectory.sol';

interface IJBControllerUtility {
  function directory() external view returns (IJBDirectory);
}
