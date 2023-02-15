// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IStrategy.sol';

contract StrategyMock is IStrategy {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public override want;
  address internal sherlock;

  constructor(ERC20 _want, address _sherlock) {
    want = _want;
    sherlock = _sherlock;
  }

  function withdrawAll() external override returns (uint256 balance) {
    balance = balanceOf();
    want.safeTransfer(msg.sender, balance);
  }

  function withdraw(uint256 _amount) external override {
    want.safeTransfer(msg.sender, _amount);
  }

  function deposit() external override {}

  function balanceOf() public view override returns (uint256) {
    return want.balanceOf(address(this));
  }
}
