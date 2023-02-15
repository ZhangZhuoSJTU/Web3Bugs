// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mock decentralized exchange for testing liquidations
contract MockExchange {
    uint256 public exchangeRate;

    function setExchangeRate(uint256 exchangeRate_) external {
        exchangeRate = exchangeRate_;
    }

    function exchange(
        address assetIn,
        address assetOut,
        uint256 amountIn
    ) external {
        uint256 amountOut = (amountIn * exchangeRate) / 1e18;
        if (IERC20(assetIn).balanceOf(msg.sender) < amountIn) {
            revert("Insufficient balance of assetIn");
        }

        IERC20(assetIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(assetOut).transfer(msg.sender, amountOut);
    }

    function exchangeOut(
        address assetIn,
        address assetOut,
        uint256 amountOut
    ) external {
        uint256 amountIn = (amountOut * 1e18) / exchangeRate;
        if (IERC20(assetIn).balanceOf(msg.sender) < amountIn) {
            revert("Insufficient balance of assetIn");
        }

        IERC20(assetIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(assetOut).transfer(msg.sender, amountOut);
    }
}
