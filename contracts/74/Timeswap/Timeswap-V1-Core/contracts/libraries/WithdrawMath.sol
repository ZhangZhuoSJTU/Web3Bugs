// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '../interfaces/IPair.sol';
import {SafeCast} from './SafeCast.sol';

/// @title BurnMath library
/// @author Timeswap Labs
library WithdrawMath {
    using SafeCast for uint256;

    /// @dev Get the asset for the liquidity burned.
    /// @param state The pool state.
    /// @param bondIn The amount of bond balance balance burnt by the msg.sender.
    function getAsset(IPair.State memory state, uint128 bondIn) internal pure returns (uint128 assetOut) {
        if (state.reserves.asset >= state.totalClaims.bond) return assetOut = bondIn;
        uint256 _assetOut = bondIn;
        _assetOut *= state.reserves.asset;
        _assetOut /= state.totalClaims.bond;
        assetOut = _assetOut.toUint128();
    }

    /// @dev Get the collateral for the liquidity burned.
    /// @param state The pool state.
    /// @param insuranceIn The amount of insurance balance burnt by the msg.sender.
    function getCollateral(IPair.State memory state, uint128 insuranceIn)
        internal
        pure
        returns (uint128 collateralOut)
    {
        if (state.reserves.asset >= state.totalClaims.bond) return collateralOut;
        uint256 deficit = state.totalClaims.bond;
        deficit -= state.reserves.asset;
        if (uint256(state.reserves.collateral) * state.totalClaims.bond >= deficit * state.totalClaims.insurance) {
            uint256 _collateralOut = deficit;
            _collateralOut *= insuranceIn;
            _collateralOut /= state.totalClaims.bond;
            return collateralOut = _collateralOut.toUint128();
        }
        uint256 __collateralOut = state.reserves.collateral;
        __collateralOut *= insuranceIn;
        __collateralOut /= state.totalClaims.insurance;
        collateralOut = __collateralOut.toUint128();
    }
}
