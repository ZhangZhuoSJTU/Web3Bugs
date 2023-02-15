// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IBalancerPool {
  function getNormalizedWeights() external view returns (uint256[] memory);

  function totalSupply() external view returns (uint256);
}
