//  SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

// ISwapStrategyRouter performs optimal routing of swaps.
interface ISwapStrategyRouter {
    // Return the optimal rate and the strategy ID.
    function optimizeSwap(
        address _from,
        address _to,
        uint256 _amount
    ) external returns (address strategy, uint256 amount);
}

// ISwapStrategy enforces a standard API for swaps.
interface ISwapStrategy {
    function swapTokens(
        address _from,
        address _to,
        uint256 _amount,
        // Slippage is in bps.
        uint256 _slippage
    ) external returns (uint256 amount);

    // Estimate swap amount returns the swap rate.
    function estimateSwapAmount(
        address _from,
        address _to,
        uint256 _amount
    ) external returns (uint256 amount);
}
