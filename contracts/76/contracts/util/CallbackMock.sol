// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/managers/callbacks/ISherlockClaimManagerCallbackReceiver.sol';

contract CallbackMock is ISherlockClaimManagerCallbackReceiver {
  IERC20 constant TOKEN = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

  function PreCorePayoutCallback(
    bytes32 _protocol,
    uint256 _claimID,
    uint256 _amount
  ) external override {
    TOKEN.transfer(msg.sender, TOKEN.balanceOf(address(this)));
  }
}
