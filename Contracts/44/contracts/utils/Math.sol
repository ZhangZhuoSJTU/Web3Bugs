pragma solidity ^0.8.0;

library Math {

    function subOrZero(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : 0;
    }

    function subOrZero(uint128 a, uint128 b) internal pure returns (uint128) {
        return a > b ? a - b : 0;
    }

    function subOrZero(uint64 a, uint64 b) internal pure returns (uint64) {
        return a > b ? a - b : 0;
    }

    function subOrZero(uint32 a, uint32 b) internal pure returns (uint32) {
        return a > b ? a - b : 0;
    }
}
