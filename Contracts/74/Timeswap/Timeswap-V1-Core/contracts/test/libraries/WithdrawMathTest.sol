// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {WithdrawMath} from '../../libraries/WithdrawMath.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract WithdrawMathTest {
    function getAsset(
        IPair.State memory state,
        uint128 bondIn
    ) external pure returns (uint128 assetOut) {
        return WithdrawMath.getAsset(
            state,
            bondIn
        );
    }

    function getCollateral(
        IPair.State memory state,
        uint128 insuranceIn
    ) external pure returns (uint128 collateralOut) {
        return WithdrawMath.getCollateral(
            state,
            insuranceIn
        );
    }
}