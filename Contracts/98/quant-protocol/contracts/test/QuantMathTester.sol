// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "../libraries/QuantMath.sol";

contract QuantMathTester {
    using QuantMath for QuantMath.FixedPointInt;

    function testFromUnscaledInt(int256 a)
        external
        pure
        returns (QuantMath.FixedPointInt memory)
    {
        return QuantMath.fromUnscaledInt(a);
    }

    function testFromScaledUint(uint256 a, uint256 decimals)
        external
        pure
        returns (QuantMath.FixedPointInt memory)
    {
        return QuantMath.fromScaledUint(a, decimals);
    }

    function testToScaledUint(
        QuantMath.FixedPointInt memory a,
        uint256 decimals,
        bool roundDown
    ) external pure returns (uint256) {
        return QuantMath.toScaledUint(a, decimals, roundDown);
    }

    function testAdd(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (QuantMath.FixedPointInt memory) {
        return a.add(b);
    }

    function testSub(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (QuantMath.FixedPointInt memory) {
        return a.sub(b);
    }

    function testMul(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (QuantMath.FixedPointInt memory) {
        return a.mul(b);
    }

    function testDiv(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (QuantMath.FixedPointInt memory) {
        return a.div(b);
    }

    function testMin(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (QuantMath.FixedPointInt memory) {
        return QuantMath.min(a, b);
    }

    function testMax(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (QuantMath.FixedPointInt memory) {
        return QuantMath.max(a, b);
    }

    function testIsEqual(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (bool) {
        return a.isEqual(b);
    }

    function testIsGreaterThan(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (bool) {
        return a.isGreaterThan(b);
    }

    function testIsGreaterThanOrEqual(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (bool) {
        return a.isGreaterThanOrEqual(b);
    }

    function testIsLessThan(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (bool) {
        return a.isLessThan(b);
    }

    function testIsLessThanOrEqual(
        QuantMath.FixedPointInt memory a,
        QuantMath.FixedPointInt memory b
    ) external pure returns (bool) {
        return a.isLessThanOrEqual(b);
    }
}
