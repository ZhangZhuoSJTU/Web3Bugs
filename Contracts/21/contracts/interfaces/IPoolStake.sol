// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IPoolStake {
  /// @notice Stake `_amount` of `_token`, send lockToken to `_receiver`
  /// @param _amount Amount to stake
  /// @param _receiver Account receiving the lockTokens
  /// @param _token Token used
  /// @return Amount of lockTokens representing deposited `_amount`
  function stake(
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external returns (uint256);
}
