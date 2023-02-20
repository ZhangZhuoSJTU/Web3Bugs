// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {BurnMath} from '../../libraries/BurnMath.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract BurnMathTest {
    function getAsset(
        IPair.State memory state,
        uint256 liquidityIn
    ) external pure returns (uint128 assetOut) {
        return BurnMath.getAsset(
            state,
            liquidityIn
        );
    }

    function getCollateral(
        IPair.State memory state,
        uint256 liquidityIn
    ) external pure returns (uint128 collateralOut) {
        return BurnMath.getCollateral(
            state,
            liquidityIn
        );
    }
}