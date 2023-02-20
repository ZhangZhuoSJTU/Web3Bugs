// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

/// @title OverflowSafeComparatorLib library to share comparator functions between contracts
/// @dev Code taken from Uniswap V3 Oracle.sol: https://github.com/Uniswap/v3-core/blob/3e88af408132fc957e3e406f65a0ce2b1ca06c3d/contracts/libraries/Oracle.sol
/// @author PoolTogether Inc.
library OverflowSafeComparatorLib {
    /// @notice 32-bit timestamps comparator.
    /// @dev safe for 0 or 1 overflows, `_a` and `_b` must be chronologically before or equal to time.
    /// @param _a A comparison timestamp from which to determine the relative position of `_timestamp`.
    /// @param _b Timestamp to compare against `_a`.
    /// @param _timestamp A timestamp truncated to 32 bits.
    /// @return bool Whether `_a` is chronologically < `_b`.
    function lt(
        uint32 _a,
        uint32 _b,
        uint32 _timestamp
    ) internal pure returns (bool) {
        // No need to adjust if there hasn't been an overflow
        if (_a <= _timestamp && _b <= _timestamp) return _a < _b;

        uint256 aAdjusted = _a > _timestamp ? _a : _a + 2**32;
        uint256 bAdjusted = _b > _timestamp ? _b : _b + 2**32;

        return aAdjusted < bAdjusted;
    }

    /// @notice 32-bit timestamps comparator.
    /// @dev safe for 0 or 1 overflows, `_a` and `_b` must be chronologically before or equal to time.
    /// @param _a A comparison timestamp from which to determine the relative position of `_timestamp`.
    /// @param _b Timestamp to compare against `_a`.
    /// @param _timestamp A timestamp truncated to 32 bits.
    /// @return bool Whether `_a` is chronologically <= `_b`.
    function lte(
        uint32 _a,
        uint32 _b,
        uint32 _timestamp
    ) internal pure returns (bool) {

        // No need to adjust if there hasn't been an overflow
        if (_a <= _timestamp && _b <= _timestamp) return _a <= _b;

        uint256 aAdjusted = _a > _timestamp ? _a : _a + 2**32;
        uint256 bAdjusted = _b > _timestamp ? _b : _b + 2**32;

        return aAdjusted <= bAdjusted;
    }

    /// @notice 32-bit timestamp subtractor
    /// @dev safe for 0 or 1 overflows, where `_a` and `_b` must be chronologically before or equal to time
    /// @param _a The subtraction left operand
    /// @param _b The subtraction right operand
    /// @param _timestamp The current time.  Expected to be chronologically after both.
    /// @return The difference between a and b, adjusted for overflow
    function checkedSub(
        uint32 _a,
        uint32 _b,
        uint32 _timestamp
    ) internal pure returns (uint32) {
        // No need to adjust if there hasn't been an overflow

        if (_a <= _timestamp && _b <= _timestamp) return _a - _b;

        uint256 aAdjusted = _a > _timestamp ? _a : _a + 2**32;
        uint256 bAdjusted = _b > _timestamp ? _b : _b + 2**32;

        return uint32(aAdjusted - bAdjusted);
    }
}
