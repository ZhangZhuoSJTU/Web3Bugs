// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

interface MockAave {
  function mint(address receiver, uint256 amount) external;
}
