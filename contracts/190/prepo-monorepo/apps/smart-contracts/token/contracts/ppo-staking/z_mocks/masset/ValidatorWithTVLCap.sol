// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

contract ValidatorWithTVLCap {
  // Data used for determining max TVL during guarded launch
  uint256 public startTime;
  uint256 public startingCap;
  uint256 public capFactor;
}
