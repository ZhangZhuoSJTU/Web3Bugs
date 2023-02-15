// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

interface IRewardDistributionToken {
  function distributeRewards(uint amount) external;
}