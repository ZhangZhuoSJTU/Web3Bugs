// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

import "./Bitmap.sol";

/**
 * Packs an uint value into a "floating point" storage slot. Used for storing
 * lastClaimIntegralSupply values in balance storage. For these values, we don't need
 * to maintain exact precision but we don't want to be limited by storage size overflows.
 *
 * A floating point value is defined by the 48 most significant bits and an 8 bit number
 * of bit shifts required to restore its precision. The unpacked value will always be less
 * than the packed value with a maximum absolute loss of precision of (2 ** bitShift) - 1.
 */
library FloatingPoint56 {

    function packTo56Bits(uint256 value) internal pure returns (uint56) {
        uint256 bitShift;
        // If the value is over the uint48 max value then we will shift it down
        // given the index of the most significant bit. We store this bit shift 
        // in the least significant byte of the 56 bit slot available.
        if (value > type(uint48).max) bitShift = (Bitmap.getMSB(value) - 47);

        uint256 shiftedValue = value >> bitShift;
        return uint56((shiftedValue << 8) | bitShift);
    }

    function unpackFrom56Bits(uint256 value) internal pure returns (uint256) {
        // The least significant 8 bits will be the amount to bit shift
        uint256 bitShift = uint256(uint8(value));
        return ((value >> 8) << bitShift);
    }

}
