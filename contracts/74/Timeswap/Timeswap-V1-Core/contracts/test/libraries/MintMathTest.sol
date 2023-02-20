// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {MintMath} from '../../libraries/MintMath.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract MintMathTest {
    function getLiquidityTotal1(
        uint112 xIncrease
    ) external pure returns (uint256 liquidityTotal) {
        return MintMath.getLiquidityTotal(xIncrease);
    }

    function getLiquidityTotal2(
        IPair.State memory state,
        uint112 xIncrease,
        uint112 yIncrease,
        uint112 zIncrease
    ) external pure returns (uint256 liquidityTotal) {
        return MintMath.getLiquidityTotal(
            state,
            xIncrease,
            yIncrease,
            zIncrease
        );
    }

    function getLiquidity(
        uint256 maturity,
        uint256 liquidityTotal,
        uint16 protocolFee
    ) external view returns (uint256 liquidityOut) {
        return MintMath.getLiquidity(
            maturity,
            liquidityTotal,
            protocolFee
        );
    }

    function getDebt(
        uint256 maturity,
        uint112 xIncrease,
        uint112 yIncrease
    ) external view returns (uint112 debtIn) {
        return MintMath.getDebt(
            maturity,
            xIncrease,
            yIncrease
        );
    }

    function getCollateral(
        uint256 maturity,
        uint112 zIncrease
    ) external view returns (uint112 collateralIn) {
        return MintMath.getCollateral(
            maturity,
            zIncrease
        );
    }
}