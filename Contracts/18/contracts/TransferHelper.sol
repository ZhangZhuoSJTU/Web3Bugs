// SPDX-License-Identifier: UNLICENSED

// Copyright (c) 2021 0xdev0 - All rights reserved
// https://twitter.com/0xdev0

pragma solidity ^0.8.0;

import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';

contract TransferHelper {

  // Mainnet
  IWETH internal constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

  // Kovan
  // IWETH internal constant WETH = IWETH(0xd0A1E359811322d97991E03f863a0C30C2cF029C);

  function _safeTransferFrom(address _token, address _sender, uint _amount) internal virtual {
    bool success = IERC20(_token).transferFrom(_sender, address(this), _amount);
    require(success, "TransferHelper: transfer failed");
    require(_amount > 0, "TransferHelper: amount must be > 0");
  }

  function _wethWithdrawTo(address _to, uint _amount) internal virtual {
    require(_amount > 0, "TransferHelper: amount must be > 0");
    WETH.withdraw(_amount);
    (bool success, ) = _to.call { value: _amount }(new bytes(0));
    require(success, 'TransferHelper: ETH transfer failed');
  }

  function _depositWeth() internal {
    require(msg.value > 0, "TransferHelper: amount must be > 0");
    WETH.deposit { value: msg.value }();
  }
}
