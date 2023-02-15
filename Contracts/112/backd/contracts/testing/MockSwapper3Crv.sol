// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../swappers/Swapper3Crv.sol";

contract MockSwapper3Crv is Swapper3Crv {
    // Wrapped internal methods for testing only
    function getBestDex(
        address fromToken,
        address toToken,
        uint256 amount
    ) external view returns (address bestDex, uint256 amountOut) {
        return _getBestDex(fromToken, toToken, amount);
    }

    function tokenAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address dex
    ) external view returns (uint256) {
        return _tokenAmountOut(tokenIn, tokenOut, amountIn, dex);
    }
}
