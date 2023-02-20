// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

/// @notice A library that contains functions for calculating differences between two uint256.
/// @author Adapted from https://github.com/saddle-finance/saddle-contract/blob/master/contracts/MathUtils.sol.
library MathUtils {
    /// @notice Compares a and b and returns 'true' if the difference between a and b
    /// is less than 1 or equal to each other.
    /// @param a uint256 to compare with.
    /// @param b uint256 to compare with.
    /// @return wn 'True' if the difference between a and b is less than 1 or equal,
    /// otherwise return 'false'.
    function within1(uint256 a, uint256 b) internal pure returns (bool wn) {
        wn = difference(a, b) <= 1;
    }

    /// @notice Calculates absolute difference between a and b.
    /// @param a uint256 to compare with.
    /// @param b uint256 to compare with.
    /// @return diff Difference between a and b.
    function difference(uint256 a, uint256 b) internal pure returns (uint256 diff) {
        unchecked {
            if (a > b) {
                diff = a - b;
            }
            diff = b - a;
        }
    }
}
