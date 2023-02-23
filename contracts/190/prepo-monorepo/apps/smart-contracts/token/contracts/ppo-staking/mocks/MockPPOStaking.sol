// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "../governance/staking/PPOStaking.sol";

contract MockPPOStaking is PPOStaking {
  constructor(
    address _newNexus,
    address _newRewardsToken,
    address _newAchievementsManager,
    address _newStakedToken,
    uint256 _newCooldownSeconds,
    uint256 _newUnstakeWindow
  )
    PPOStaking(
      _newNexus,
      _newRewardsToken,
      _newAchievementsManager,
      _newStakedToken,
      _newCooldownSeconds,
      _newUnstakeWindow
    )
  {}

  function __mockPPOStaking_init(address _newRewardsDistributor) public {
    __PPOStaking_init(_newRewardsDistributor);
  }
}
