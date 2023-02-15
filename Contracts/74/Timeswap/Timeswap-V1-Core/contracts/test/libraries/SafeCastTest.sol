// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {SafeCast} from '../../libraries/SafeCast.sol';

contract SafeCastTest {
    function modUint32(uint256 x) external pure returns (uint32 y) {
        return SafeCast.modUint32(x);
    }
    
    function toUint112(uint256 x) external pure returns (uint112 y) {
        return SafeCast.toUint112(x);
    }

    function toUint128(uint256 x) external pure returns (uint128 y) {
        return SafeCast.toUint128(x);
    }

    function truncateUint112(uint256 x) external pure returns (uint112 y) {
        return SafeCast.truncateUint112(x);
    }
}