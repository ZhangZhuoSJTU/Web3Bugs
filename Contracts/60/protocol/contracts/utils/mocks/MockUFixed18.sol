// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../types/UFixed18.sol";

contract MockUFixed18 {
    function zero() external pure returns (UFixed18) {
        return UFixed18Lib.ZERO;
    }

    function one() external pure returns (UFixed18) {
        return UFixed18Lib.ONE;
    }

    function from(Fixed18 a) external pure returns (UFixed18) {
        return UFixed18Lib.from(a);
    }

    function from(uint256 a) external pure returns (UFixed18) {
        return UFixed18Lib.from(a);
    }

    function isZero(UFixed18 a) external pure returns (bool) {
        return UFixed18Lib.isZero(a);
    }

    function add(UFixed18 a, UFixed18 b) external pure returns (UFixed18) {
        return UFixed18Lib.add(a, b);
    }

    function sub(UFixed18 a, UFixed18 b) external pure returns (UFixed18) {
        return UFixed18Lib.sub(a, b);
    }

    function mul(UFixed18 a, UFixed18 b) external pure returns (UFixed18) {
        return UFixed18Lib.mul(a, b);
    }

    function div(UFixed18 a, UFixed18 b) external pure returns (UFixed18) {
        return UFixed18Lib.div(a, b);
    }

    function eq(UFixed18 a, UFixed18 b) external pure returns (bool) {
        return UFixed18Lib.eq(a, b);
    }

    function gt(UFixed18 a, UFixed18 b) external pure returns (bool) {
        return UFixed18Lib.gt(a, b);
    }

    function lt(UFixed18 a, UFixed18 b) external pure returns (bool) {
        return UFixed18Lib.lt(a, b);
    }

    function gte(UFixed18 a, UFixed18 b) external pure returns (bool) {
        return UFixed18Lib.gte(a, b);
    }

    function lte(UFixed18 a, UFixed18 b) external pure returns (bool) {
        return UFixed18Lib.lte(a, b);
    }

    function compare(UFixed18 a, UFixed18 b) external pure returns (uint256) {
        return UFixed18Lib.compare(a, b);
    }

    function ratio(uint256 a, uint256 b) external pure returns (UFixed18) {
        return UFixed18Lib.ratio(a, b);
    }

    function min(UFixed18 a, UFixed18 b) external pure returns (UFixed18) {
        return UFixed18Lib.min(a, b);
    }

    function max(UFixed18 a, UFixed18 b) external pure returns (UFixed18) {
        return UFixed18Lib.max(a, b);
    }

    function truncate(UFixed18 a) external pure returns (uint256) {
        return UFixed18Lib.truncate(a);
    }
}
