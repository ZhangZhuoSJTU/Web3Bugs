// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'diamond-2/contracts/libraries/LibDiamond.sol';

import '../interfaces/IPayout.sol';

import '../storage/PayoutStorage.sol';

import '../libraries/LibSherX.sol';
import '../libraries/LibSherXERC20.sol';

contract Payout is IPayout {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // Modifiers
  //

  modifier onlyGovMain() {
    require(msg.sender == GovStorage.gs().govMain, 'NOT_GOV_MAIN');
    _;
  }

  modifier onlyGovPayout() {
    require(msg.sender == PayoutStorage.ps().govPayout, 'NOT_GOV_PAY');
    _;
  }

  //
  // View methods
  //

  function getGovPayout() external view override returns (address) {
    return PayoutStorage.ps().govPayout;
  }

  //
  // State changing methods
  //

  function setInitialGovPayout(address _govPayout) external override {
    PayoutStorage.Base storage ps = PayoutStorage.ps();

    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');
    require(_govPayout != address(0), 'ZERO_GOV');
    require(ps.govPayout == address(0), 'ALREADY_SET');

    ps.govPayout = _govPayout;
  }

  function transferGovPayout(address _govPayout) external override onlyGovMain {
    PayoutStorage.Base storage ps = PayoutStorage.ps();

    require(_govPayout != address(0), 'ZERO_GOV');
    require(ps.govPayout != _govPayout, 'SAME_GOV');
    ps.govPayout = _govPayout;
  }

  /// @notice Transfer certain amount of underlying tokens of unallocated SherX to `_payout`
  /// @param _payout Account to receive underlying tokens
  /// @param _exclude Token to exclude from payout
  /// @param curTotalUsdPool The current `sx.totalUsdPool`
  /// @param totalSherX The amount of SherX to use for payout
  /// @return sherUsd Total amount of USD of the underlying tokens that are being transferred
  function _doSherX(
    address _payout,
    address _exclude,
    uint256 curTotalUsdPool,
    uint256 totalSherX
  ) private returns (uint256 sherUsd) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    // Calculate the current `amounts` of underlying `tokens` for `totalSherX`
    (IERC20[] memory tokens, uint256[] memory amounts) = LibSherX.calcUnderlying(totalSherX);
    uint256 subUsdPool;

    for (uint256 i; i < tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(tokens[i]);

      // Expensive operation, only execute to prevent tx reverts
      if (amounts[i] > ps.sherXUnderlying) {
        LibPool.payOffDebtAll(tokens[i]);
      }

      if (address(tokens[i]) == _exclude) {
        // Return USD value of token that is excluded from payout
        sherUsd = amounts[i].mul(sx.tokenUSD[tokens[i]]);
      } else {
        // Remove the token as underlying of SherX
        ps.sherXUnderlying = ps.sherXUnderlying.sub(amounts[i]);
        // As the tokens are transferred, remove from the current usdPool
        // By summing the total that needs to be deducted in the `subUsdPool` value
        subUsdPool = subUsdPool.add(amounts[i].mul(sx.tokenUSD[tokens[i]]).div(10**18));
        // NOTE: transfer can potentially be optimized, as payout call itself also does transfers
        tokens[i].safeTransfer(_payout, amounts[i]);
      }
    }
    // Subtract the total amount that needs to be subtracted from the `sx.totalUsdPool`
    sx.totalUsdPool = curTotalUsdPool.sub(subUsdPool);
  }

  function payout(
    address _payout,
    IERC20[] memory _tokens,
    uint256[] memory _firstMoneyOut,
    uint256[] memory _amounts,
    uint256[] memory _unallocatedSherX,
    address _exclude
  ) external override onlyGovPayout {
    // all pools (including SherX pool) can be deducted fmo and balance
    // deducting balance will reduce the users underlying value of stake token
    // for every pool, _unallocatedSherX can be deducted, this will decrease outstanding SherX rewards
    // for users that did not claim them (e.g materialized them and included in SherX pool)

    require(address(_payout) != address(0), 'ZERO_PAY');
    require(address(_payout) != address(this), 'THIS_PAY');
    require(_tokens.length == _firstMoneyOut.length, 'LENGTH_1');
    require(_tokens.length == _amounts.length, 'LENGTH_2');
    require(_tokens.length == _unallocatedSherX.length, 'LENGTH_3');

    LibSherX.accrueSherX();

    uint256 totalUnallocatedSherX;
    uint256 totalSherX;

    for (uint256 i; i < _tokens.length; i++) {
      IERC20 token = _tokens[i];
      uint256 firstMoneyOut = _firstMoneyOut[i];
      uint256 amounts = _amounts[i];
      uint256 unallocatedSherX = _unallocatedSherX[i];

      PoolStorage.Base storage ps = PoolStorage.ps(token);
      require(ps.govPool != address(0), 'INIT');
      require(ps.unallocatedSherX >= unallocatedSherX, 'ERR_UNALLOC_FEE');

      if (unallocatedSherX > 0) {
        // Subtract from `sWeight` as the tokens are not claimable anymore
        ps.sWeight = ps.sWeight.sub(unallocatedSherX);
        // Subtract from unallocated, as the tokens are now allocated to this payout call
        ps.unallocatedSherX = ps.unallocatedSherX.sub(unallocatedSherX);
        // Update the memory variable `totalUnallocatedSherX` to execute on `_doSherX` later
        totalUnallocatedSherX = totalUnallocatedSherX.add(unallocatedSherX);
      }

      uint256 total = firstMoneyOut.add(amounts);
      if (total == 0) {
        continue;
      }
      if (firstMoneyOut > 0) {
        ps.firstMoneyOut = ps.firstMoneyOut.sub(firstMoneyOut);
      }
      ps.stakeBalance = ps.stakeBalance.sub(total);

      if (address(token) == address(this)) {
        // If the token address == address(this), it's SherX
        totalSherX = total;
      } else {
        // NOTE: Inside the _doSherX() call tokens are also transferred, potential gas optimalisation if tokens
        // are transferred at once
        token.safeTransfer(_payout, total);
      }
    }

    if (totalUnallocatedSherX > 0) {
      // Sum the SherX that is used from the pool + the SherX unallocated as rewards
      totalSherX = totalSherX.add(totalUnallocatedSherX);
    }
    if (totalSherX == 0) {
      return;
    }

    // NOTE: sx20().totalSupply is always > 0 when this codes hit.

    uint256 curTotalUsdPool = LibSherX.viewAccrueUSDPool();
    uint256 excludeUsd = _doSherX(_payout, _exclude, curTotalUsdPool, totalSherX);

    // usd excluded, divided by the price per SherX token = amount of sherx to not burn.
    uint256 deduction =
      excludeUsd.div(curTotalUsdPool.div(SherXERC20Storage.sx20().totalSupply)).div(10e17);
    // deduct that amount from the tokens being burned, to keep the same USD value
    uint256 burnAmount = totalSherX.sub(deduction);

    LibSherXERC20.burn(address(this), burnAmount);
    LibSherX.settleInternalSupply(burnAmount);
  }
}
