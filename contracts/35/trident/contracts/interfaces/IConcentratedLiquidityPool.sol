// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import "./IPool.sol";

/// @notice Trident Concentrated Liquidity Pool interface.
interface IConcentratedLiquidityPool is IPool {
    struct Tick {
        int24 previousTick;
        int24 nextTick;
        uint128 liquidity;
        uint256 feeGrowthOutside0;
        uint256 feeGrowthOutside1;
        uint160 secondsPerLiquidityOutside;
    }

    function price() external view returns (uint160);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function ticks(int24 _tick) external view returns (Tick memory tick);

    function feeGrowthGlobal0() external view returns (uint256);

    function rangeSecondsInside(int24 lowerTick, int24 upperTick) external view returns (uint256);

    function rangeFeeGrowth(int24 lowerTick, int24 upperTick) external view returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1);

    function collect(
        int24,
        int24,
        address,
        bool
    ) external returns (uint256 amount0fees, uint256 amount1fees);
}
