// SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0 <= 0.9.0;

/// @notice A library for performing overflow-/underflow-safe math,
/// updated with awesomeness from of DappHub (https://github.com/dapphub/ds-math).
library BoringMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        require((c = a + b) >= b, "BoringMath: Add Overflow");
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256 c) {
        require((c = a - b) <= a, "BoringMath: Underflow");
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        require(b == 0 || (c = a * b) / b == a, "BoringMath: Mul Overflow");
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "BoringMath: division by zero");
        return a / b;
    }

    function to128(uint256 a) internal pure returns (uint128 c) {
        require(a <= type(uint128).max, "BoringMath: uint128 Overflow");
        c = uint128(a);
    }

    function to64(uint256 a) internal pure returns (uint64 c) {
        require(a <= type(uint64).max, "BoringMath: uint64 Overflow");
        c = uint64(a);
    }

    function to32(uint256 a) internal pure returns (uint32 c) {
        require(a <= type(uint32).max, "BoringMath: uint32 Overflow");
        c = uint32(a);
    }

    function to40(uint256 a) internal pure returns (uint40 c) {
        require(a <= type(uint40).max, "BoringMath: uint40 Overflow");
        c = uint40(a);
    }

    function to112(uint256 a) internal pure returns (uint112 c) {
        require(a <= type(uint112).max, "BoringMath: uint112 Overflow");
        c = uint112(a);
    }

    function to224(uint256 a) internal pure returns (uint224 c) {
        require(a <= type(uint224).max, "BoringMath: uint224 Overflow");
        c = uint224(a);
    }

    function to208(uint256 a) internal pure returns (uint208 c) {
        require(a <= type(uint208).max, "BoringMath: uint208 Overflow");
        c = uint208(a);
    }

    function to216(uint256 a) internal pure returns (uint216 c) {
        require(a <= type(uint216).max, "BoringMath: uint216 Overflow");
        c = uint216(a);
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint128.
library BoringMath128 {
    function add(uint128 a, uint128 b) internal pure returns (uint128 c) {
        require((c = a + b) >= b, "BoringMath: Add Overflow");
    }

    function sub(uint128 a, uint128 b) internal pure returns (uint128 c) {
        require((c = a - b) <= a, "BoringMath: Underflow");
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint64.
library BoringMath64 {
    function add(uint64 a, uint64 b) internal pure returns (uint64 c) {
        require((c = a + b) >= b, "BoringMath: Add Overflow");
    }

    function sub(uint64 a, uint64 b) internal pure returns (uint64 c) {
        require((c = a - b) <= a, "BoringMath: Underflow");
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint32.
library BoringMath32 {
    function add(uint32 a, uint32 b) internal pure returns (uint32 c) {
        require((c = a + b) >= b, "BoringMath: Add Overflow");
    }

    function sub(uint32 a, uint32 b) internal pure returns (uint32 c) {
        require((c = a - b) <= a, "BoringMath: Underflow");
    }

    function mul(uint32 a, uint32 b) internal pure returns (uint32 c) {
        require(b == 0 || (c = a * b) / b == a, "BoringMath: Mul Overflow");
    }

    function div(uint32 a, uint32 b) internal pure returns (uint32) {
        require(b > 0, "BoringMath: division by zero");
        return a / b;
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint112.
library BoringMath112 {
    function add(uint112 a, uint112 b) internal pure returns (uint112 c) {
        require((c = a + b) >= b, "BoringMath: Add Overflow");
    }

    function sub(uint112 a, uint112 b) internal pure returns (uint112 c) {
        require((c = a - b) <= a, "BoringMath: Underflow");
    }

    function mul(uint112 a, uint112 b) internal pure returns (uint112 c) {
        require(b == 0 || (c = a * b) / b == a, "BoringMath: Mul Overflow");
    }

    function div(uint112 a, uint112 b) internal pure returns (uint112) {
        require(b > 0, "BoringMath: division by zero");
        return a / b;
    }
}

/// @notice A library for performing overflow-/underflow-safe addition and subtraction on uint224.
library BoringMath224 {
    function add(uint224 a, uint224 b) internal pure returns (uint224 c) {
        require((c = a + b) >= b, "BoringMath: Add Overflow");
    }

    function sub(uint224 a, uint224 b) internal pure returns (uint224 c) {
        require((c = a - b) <= a, "BoringMath: Underflow");
    }

    function mul(uint224 a, uint224 b) internal pure returns (uint224 c) {
        require(b == 0 || (c = a * b) / b == a, "BoringMath: Mul Overflow");
    }

    function div(uint224 a, uint224 b) internal pure returns (uint224) {
        require(b > 0, "BoringMath: division by zero");
        return a / b;
    }
}
