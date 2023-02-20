// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface ISwapperRouter {
    function swapAll(address fromToken, address toToken) external payable returns (uint256);

    function setSlippageTolerance(uint256 slippageTolerance_) external;

    function setCurvePool(address token_, address curvePool_) external;

    function swap(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) external payable returns (uint256);

    function getAmountOut(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}
