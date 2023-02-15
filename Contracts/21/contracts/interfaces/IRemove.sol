// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IRemove {
  /// @notice Swap `_token` amounts
  /// @param _token Token to swap
  /// @param _fmo Amount of first money out pool swapped
  /// @param _sherXUnderlying Amount of underlying being swapped
  /// @return newToken Token being swapped to
  /// @return newFmo Share of `_fmo` in newToken
  /// @return newSherxUnderlying Share of `_sherXUnderlying` in newToken
  function swap(
    IERC20 _token,
    uint256 _fmo,
    uint256 _sherXUnderlying
  )
    external
    returns (
      IERC20 newToken,
      uint256 newFmo,
      uint256 newSherxUnderlying
    );
}
