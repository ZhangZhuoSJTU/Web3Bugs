// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/// @notice Base oracle interface
interface IUintValue {
  function get() external view returns (uint256);
}
