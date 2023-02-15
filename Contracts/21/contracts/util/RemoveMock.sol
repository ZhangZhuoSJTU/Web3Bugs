// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IRemove.sol';

contract RemoveMock is IRemove {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public token;

  uint256 constant fmo = 10e5 * 2;
  uint256 constant underlying = 10e5 * 3;

  constructor(IERC20 _token) {
    token = _token;
  }

  function swapFMO(uint256 _fmo) private returns (uint256) {
    return fmo;
  }

  function swapUnderlying(uint256 _underlying) private returns (uint256) {
    return underlying;
  }

  function swap(
    IERC20 _token,
    uint256 _fmo,
    uint256 _sherXUnderlying
  )
    external
    override
    returns (
      IERC20 newToken,
      uint256 newFmo,
      uint256 newSherxUnderlying
    )
  {
    uint256 total = _fmo.add(_sherXUnderlying);
    _token.safeTransferFrom(msg.sender, address(this), total);

    newToken = token;
    newFmo = swapFMO(_fmo);
    newSherxUnderlying = swapUnderlying(_sherXUnderlying);

    token.safeTransfer(msg.sender, newFmo.add(newSherxUnderlying));
  }
}
