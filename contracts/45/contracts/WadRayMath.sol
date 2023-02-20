//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title WadRayMath library
 * @dev Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)
 */

library WadRayMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant halfWAD = WAD / 2;

    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (halfWAD + a * b) / WAD;
    }

    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 halfB = b / 2;

        return (halfB + a * WAD) / b;
    }
}
