// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '../interfaces/IPair.sol';
import {FullMath} from './FullMath.sol';
import {Math} from './Math.sol';
import {SafeCast} from './SafeCast.sol';

/// @title BurnMath library
/// @author Timeswap Labs
library BurnMath {
    using FullMath for uint256;
    using Math for uint256;
    using SafeCast for uint256;

    /// @dev Get the asset for the liquidity burned.
    /// @param state The pool state.
    /// @param liquidityIn The amount of liquidity balance burnt by the msg.sender.
    function getAsset(IPair.State memory state, uint256 liquidityIn) internal pure returns (uint128 assetOut) {
        if (state.reserves.asset <= state.totalClaims.bond) return assetOut;
        uint256 _assetOut = state.reserves.asset;
        _assetOut -= state.totalClaims.bond;
        _assetOut = _assetOut.mulDiv(liquidityIn, state.totalLiquidity);
        assetOut = _assetOut.toUint128();
    }

    /// @dev Get the collateral for the liquidity burned.
    /// @param state The pool state.
    /// @param liquidityIn The amount of liquidity balance burnt by the msg.sender.
    function getCollateral(IPair.State memory state, uint256 liquidityIn)
        internal
        pure
        returns (uint128 collateralOut)
    {
        uint256 _collateralOut = state.reserves.collateral;
        if (state.reserves.asset >= state.totalClaims.bond) {
            _collateralOut = _collateralOut.mulDiv(liquidityIn, state.totalLiquidity);
            return collateralOut = _collateralOut.toUint128();
        }
        uint256 deficit = state.totalClaims.bond;
        deficit -= state.reserves.asset;
        if (uint256(state.reserves.collateral) * state.totalClaims.bond <= deficit * state.totalClaims.insurance) return collateralOut;
        uint256 subtrahend = deficit;
        subtrahend *= state.totalClaims.insurance;
        subtrahend = subtrahend.divUp(state.totalClaims.bond);
        _collateralOut -= subtrahend;
        _collateralOut = _collateralOut.mulDiv(liquidityIn, state.totalLiquidity);
        collateralOut = _collateralOut.toUint128();
    }
}