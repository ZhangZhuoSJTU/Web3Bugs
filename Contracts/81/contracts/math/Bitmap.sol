// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

import "../global/Types.sol";
import "../global/Constants.sol";

/// @notice Helper methods for bitmaps, they are big-endian and 1-indexed.
library Bitmap {

    /// @notice Set a bit on or off in a bitmap, index is 1-indexed
    function setBit(
        bytes32 bitmap,
        uint256 index,
        bool setOn
    ) internal pure returns (bytes32) {
        require(index >= 1 && index <= 256); // dev: set bit index bounds

        if (setOn) {
            return bitmap | (Constants.MSB >> (index - 1));
        } else {
            return bitmap & ~(Constants.MSB >> (index - 1));
        }
    }

    /// @notice Check if a bit is set
    function isBitSet(bytes32 bitmap, uint256 index) internal pure returns (bool) {
        require(index >= 1 && index <= 256); // dev: set bit index bounds
        return ((bitmap << (index - 1)) & Constants.MSB) == Constants.MSB;
    }

    /// @notice Count the total bits set
    function totalBitsSet(bytes32 bitmap) internal pure returns (uint256) {
        uint256 x = uint256(bitmap);
        x = (x & 0x5555555555555555555555555555555555555555555555555555555555555555) + (x >> 1 & 0x5555555555555555555555555555555555555555555555555555555555555555);
        x = (x & 0x3333333333333333333333333333333333333333333333333333333333333333) + (x >> 2 & 0x3333333333333333333333333333333333333333333333333333333333333333);
        x = (x & 0x0707070707070707070707070707070707070707070707070707070707070707) + (x >> 4);
        x = (x & 0x000F000F000F000F000F000F000F000F000F000F000F000F000F000F000F000F) + (x >> 8 & 0x000F000F000F000F000F000F000F000F000F000F000F000F000F000F000F000F);
        x = x + (x >> 16);
        x = x + (x >> 32);
        x = x  + (x >> 64);
        return (x & 0xFF) + (x >> 128 & 0xFF);
    }

    // Does a binary search over x to get the position of the most significant bit
    function getMSB(uint256 x) internal pure returns (uint256 msb) {
        // If x == 0 then there is no MSB and this method will return zero. That would
        // be the same as the return value when x == 1 (MSB is zero indexed), so instead
        // we have this require here to ensure that the values don't get mixed up.
        require(x != 0); // dev: get msb zero value
        if (x >= 0x100000000000000000000000000000000) {
            x >>= 128;
            msb += 128;
        }
        if (x >= 0x10000000000000000) {
            x >>= 64;
            msb += 64;
        }
        if (x >= 0x100000000) {
            x >>= 32;
            msb += 32;
        }
        if (x >= 0x10000) {
            x >>= 16;
            msb += 16;
        }
        if (x >= 0x100) {
            x >>= 8;
            msb += 8;
        }
        if (x >= 0x10) {
            x >>= 4;
            msb += 4;
        }
        if (x >= 0x4) {
            x >>= 2;
            msb += 2;
        }
        if (x >= 0x2) msb += 1; // No need to shift xc anymore
    }

    /// @dev getMSB returns a zero indexed bit number where zero is the first bit counting
    /// from the right (little endian). Asset Bitmaps are counted from the left (big endian)
    /// and one indexed.
    function getNextBitNum(bytes32 bitmap) internal pure returns (uint256 bitNum) {
        // Short circuit the search if bitmap is all zeros
        if (bitmap == 0x00) return 0;

        return 255 - getMSB(uint256(bitmap)) + 1;
    }
}
