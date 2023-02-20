// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

library UncheckedMath {
    function uncheckedInc(uint256 a) internal pure returns (uint256) {
        unchecked {
            return a + 1;
        }
    }

    function uncheckedAdd(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            return a + b;
        }
    }

    function uncheckedSub(uint256 a, uint256 b) internal pure returns (uint256) {
        unchecked {
            return a - b;
        }
    }
}
