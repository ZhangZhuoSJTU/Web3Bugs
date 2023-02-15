// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStrategySwapper {
    function swapAllForWeth(address token) external;

    function swapAllWethForToken(address token_) external;

    function setSlippageTolerance(uint256 _slippageTolerance) external;

    function setSwapViaUniswap(address token_, bool swapViaUniswap_) external;

    function swapForWeth(address token, uint256 amount) external;

    function setCurvePool(address token_, address curvePool_) external;

    function amountOut(
        address tokenIn_,
        address tokenOut_,
        uint256 amountIn
    ) external view returns (uint256);
}
