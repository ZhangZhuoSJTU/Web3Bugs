// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.0;

import "./TickMath.sol";
import "hardhat/console.sol";

/// @notice Tick management library for ranged liquidity.
library Ticks {
    struct Tick {
        int24 previousTick;
        int24 nextTick;
        uint128 liquidity;
        uint256 feeGrowthOutside0; // Per unit of liquidity.
        uint256 feeGrowthOutside1;
        uint160 secondsPerLiquidityOutside;
    }

    function getMaxLiquidity(uint24 _tickSpacing) internal pure returns (uint128) {
        return type(uint128).max / uint128(uint24(TickMath.MAX_TICK) / uint24(_tickSpacing));
    }

    function cross(
        mapping(int24 => Tick) storage ticks,
        int24 nextTickToCross,
        uint160 secondsPerLiquidity,
        uint256 currentLiquidity,
        uint256 feeGrowthGlobal,
        bool zeroForOne
    ) internal returns (uint256, int24) {
        ticks[nextTickToCross].secondsPerLiquidityOutside = secondsPerLiquidity - ticks[nextTickToCross].secondsPerLiquidityOutside;
        if (zeroForOne) {
            // Moving forward through the linked list
            if (nextTickToCross % 2 == 0) {
                currentLiquidity -= ticks[nextTickToCross].liquidity;
            } else {
                currentLiquidity += ticks[nextTickToCross].liquidity;
            }
            nextTickToCross = ticks[nextTickToCross].previousTick;
            ticks[nextTickToCross].feeGrowthOutside0 = feeGrowthGlobal - ticks[nextTickToCross].feeGrowthOutside0;
        } else {
            // Moving backwards through the linked list
            if (nextTickToCross % 2 == 0) {
                currentLiquidity += ticks[nextTickToCross].liquidity;
            } else {
                currentLiquidity -= ticks[nextTickToCross].liquidity;
            }
            nextTickToCross = ticks[nextTickToCross].nextTick;
            ticks[nextTickToCross].feeGrowthOutside1 = feeGrowthGlobal - ticks[nextTickToCross].feeGrowthOutside1;
        }

        return (currentLiquidity, nextTickToCross);
    }

    function insert(
        mapping(int24 => Tick) storage ticks,
        uint256 feeGrowthGlobal0,
        uint256 feeGrowthGlobal1,
        uint160 secondsPerLiquidity,
        int24 lowerOld,
        int24 lower,
        int24 upperOld,
        int24 upper,
        uint128 amount,
        int24 nearestTick,
        uint160 currentPrice
    ) public returns (int24) {
        require(lower < upper, "WRONG_ORDER");
        require(TickMath.MIN_TICK <= lower, "LOWER_RANGE");
        require(upper <= TickMath.MAX_TICK, "UPPER_RANGE");

        {
            // stack overflow boo boo
            uint128 currentLowerLiquidity = ticks[lower].liquidity;
            if (currentLowerLiquidity != 0 || lower == TickMath.MIN_TICK) {
                // We are adding liquidity to an existing tick.
                ticks[lower].liquidity = currentLowerLiquidity + amount;
            } else {
                // We are inserting a new tick.
                Ticks.Tick storage old = ticks[lowerOld];
                int24 oldNextTick = old.nextTick;

                require((old.liquidity != 0 || lowerOld == TickMath.MIN_TICK) && lowerOld < lower && lower < oldNextTick, "LOWER_ORDER");

                if (lower <= nearestTick) {
                    ticks[lower] = Ticks.Tick(lowerOld, oldNextTick, amount, feeGrowthGlobal0, feeGrowthGlobal1, secondsPerLiquidity);
                } else {
                    ticks[lower] = Ticks.Tick(lowerOld, oldNextTick, amount, 0, 0, 0);
                }

                old.nextTick = lower;
                ticks[oldNextTick].previousTick = lower;
            }
        }

        uint128 currentUpperLiquidity = ticks[upper].liquidity;
        if (currentUpperLiquidity != 0 || upper == TickMath.MAX_TICK) {
            // We are adding liquidity to an existing tick.
            ticks[upper].liquidity = currentUpperLiquidity + amount;
        } else {
            // Inserting a new tick.
            Ticks.Tick storage old = ticks[upperOld];
            int24 oldNextTick = old.nextTick;

            require(old.liquidity != 0 && oldNextTick > upper && upperOld < upper, "UPPER_ORDER");

            if (upper <= nearestTick) {
                ticks[upper] = Ticks.Tick(upperOld, oldNextTick, amount, feeGrowthGlobal0, feeGrowthGlobal1, secondsPerLiquidity);
            } else {
                ticks[upper] = Ticks.Tick(upperOld, oldNextTick, amount, 0, 0, 0);
            }
            old.nextTick = upper;
            ticks[oldNextTick].previousTick = upper;
        }

        int24 actualNearestTick = TickMath.getTickAtSqrtRatio(currentPrice);

        if (nearestTick < upper && upper <= actualNearestTick) {
            nearestTick = upper;
        } else if (nearestTick < lower && lower <= actualNearestTick) {
            nearestTick = lower;
        }

        return nearestTick;
    }

    function remove(
        mapping(int24 => Tick) storage ticks,
        int24 lower,
        int24 upper,
        uint128 amount,
        int24 nearestTick
    ) public returns (int24) {
        Ticks.Tick storage current = ticks[lower];

        if (lower != TickMath.MIN_TICK && current.liquidity == amount) {
            // Delete lower tick.
            Ticks.Tick storage previous = ticks[current.previousTick];
            Ticks.Tick storage next = ticks[current.nextTick];

            previous.nextTick = current.nextTick;
            next.previousTick = current.previousTick;

            if (nearestTick == lower) nearestTick = current.previousTick;

            delete ticks[lower];
        } else {
            unchecked {
                current.liquidity -= amount;
            }
        }

        current = ticks[upper];

        if (upper != TickMath.MAX_TICK && current.liquidity == amount) {
            // Delete upper tick.
            Ticks.Tick storage previous = ticks[current.previousTick];
            Ticks.Tick storage next = ticks[current.nextTick];

            previous.nextTick = current.nextTick;
            next.previousTick = current.previousTick;

            if (nearestTick == upper) nearestTick = current.previousTick;

            delete ticks[upper];
        } else {
            unchecked {
                current.liquidity -= amount;
            }
        }

        return nearestTick;
    }
}
