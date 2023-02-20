// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.3;

interface IAaveIncentivesController {
  event RewardsClaimed(address indexed user, address indexed to, uint256 amount);

  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external returns (uint256);

  function getUserUnclaimedRewards(address user) external view returns (uint256);
}
