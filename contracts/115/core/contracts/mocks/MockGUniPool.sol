// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IGUniPool.sol";

contract MockGUniPool is IGUniPool {
  address public override token0;
  address public override token1;
  uint256 public override totalSupply;
  uint256 public balance0;
  uint256 public balance1;

  constructor(address _token0, address _token1) public {
    token0 = _token0;
    token1 = _token1;
  }

  function setBalance(uint256 _balance0, uint256 _balance1) public {
    balance0 = _balance0;
    balance1 = _balance1;
  }

  function setTotalSupply(uint256 supply) public {
    totalSupply = supply;
  }

  function getUnderlyingBalancesAtPrice(uint160) external view override returns (uint256, uint256) {
    return (balance0, balance1);
  }
}
