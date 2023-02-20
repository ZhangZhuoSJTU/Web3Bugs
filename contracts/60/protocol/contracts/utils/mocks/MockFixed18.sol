// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../types/Fixed18.sol";

contract MockFixed18 {
    function zero() external pure returns (Fixed18) {
        return Fixed18Lib.ZERO;
    }

    function one() external pure returns (Fixed18) {
        return Fixed18Lib.ONE;
    }

    function negOne() external pure returns (Fixed18) {
        return Fixed18Lib.NEG_ONE;
    }

    function from(UFixed18 a) external pure returns (Fixed18) {
        return Fixed18Lib.from(a);
    }

    function from(int256 s, UFixed18 m) external pure returns (Fixed18) {
        return Fixed18Lib.from(s, m);
    }

    function from(int256 a) external pure returns (Fixed18) {
        return Fixed18Lib.from(a);
    }

    function isZero(Fixed18 a) external pure returns (bool) {
        return Fixed18Lib.isZero(a);
    }

    function add(Fixed18 a, Fixed18 b) external pure returns (Fixed18) {
        return Fixed18Lib.add(a, b);
    }

    function sub(Fixed18 a, Fixed18 b) external pure returns (Fixed18) {
        return Fixed18Lib.sub(a, b);
    }

    function mul(Fixed18 a, Fixed18 b) external pure returns (Fixed18) {
        return Fixed18Lib.mul(a, b);
    }

    function div(Fixed18 a, Fixed18 b) external pure returns (Fixed18) {
        return Fixed18Lib.div(a, b);
    }

    function eq(Fixed18 a, Fixed18 b) external pure returns (bool) {
        return Fixed18Lib.eq(a, b);
    }

    function gt(Fixed18 a, Fixed18 b) external pure returns (bool) {
        return Fixed18Lib.gt(a, b);
    }

    function lt(Fixed18 a, Fixed18 b) external pure returns (bool) {
        return Fixed18Lib.lt(a, b);
    }

    function gte(Fixed18 a, Fixed18 b) external pure returns (bool) {
        return Fixed18Lib.gte(a, b);
    }

    function lte(Fixed18 a, Fixed18 b) external pure returns (bool) {
        return Fixed18Lib.lte(a, b);
    }

    function compare(Fixed18 a, Fixed18 b) external pure returns (uint256) {
        return Fixed18Lib.compare(a, b);
    }

    function ratio(int256 a, int256 b) external pure returns (Fixed18) {
        return Fixed18Lib.ratio(a, b);
    }

    function min(Fixed18 a, Fixed18 b) external pure returns (Fixed18) {
        return Fixed18Lib.min(a, b);
    }

    function max(Fixed18 a, Fixed18 b) external pure returns (Fixed18) {
        return Fixed18Lib.max(a, b);
    }

    function truncate(Fixed18 a) external pure returns (int256) {
        return Fixed18Lib.truncate(a);
    }

    function sign(Fixed18 a) external pure returns (int256) {
        return Fixed18Lib.sign(a);
    }

    function abs(Fixed18 a) external pure returns (UFixed18) {
        return Fixed18Lib.abs(a);
    }
}
