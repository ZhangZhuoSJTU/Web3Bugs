// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { AuraMath, AuraMath32, AuraMath112, AuraMath224 } from "../AuraMath.sol";

// solhint-disable func-name-mixedcase
contract MockAuraMath {
    constructor() {}

    function AuraMath_min(uint256 a, uint256 b) external pure returns (uint256) {
        return AuraMath.min(a, b);
    }

    function AuraMath_add(uint256 a, uint256 b) external pure returns (uint256) {
        return AuraMath.add(a, b);
    }

    function AuraMath_sub(uint256 a, uint256 b) external pure returns (uint256) {
        return AuraMath.sub(a, b);
    }

    function AuraMath_mul(uint256 a, uint256 b) external pure returns (uint256) {
        return AuraMath.mul(a, b);
    }

    function AuraMath_div(uint256 a, uint256 b) external pure returns (uint256) {
        return AuraMath.div(a, b);
    }

    function AuraMath_average(uint256 a, uint256 b) external pure returns (uint256) {
        return AuraMath.average(a, b);
    }

    function AuraMath_to224(uint256 a) external pure returns (uint224) {
        return AuraMath.to224(a);
    }

    function AuraMath_to128(uint256 a) external pure returns (uint128) {
        return AuraMath.to128(a);
    }

    function AuraMath_to112(uint256 a) external pure returns (uint112) {
        return AuraMath.to112(a);
    }

    function AuraMath_to96(uint256 a) external pure returns (uint96) {
        return AuraMath.to96(a);
    }

    function AuraMath_to32(uint256 a) external pure returns (uint32) {
        return AuraMath.to32(a);
    }

    function AuraMath32_sub(uint32 a, uint32 b) external pure returns (uint32) {
        return AuraMath32.sub(a, b);
    }

    function AuraMath112_add(uint112 a, uint112 b) external pure returns (uint112) {
        return AuraMath112.add(a, b);
    }

    function AuraMath112_sub(uint112 a, uint112 b) external pure returns (uint112) {
        return AuraMath112.sub(a, b);
    }

    function AuraMath224_add(uint224 a, uint224 b) external pure returns (uint224) {
        return AuraMath224.add(a, b);
    }
}
