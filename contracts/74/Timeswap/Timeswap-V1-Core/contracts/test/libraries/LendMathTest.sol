// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {LendMath} from '../../libraries/LendMath.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract LendMathTest {
    using LendMath for IPair.State;

    function check(
        IPair.State memory state,
        uint112 xIncrease,
        uint112 yDecrease,
        uint112 zDecrease,
        uint16 fee
    ) external pure returns (bool) {
        state.check(
            xIncrease,
            yDecrease,
            zDecrease,
            fee
        );
        return true;
    }

    function getBond(
        uint256 maturity,
        uint112 xIncrease,
        uint112 yDecrease
    ) external view returns (uint128 bondOut) {
        return LendMath.getBond(
            maturity,
            xIncrease,
            yDecrease
        );
    }

    function getInsurance(
        uint256 maturity,
        IPair.State memory state,
        uint112 xIncrease,
        uint112 zDecrease
    ) external view returns (uint128 insuranceOut) {
        return LendMath.getInsurance(
            maturity,
            state,
            xIncrease,
            zDecrease
        );
    }
}