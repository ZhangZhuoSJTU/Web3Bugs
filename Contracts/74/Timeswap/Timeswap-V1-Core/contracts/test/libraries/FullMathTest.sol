// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {FullMath} from '../../libraries/FullMath.sol';

contract FullMathTest {
    function mul512(uint256 a, uint256 b) external pure returns (uint256 prod0, uint256 prod1) {
        return FullMath.mul512(a, b);
    }

    function mulDiv(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) external pure returns (uint256 result) {
        return FullMath.mulDiv(a, b, denominator);
    }

    function mulDivUp(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) external pure returns (uint256 result) {
        return FullMath.mulDivUp(a, b, denominator);
    }
}