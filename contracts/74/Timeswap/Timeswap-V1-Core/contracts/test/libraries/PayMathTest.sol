// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {PayMath} from '../../libraries/PayMath.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract PayMathTest {
    function checkProportional(
        uint112 assetIn,
        uint112 collateralOut,
        IPair.Due memory due
    ) external pure returns (bool) {
        PayMath.checkProportional(assetIn, collateralOut, due);
        return true;
    }
}