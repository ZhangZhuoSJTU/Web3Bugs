// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface ISherClaim {
  error InvalidAmount();
  error ZeroArgument();
  error InvalidState();

  // Event emitted when tokens have been added to the timelock
  event Add(address indexed sender, address indexed account, uint256 amount);
  // Event emitted when tokens have been claimed
  event Claim(address indexed account, uint256 amount);

  function add(address _user, uint256 _amount) external;

  function claimableAt() external view returns (uint256);
}
