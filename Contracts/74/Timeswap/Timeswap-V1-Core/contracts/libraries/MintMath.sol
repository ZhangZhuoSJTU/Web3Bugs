// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '../interfaces/IPair.sol';
import {Math} from './Math.sol';
import {FullMath} from './FullMath.sol';
import {SafeCast} from './SafeCast.sol';

/// @title MintMath library
/// @author Timeswap Labs
library MintMath {
    using Math for uint256;
    using FullMath for uint256;
    using SafeCast for uint256;

    /// @dev Get the total liquidity.
    /// @dev Use this if the total liquidity in the pool is 0.
    /// @param xIncrease The increase in the X state.
    function getLiquidityTotal(uint112 xIncrease) internal pure returns (uint256 liquidityTotal) {
        liquidityTotal = xIncrease;
        liquidityTotal <<= 16;
    }

    /// @dev Get the total liquidity.
    /// @param xIncrease The increase in the X state.
    /// @param yIncrease The increase in the Y state.
    /// @param zIncrease The increase in the Z state.
    function getLiquidityTotal(
        IPair.State memory state,
        uint112 xIncrease,
        uint112 yIncrease,
        uint112 zIncrease
    ) internal pure returns (uint256 liquidityTotal) {
        liquidityTotal = min(
            state.totalLiquidity.mulDiv(xIncrease, state.x),
            state.totalLiquidity.mulDiv(yIncrease, state.y),
            state.totalLiquidity.mulDiv(zIncrease, state.z)
        );
    }

    /// @dev Get the total liquidity factoring in the protocolFee.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param liquidityTotal The total liquidity without the protocolFee.
    /// @param protocolFee The chosen protocol fee rate.
    function getLiquidity(
        uint256 maturity,
        uint256 liquidityTotal,
        uint16 protocolFee
    ) internal view returns (uint256 liquidityOut) {
        uint256 denominator = maturity;
        denominator -= block.timestamp;
        denominator *= protocolFee;
        denominator += 0x10000000000;
        liquidityOut = liquidityTotal.mulDiv(0x10000000000, denominator);
    }

    /// @dev Get the minimum of 3 numbers
    function min(
        uint256 x,
        uint256 y,
        uint256 z
    ) private pure returns (uint256 w) {
        if (x <= y && x <= z) {
            w = x;
        } else if (y <= x && y <= z) {
            w = y;
        } else {
            w = z;
        }
    }

    /// @dev Get the debt that the lp has to pay back.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param xIncrease The increase in the X state.
    /// @param yIncrease The increase in the Y state.
    function getDebt(
        uint256 maturity,
        uint112 xIncrease,
        uint112 yIncrease
    ) internal view returns (uint112 debtIn) {
        uint256 _debtIn = maturity;
        _debtIn -= block.timestamp;
        _debtIn *= yIncrease;
        _debtIn = _debtIn.shiftRightUp(32);
        _debtIn += xIncrease;
        debtIn = _debtIn.toUint112();
    }

    /// @dev Get the collateral that the lp has locked.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param zIncrease The increase in the Z state.
    function getCollateral(
        uint256 maturity,
        uint112 zIncrease
    ) internal view returns (uint112 collateralIn) {
        uint256 _collateralIn = maturity;
        _collateralIn -= block.timestamp; 
        _collateralIn *= zIncrease;
        _collateralIn = _collateralIn.shiftRightUp(25); 
        _collateralIn += zIncrease; 
        collateralIn = _collateralIn.toUint112();
    }
}
