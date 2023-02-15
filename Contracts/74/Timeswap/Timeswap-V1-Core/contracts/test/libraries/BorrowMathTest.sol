// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {BorrowMath} from '../../libraries/BorrowMath.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract BorrowMathTest {
    using BorrowMath for IPair.State;

    function check(
        IPair.State memory state,
        uint112 xDecrease,
        uint112 yIncrease,
        uint112 zIncrease,
        uint16 fee
    ) external pure returns (bool) {
        state.check(
            xDecrease,
            yIncrease,
            zIncrease,
            fee
        );
        return true;
    }

    function getDebt(
        uint256 maturity,
        uint112 xDecrease,
        uint112 yIncrease
    ) external view returns (uint112 debtIn) {
        return BorrowMath.getDebt(
            maturity,
            xDecrease,
            yIncrease
        );
    }

    function getCollateral(
        uint256 maturity,
        IPair.State memory state,
        uint112 xDecrease,
        uint112 zIncrease
    ) external view returns (uint112 collateralIn) {
        return BorrowMath.getCollateral(
            maturity,
            state,
            xDecrease,
            zIncrease
        );
    }
}