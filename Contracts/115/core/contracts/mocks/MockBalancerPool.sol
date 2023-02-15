// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IBalancerPool.sol";

contract MockBalancerPool is IBalancerPool {
  address public tokenA;
  address public tokenB;
  uint256 public override totalSupply;
  mapping(address => uint256) public tokenBalances;
  mapping(address => uint256) public tokenWeights;

  constructor(address _tokenA, address _tokenB) public {
    tokenA = _tokenA;
    tokenB = _tokenB;
  }

  function setNormalizedWeight(address token, uint256 weight) public {
    tokenWeights[token] = weight;
  }

  function setTotalSupply(uint256 supply) public {
    totalSupply = supply;
  }

  function getNormalizedWeights() external view override returns (uint256[] memory) {
    uint256[] memory weights = new uint256[](2);
    weights[0] = tokenWeights[tokenA];
    weights[1] = tokenWeights[tokenB];

    return weights;
  }
}
