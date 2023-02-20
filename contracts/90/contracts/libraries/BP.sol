// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Base point library
/// @notice Contains constant used to prevent underflow of math operations
library BP {
    /// @notice Base point number
    /// @dev Used to prevent underflow of math operations
    uint16 constant DECIMAL_FACTOR = 10_000;
}
