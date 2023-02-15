// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/IPoolStrategy.sol';

import '../storage/GovStorage.sol';

import '../libraries/LibPool.sol';

contract PoolStrategy is IPoolStrategy {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // View methods
  //

  function getStrategy(IERC20 _token) external view override returns (IStrategy) {
    return baseData().strategy;
  }

  function _enforceStrategy(PoolStorage.Base storage ps) internal {
    require(address(ps.strategy) != address(0), 'STRATEGY');
  }

  function _enforceGovPool(PoolStorage.Base storage ps) internal {
    require(ps.govPool == msg.sender, 'GOV');
  }

  //
  // State changing methods
  //

  function strategyRemove(IERC20 _token) external override {
    PoolStorage.Base storage ps = baseData();
    _enforceGovPool(ps);
    require(address(ps.strategy) != address(0), 'ZERO');
    // NOTE: don't check if the current strategy balance = 0
    // In case the strategy is faulty and the balance can never return 0
    // The strategy can never be removed. So this function should be used with caution.
    delete ps.strategy;
  }

  function strategyUpdate(IStrategy _strategy, IERC20 _token) external override {
    PoolStorage.Base storage ps = baseData();
    require(_strategy.want() == _token, 'WANT');
    _enforceGovPool(ps);
    if (address(ps.strategy) != address(0)) {
      require(ps.strategy.balanceOf() == 0, 'NOT_EMPTY');
    }

    ps.strategy = _strategy;
  }

  function strategyDeposit(uint256 _amount, IERC20 _token) external override {
    require(_amount > 0, 'AMOUNT');
    PoolStorage.Base storage ps = baseData();
    _enforceGovPool(ps);
    _enforceStrategy(ps);

    ps.stakeBalance = ps.stakeBalance.sub(_amount);
    _token.safeTransfer(address(ps.strategy), _amount);

    ps.strategy.deposit();
  }

  function strategyWithdraw(uint256 _amount, IERC20 _token) external override {
    require(_amount > 0, 'AMOUNT');
    PoolStorage.Base storage ps = baseData();
    _enforceGovPool(ps);
    _enforceStrategy(ps);

    ps.strategy.withdraw(_amount);
    ps.stakeBalance = ps.stakeBalance.add(_amount);
  }

  function strategyWithdrawAll(IERC20 _token) external override {
    PoolStorage.Base storage ps = baseData();
    _enforceGovPool(ps);
    _enforceStrategy(ps);

    uint256 amount = ps.strategy.withdrawAll();
    ps.stakeBalance = ps.stakeBalance.add(amount);
  }

  function baseData() internal view returns (PoolStorage.Base storage ps) {
    ps = PoolStorage.ps(bps());
    require(ps.govPool != address(0), 'INVALID_TOKEN');
  }

  function bps() internal pure returns (IERC20 rt) {
    // These fields are not accessible from assembly
    bytes memory array = msg.data;
    uint256 index = msg.data.length;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
      rt := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
    }
  }
}
