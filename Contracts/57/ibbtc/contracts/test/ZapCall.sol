// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract ZapCall {
    using SafeERC20 for IERC20;

    function mint(IERC20 wbtc, IZap zap) external {
        uint bal = wbtc.balanceOf(address(this));
        wbtc.safeApprove(address(zap), bal);
        zap.mint(wbtc, bal, 0, 1, 0);
    }
}

interface IZap {
    function mint(IERC20 token, uint amount, uint poolId, uint idx, uint minOut) external returns(uint _ibbtc);
}
