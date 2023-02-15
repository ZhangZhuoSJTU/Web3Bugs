// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/IERC20Upgradeable.sol";

interface ITimelockRewardDistributionToken is IERC20Upgradeable {
  function distributeRewards(uint amount) external;
  function __TimelockRewardDistributionToken_init(IERC20Upgradeable _target, string memory _name, string memory _symbol) external;
  function mint(address account, address to, uint256 amount) external;
  function timelockMint(address account, uint256 amount, uint256 timelockLength) external;
  function burnFrom(address account, uint256 amount) external;
  function withdrawReward(address user) external;
  function dividendOf(address _owner) external view returns(uint256);
  function withdrawnRewardOf(address _owner) external view returns(uint256);
  function accumulativeRewardOf(address _owner) external view returns(uint256);
  function timelockUntil(address account) external view returns (uint256);
}