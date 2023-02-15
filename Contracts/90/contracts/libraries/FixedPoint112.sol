// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title FixedPoint112
/// @notice A library for handling binary fixed point numbers, see https://en.wikipedia.org/wiki/Q_(number_format)
library FixedPoint112 {
    uint8 internal constant RESOLUTION = 112;
    /// @dev 2**112
    uint256 internal constant Q112 = 0x10000000000000000000000000000;
}
