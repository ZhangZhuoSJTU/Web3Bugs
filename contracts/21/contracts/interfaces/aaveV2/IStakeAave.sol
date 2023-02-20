// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IStakeAave is IERC20 {
  function cooldown() external;

  function claimRewards(address to, uint256 amount) external;

  function redeem(address to, uint256 amount) external;

  function getTotalRewardsBalance(address staker) external view returns (uint256);
}
