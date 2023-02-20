// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'diamond-2/contracts/libraries/LibDiamond.sol';

import './PoolOpen.sol';

contract PoolDevOnly is PoolOpen {
  function stake(
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external override returns (uint256) {
    require(msg.sender == LibDiamond.contractOwner(), 'ONLY_DEV');
    return _stake(_amount, _receiver, _token);
  }
}
