// SPDX-License-Identifier: BUSL-1.1
pragma solidity >= 0.8.0;

import "./Math64x64.sol";

library Exp64x64 {
  /**
   * Raise given number x into power specified as a simple fraction y/z and then
   * multiply the result by the normalization factor 2^(128 * (1 - y/z)).
   * Revert if z is zero, or if both x and y are zeros.
   *
   * @param x number to raise into given power y/z
   * @param y numerator of the power to raise x into
   * @param z denominator of the power to raise x into
   * @return x raised into power y/z and then multiplied by 2^(128 * (1 - y/z))
   */
  function pow(uint128 x, uint128 y, uint128 z)
  internal pure returns(uint128) {
    unchecked {
      require(z != 0);

      if(x == 0) {
        require(y != 0);
        return 0;
      } else {
        uint256 l =
          uint256(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF - log_2(x)) * y / z;
        if(l > 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) return 0;
        else return pow_2(uint128(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF - l));
      }
    }
  }

  /**
   * Calculate base 2 logarithm of an unsigned 128-bit integer number.  Revert
   * in case x is zero.
   *
   * @param x number to calculate base 2 logarithm of
   * @return base 2 logarithm of x, multiplied by 2^121
   */
  function log_2(uint128 x)
  internal pure returns(uint128) {
    unchecked {
      require(x != 0);

      uint b = x;

      uint l = 0xFE000000000000000000000000000000;

      if(b < 0x10000000000000000) {l -= 0x80000000000000000000000000000000; b <<= 64;}
      if(b < 0x1000000000000000000000000) {l -= 0x40000000000000000000000000000000; b <<= 32;}
      if(b < 0x10000000000000000000000000000) {l -= 0x20000000000000000000000000000000; b <<= 16;}
      if(b < 0x1000000000000000000000000000000) {l -= 0x10000000000000000000000000000000; b <<= 8;}
      if(b < 0x10000000000000000000000000000000) {l -= 0x8000000000000000000000000000000; b <<= 4;}
      if(b < 0x40000000000000000000000000000000) {l -= 0x4000000000000000000000000000000; b <<= 2;}
      if(b < 0x80000000000000000000000000000000) {l -= 0x2000000000000000000000000000000; b <<= 1;}

      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000000000;} /*
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x1000;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x800;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x400;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x200;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x100;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x80;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x40;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x20;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x10;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x8;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x4;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) {b >>= 1; l |= 0x2;}
      b = b * b >> 127; if(b > 0x100000000000000000000000000000000) l |= 0x1; */

      return uint128(l);
    }
  }

  /**
   * Calculate 2 raised into given power.
   *
   * @param x power to raise 2 into, multiplied by 2^121
   * @return 2 raised into given power
   */
  function pow_2(uint128 x)
  internal pure returns(uint128) {
    unchecked {
      uint r = 0x80000000000000000000000000000000;
      if(x & 0x1000000000000000000000000000000 > 0) r = r * 0xb504f333f9de6484597d89b3754abe9f >> 127;
      if(x & 0x800000000000000000000000000000 > 0) r = r * 0x9837f0518db8a96f46ad23182e42f6f6 >> 127;
      if(x & 0x400000000000000000000000000000 > 0) r = r * 0x8b95c1e3ea8bd6e6fbe4628758a53c90 >> 127;
      if(x & 0x200000000000000000000000000000 > 0) r = r * 0x85aac367cc487b14c5c95b8c2154c1b2 >> 127;
      if(x & 0x100000000000000000000000000000 > 0) r = r * 0x82cd8698ac2ba1d73e2a475b46520bff >> 127;
      if(x & 0x80000000000000000000000000000 > 0) r = r * 0x8164d1f3bc0307737be56527bd14def4 >> 127;
      if(x & 0x40000000000000000000000000000 > 0) r = r * 0x80b1ed4fd999ab6c25335719b6e6fd20 >> 127;
      if(x & 0x20000000000000000000000000000 > 0) r = r * 0x8058d7d2d5e5f6b094d589f608ee4aa2 >> 127;
      if(x & 0x10000000000000000000000000000 > 0) r = r * 0x802c6436d0e04f50ff8ce94a6797b3ce >> 127;
      if(x & 0x8000000000000000000000000000 > 0) r = r * 0x8016302f174676283690dfe44d11d008 >> 127;
      if(x & 0x4000000000000000000000000000 > 0) r = r * 0x800b179c82028fd0945e54e2ae18f2f0 >> 127;
      if(x & 0x2000000000000000000000000000 > 0) r = r * 0x80058baf7fee3b5d1c718b38e549cb93 >> 127;
      if(x & 0x1000000000000000000000000000 > 0) r = r * 0x8002c5d00fdcfcb6b6566a58c048be1f >> 127;
      if(x & 0x800000000000000000000000000 > 0) r = r * 0x800162e61bed4a48e84c2e1a463473d9 >> 127;
      if(x & 0x400000000000000000000000000 > 0) r = r * 0x8000b17292f702a3aa22beacca949013 >> 127;
      if(x & 0x200000000000000000000000000 > 0) r = r * 0x800058b92abbae02030c5fa5256f41fe >> 127;
      if(x & 0x100000000000000000000000000 > 0) r = r * 0x80002c5c8dade4d71776c0f4dbea67d6 >> 127;
      if(x & 0x80000000000000000000000000 > 0) r = r * 0x8000162e44eaf636526be456600bdbe4 >> 127;
      if(x & 0x40000000000000000000000000 > 0) r = r * 0x80000b1721fa7c188307016c1cd4e8b6 >> 127;
      if(x & 0x20000000000000000000000000 > 0) r = r * 0x8000058b90de7e4cecfc487503488bb1 >> 127;
      if(x & 0x10000000000000000000000000 > 0) r = r * 0x800002c5c8678f36cbfce50a6de60b14 >> 127;
      if(x & 0x8000000000000000000000000 > 0) r = r * 0x80000162e431db9f80b2347b5d62e516 >> 127;
      if(x & 0x4000000000000000000000000 > 0) r = r * 0x800000b1721872d0c7b08cf1e0114152 >> 127;
      if(x & 0x2000000000000000000000000 > 0) r = r * 0x80000058b90c1aa8a5c3736cb77e8dff >> 127;
      if(x & 0x1000000000000000000000000 > 0) r = r * 0x8000002c5c8605a4635f2efc2362d978 >> 127;
      if(x & 0x800000000000000000000000 > 0) r = r * 0x800000162e4300e635cf4a109e3939bd >> 127;
      if(x & 0x400000000000000000000000 > 0) r = r * 0x8000000b17217ff81bef9c551590cf83 >> 127;
      if(x & 0x200000000000000000000000 > 0) r = r * 0x800000058b90bfdd4e39cd52c0cfa27c >> 127;
      if(x & 0x100000000000000000000000 > 0) r = r * 0x80000002c5c85fe6f72d669e0e76e411 >> 127;
      if(x & 0x80000000000000000000000 > 0) r = r * 0x8000000162e42ff18f9ad35186d0df28 >> 127;
      if(x & 0x40000000000000000000000 > 0) r = r * 0x80000000b17217f84cce71aa0dcfffe7 >> 127;
      if(x & 0x20000000000000000000000 > 0) r = r * 0x8000000058b90bfc07a77ad56ed22aaa >> 127;
      if(x & 0x10000000000000000000000 > 0) r = r * 0x800000002c5c85fdfc23cdead40da8d6 >> 127;
      if(x & 0x8000000000000000000000 > 0) r = r * 0x80000000162e42fefc25eb1571853a66 >> 127;
      if(x & 0x4000000000000000000000 > 0) r = r * 0x800000000b17217f7d97f692baacded5 >> 127;
      if(x & 0x2000000000000000000000 > 0) r = r * 0x80000000058b90bfbead3b8b5dd254d7 >> 127;
      if(x & 0x1000000000000000000000 > 0) r = r * 0x8000000002c5c85fdf4eedd62f084e67 >> 127;
      if(x & 0x800000000000000000000 > 0) r = r * 0x800000000162e42fefa58aef378bf586 >> 127;
      if(x & 0x400000000000000000000 > 0) r = r * 0x8000000000b17217f7d24a78a3c7ef02 >> 127;
      if(x & 0x200000000000000000000 > 0) r = r * 0x800000000058b90bfbe9067c93e474a6 >> 127;
      if(x & 0x100000000000000000000 > 0) r = r * 0x80000000002c5c85fdf47b8e5a72599f >> 127;
      if(x & 0x80000000000000000000 > 0) r = r * 0x8000000000162e42fefa3bdb315934a2 >> 127;
      if(x & 0x40000000000000000000 > 0) r = r * 0x80000000000b17217f7d1d7299b49c46 >> 127;
      if(x & 0x20000000000000000000 > 0) r = r * 0x8000000000058b90bfbe8e9a8d1c4ea0 >> 127;
      if(x & 0x10000000000000000000 > 0) r = r * 0x800000000002c5c85fdf4745969ea76f >> 127;
      if(x & 0x8000000000000000000 > 0) r = r * 0x80000000000162e42fefa3a0df5373bf >> 127;
      if(x & 0x4000000000000000000 > 0) r = r * 0x800000000000b17217f7d1cff4aac1e1 >> 127;
      if(x & 0x2000000000000000000 > 0) r = r * 0x80000000000058b90bfbe8e7db95a2f1 >> 127;
      if(x & 0x1000000000000000000 > 0) r = r * 0x8000000000002c5c85fdf473e61ae1f8 >> 127;
      if(x & 0x800000000000000000 > 0) r = r * 0x800000000000162e42fefa39f121751c >> 127;
      if(x & 0x400000000000000000 > 0) r = r * 0x8000000000000b17217f7d1cf815bb96 >> 127;
      if(x & 0x200000000000000000 > 0) r = r * 0x800000000000058b90bfbe8e7bec1e0d >> 127;
      if(x & 0x100000000000000000 > 0) r = r * 0x80000000000002c5c85fdf473dee5f17 >> 127;
      if(x & 0x80000000000000000 > 0) r = r * 0x8000000000000162e42fefa39ef5438f >> 127;
      if(x & 0x40000000000000000 > 0) r = r * 0x80000000000000b17217f7d1cf7a26c8 >> 127;
      if(x & 0x20000000000000000 > 0) r = r * 0x8000000000000058b90bfbe8e7bcf4a4 >> 127;
      if(x & 0x10000000000000000 > 0) r = r * 0x800000000000002c5c85fdf473de72a2 >> 127; /*
      if(x & 0x8000000000000000 > 0) r = r * 0x80000000000000162e42fefa39ef3765 >> 127;
      if(x & 0x4000000000000000 > 0) r = r * 0x800000000000000b17217f7d1cf79b37 >> 127;
      if(x & 0x2000000000000000 > 0) r = r * 0x80000000000000058b90bfbe8e7bcd7d >> 127;
      if(x & 0x1000000000000000 > 0) r = r * 0x8000000000000002c5c85fdf473de6b6 >> 127;
      if(x & 0x800000000000000 > 0) r = r * 0x800000000000000162e42fefa39ef359 >> 127;
      if(x & 0x400000000000000 > 0) r = r * 0x8000000000000000b17217f7d1cf79ac >> 127;
      if(x & 0x200000000000000 > 0) r = r * 0x800000000000000058b90bfbe8e7bcd6 >> 127;
      if(x & 0x100000000000000 > 0) r = r * 0x80000000000000002c5c85fdf473de6a >> 127;
      if(x & 0x80000000000000 > 0) r = r * 0x8000000000000000162e42fefa39ef35 >> 127;
      if(x & 0x40000000000000 > 0) r = r * 0x80000000000000000b17217f7d1cf79a >> 127;
      if(x & 0x20000000000000 > 0) r = r * 0x8000000000000000058b90bfbe8e7bcd >> 127;
      if(x & 0x10000000000000 > 0) r = r * 0x800000000000000002c5c85fdf473de6 >> 127;
      if(x & 0x8000000000000 > 0) r = r * 0x80000000000000000162e42fefa39ef3 >> 127;
      if(x & 0x4000000000000 > 0) r = r * 0x800000000000000000b17217f7d1cf79 >> 127;
      if(x & 0x2000000000000 > 0) r = r * 0x80000000000000000058b90bfbe8e7bc >> 127;
      if(x & 0x1000000000000 > 0) r = r * 0x8000000000000000002c5c85fdf473de >> 127;
      if(x & 0x800000000000 > 0) r = r * 0x800000000000000000162e42fefa39ef >> 127;
      if(x & 0x400000000000 > 0) r = r * 0x8000000000000000000b17217f7d1cf7 >> 127;
      if(x & 0x200000000000 > 0) r = r * 0x800000000000000000058b90bfbe8e7b >> 127;
      if(x & 0x100000000000 > 0) r = r * 0x80000000000000000002c5c85fdf473d >> 127;
      if(x & 0x80000000000 > 0) r = r * 0x8000000000000000000162e42fefa39e >> 127;
      if(x & 0x40000000000 > 0) r = r * 0x80000000000000000000b17217f7d1cf >> 127;
      if(x & 0x20000000000 > 0) r = r * 0x8000000000000000000058b90bfbe8e7 >> 127;
      if(x & 0x10000000000 > 0) r = r * 0x800000000000000000002c5c85fdf473 >> 127;
      if(x & 0x8000000000 > 0) r = r * 0x80000000000000000000162e42fefa39 >> 127;
      if(x & 0x4000000000 > 0) r = r * 0x800000000000000000000b17217f7d1c >> 127;
      if(x & 0x2000000000 > 0) r = r * 0x80000000000000000000058b90bfbe8e >> 127;
      if(x & 0x1000000000 > 0) r = r * 0x8000000000000000000002c5c85fdf47 >> 127;
      if(x & 0x800000000 > 0) r = r * 0x800000000000000000000162e42fefa3 >> 127;
      if(x & 0x400000000 > 0) r = r * 0x8000000000000000000000b17217f7d1 >> 127;
      if(x & 0x200000000 > 0) r = r * 0x800000000000000000000058b90bfbe8 >> 127;
      if(x & 0x100000000 > 0) r = r * 0x80000000000000000000002c5c85fdf4 >> 127;
      if(x & 0x80000000 > 0) r = r * 0x8000000000000000000000162e42fefa >> 127;
      if(x & 0x40000000 > 0) r = r * 0x80000000000000000000000b17217f7d >> 127;
      if(x & 0x20000000 > 0) r = r * 0x8000000000000000000000058b90bfbe >> 127;
      if(x & 0x10000000 > 0) r = r * 0x800000000000000000000002c5c85fdf >> 127;
      if(x & 0x8000000 > 0) r = r * 0x80000000000000000000000162e42fef >> 127;
      if(x & 0x4000000 > 0) r = r * 0x800000000000000000000000b17217f7 >> 127;
      if(x & 0x2000000 > 0) r = r * 0x80000000000000000000000058b90bfb >> 127;
      if(x & 0x1000000 > 0) r = r * 0x8000000000000000000000002c5c85fd >> 127;
      if(x & 0x800000 > 0) r = r * 0x800000000000000000000000162e42fe >> 127;
      if(x & 0x400000 > 0) r = r * 0x8000000000000000000000000b17217f >> 127;
      if(x & 0x200000 > 0) r = r * 0x800000000000000000000000058b90bf >> 127;
      if(x & 0x100000 > 0) r = r * 0x80000000000000000000000002c5c85f >> 127;
      if(x & 0x80000 > 0) r = r * 0x8000000000000000000000000162e42f >> 127;
      if(x & 0x40000 > 0) r = r * 0x80000000000000000000000000b17217 >> 127;
      if(x & 0x20000 > 0) r = r * 0x8000000000000000000000000058b90b >> 127;
      if(x & 0x10000 > 0) r = r * 0x800000000000000000000000002c5c85 >> 127;
      if(x & 0x8000 > 0) r = r * 0x80000000000000000000000000162e42 >> 127;
      if(x & 0x4000 > 0) r = r * 0x800000000000000000000000000b1721 >> 127;
      if(x & 0x2000 > 0) r = r * 0x80000000000000000000000000058b90 >> 127;
      if(x & 0x1000 > 0) r = r * 0x8000000000000000000000000002c5c8 >> 127;
      if(x & 0x800 > 0) r = r * 0x800000000000000000000000000162e4 >> 127;
      if(x & 0x400 > 0) r = r * 0x8000000000000000000000000000b172 >> 127;
      if(x & 0x200 > 0) r = r * 0x800000000000000000000000000058b9 >> 127;
      if(x & 0x100 > 0) r = r * 0x80000000000000000000000000002c5c >> 127;
      if(x & 0x80 > 0) r = r * 0x8000000000000000000000000000162e >> 127;
      if(x & 0x40 > 0) r = r * 0x80000000000000000000000000000b17 >> 127;
      if(x & 0x20 > 0) r = r * 0x8000000000000000000000000000058b >> 127;
      if(x & 0x10 > 0) r = r * 0x800000000000000000000000000002c5 >> 127;
      if(x & 0x8 > 0) r = r * 0x80000000000000000000000000000162 >> 127;
      if(x & 0x4 > 0) r = r * 0x800000000000000000000000000000b1 >> 127;
      if(x & 0x2 > 0) r = r * 0x80000000000000000000000000000058 >> 127;
      if(x & 0x1 > 0) r = r * 0x8000000000000000000000000000002c >> 127; */

      r >>= 127 -(x >> 121);

      return uint128(r);
    }
  }
}

/**
 * Ethereum smart contract library implementing Yield Math model.
 */
library YieldMath {
  using Math64x64 for int128;
  using Math64x64 for uint128;
  using Math64x64 for int256;
  using Math64x64 for uint256;
  using Exp64x64 for uint128;

  uint128 public constant ONE = 0x10000000000000000; // In 64.64
  uint256 public constant MAX = type(uint128).max;   // Used for overflow checks

  /**
   * Calculate the amount of fyToken a user would get for given amount of Base.
   * https://www.desmos.com/calculator/5nf2xuy6yb
   * @param baseReserves base reserves amount
   * @param fyTokenReserves fyToken reserves amount
   * @param baseAmount base amount to be traded
   * @param timeTillMaturity time till maturity in seconds
   * @param k time till maturity coefficient, multiplied by 2^64
   * @param g fee coefficient, multiplied by 2^64
   * @return the amount of fyToken a user would get for given amount of Base
   */
  function fyTokenOutForBaseIn(
    uint128 baseReserves, uint128 fyTokenReserves, uint128 baseAmount,
    uint128 timeTillMaturity, int128 k, int128 g)
  public pure returns(uint128) {
    unchecked {
      uint128 a = _computeA(timeTillMaturity, k, g);

      // za = baseReserves ** a
      uint256 za = baseReserves.pow(a, ONE);

      // ya = fyTokenReserves ** a
      uint256 ya = fyTokenReserves.pow(a, ONE);

      // zx = baseReserves + baseAmount
      uint256 zx = uint256(baseReserves) + uint256(baseAmount);
      require(zx <= MAX, "YieldMath: Too much base in");

      // zxa = zx ** a
      uint256 zxa = uint128(zx).pow(a, ONE);

      // sum = za + ya - zxa
      uint256 sum = za + ya - zxa; // z < MAX, y < MAX, a < 1. It can only underflow, not overflow.
      require(sum <= MAX, "YieldMath: Insufficient fyToken reserves");

      // result = fyTokenReserves - (sum ** (1/a))
      uint256 result = uint256(fyTokenReserves) - uint256(uint128(sum).pow(ONE, a));
      require(result <= MAX, "YieldMath: Rounding induced error");

      result = result > 1e12 ? result - 1e12 : 0; // Subtract error guard, flooring the result at zero

      return uint128(result);
    }
  }

  /**
   * Calculate the amount of base a user would get for certain amount of fyToken.
   * https://www.desmos.com/calculator/6jlrre7ybt
   * @param baseReserves base reserves amount
   * @param fyTokenReserves fyToken reserves amount
   * @param fyTokenAmount fyToken amount to be traded
   * @param timeTillMaturity time till maturity in seconds
   * @param k time till maturity coefficient, multiplied by 2^64
   * @param g fee coefficient, multiplied by 2^64
   * @return the amount of Base a user would get for given amount of fyToken
   */
  function baseOutForFYTokenIn(
    uint128 baseReserves, uint128 fyTokenReserves, uint128 fyTokenAmount,
    uint128 timeTillMaturity, int128 k, int128 g)
  public pure returns(uint128) {
    unchecked {
      uint128 a = _computeA(timeTillMaturity, k, g);

      // za = baseReserves ** a
      uint256 za = baseReserves.pow(a, ONE);

      // ya = fyTokenReserves ** a
      uint256 ya = fyTokenReserves.pow(a, ONE);

      // yx = fyDayReserves + fyTokenAmount
      uint256 yx = uint256(fyTokenReserves) + uint256(fyTokenAmount);
      require(yx <= MAX, "YieldMath: Too much fyToken in");

      // yxa = yx ** a
      uint256 yxa = uint128(yx).pow(a, ONE);

      // sum = za + ya - yxa
      uint256 sum = za + ya - yxa; // z < MAX, y < MAX, a < 1. It can only underflow, not overflow.
      require(sum <= MAX, "YieldMath: Insufficient base reserves");

      // result = baseReserves - (sum ** (1/a))
      uint256 result = uint256(baseReserves) - uint256(uint128(sum).pow(ONE, a));
      require(result <= MAX, "YieldMath: Rounding induced error");

      result = result > 1e12 ? result - 1e12 : 0; // Subtract error guard, flooring the result at zero

      return uint128(result);
    }
  }

  /**
   * Calculate the amount of fyToken a user could sell for given amount of Base.
   * https://www.desmos.com/calculator/0rgnmtckvy
   * @param baseReserves base reserves amount
   * @param fyTokenReserves fyToken reserves amount
   * @param baseAmount Base amount to be traded
   * @param timeTillMaturity time till maturity in seconds
   * @param k time till maturity coefficient, multiplied by 2^64
   * @param g fee coefficient, multiplied by 2^64
   * @return the amount of fyToken a user could sell for given amount of Base
   */
  function fyTokenInForBaseOut(
    uint128 baseReserves, uint128 fyTokenReserves, uint128 baseAmount,
    uint128 timeTillMaturity, int128 k, int128 g)
  public pure returns(uint128) {
    unchecked {
      uint128 a = _computeA(timeTillMaturity, k, g);

      // za = baseReserves ** a
      uint256 za = baseReserves.pow(a, ONE);

      // ya = fyTokenReserves ** a
      uint256 ya = fyTokenReserves.pow(a, ONE);

      // zx = baseReserves - baseAmount
      uint256 zx = uint256(baseReserves) - uint256(baseAmount);
      require(zx <= MAX, "YieldMath: Too much base out");

      // zxa = zx ** a
      uint256 zxa = uint128(zx).pow(a, ONE);

      // sum = za + ya - zxa
      uint256 sum = za + ya - zxa; // z < MAX, y < MAX, a < 1. It can only underflow, not overflow.
      require(sum <= MAX, "YieldMath: Resulting fyToken reserves too high");

      // result = (sum ** (1/a)) - fyTokenReserves
      uint256 result = uint256(uint128(sum).pow(ONE, a)) - uint256(fyTokenReserves);
      require(result <= MAX, "YieldMath: Rounding induced error");

      result = result < MAX - 1e12 ? result + 1e12 : MAX; // Add error guard, ceiling the result at max

      return uint128(result);
    }
  }

  /**
   * Calculate the amount of base a user would have to pay for certain amount of fyToken.
   * https://www.desmos.com/calculator/ws5oqj8x5i
   * @param baseReserves Base reserves amount
   * @param fyTokenReserves fyToken reserves amount
   * @param fyTokenAmount fyToken amount to be traded
   * @param timeTillMaturity time till maturity in seconds
   * @param k time till maturity coefficient, multiplied by 2^64
   * @param g fee coefficient, multiplied by 2^64
   * @return the amount of base a user would have to pay for given amount of
   *         fyToken
   */
  function baseInForFYTokenOut(
    uint128 baseReserves, uint128 fyTokenReserves, uint128 fyTokenAmount,
    uint128 timeTillMaturity, int128 k, int128 g)
  public pure returns(uint128) {
    unchecked {
      uint128 a = _computeA(timeTillMaturity, k, g);

      // za = baseReserves ** a
      uint256 za = baseReserves.pow(a, ONE);

      // ya = fyTokenReserves ** a
      uint256 ya = fyTokenReserves.pow(a, ONE);

      // yx = baseReserves - baseAmount
      uint256 yx = uint256(fyTokenReserves) - uint256(fyTokenAmount);
      require(yx <= MAX, "YieldMath: Too much fyToken out");

      // yxa = yx ** a
      uint256 yxa = uint128(yx).pow(a, ONE);

      // sum = za + ya - yxa
      uint256 sum = za + ya - yxa; // z < MAX, y < MAX, a < 1. It can only underflow, not overflow.
      require(sum <= MAX, "YieldMath: Resulting base reserves too high");

      // result = (sum ** (1/a)) - baseReserves
      uint256 result = uint256(uint128(sum).pow(ONE, a)) - uint256(baseReserves);
      require(result <= MAX, "YieldMath: Rounding induced error");

      result = result < MAX - 1e12 ? result + 1e12 : MAX; // Add error guard, ceiling the result at max

      return uint128(result);
    }
  }

  function _computeA(uint128 timeTillMaturity, int128 k, int128 g) private pure returns (uint128) {
    unchecked {
      // t = k * timeTillMaturity
      int128 t = k.mul(timeTillMaturity.fromUInt());
      require(t >= 0, "YieldMath: t must be positive"); // Meaning neither T or k can be negative

      // a = (1 - gt)
      int128 a = int128(ONE).sub(g.mul(t));
      require(a > 0, "YieldMath: Too far from maturity");
      require(a <= int128(ONE), "YieldMath: g must be positive");

      return uint128(a);
    }
  }

  /**
   * Estimate in Base the value of reserves at protocol initialization time.
   *
   * @param baseReserves base reserves amount
   * @param fyTokenReserves fyToken reserves amount
   * @param timeTillMaturity time till maturity in seconds
   * @param k time till maturity coefficient, multiplied by 2^64
   * @param c0 price of base in terms of Base, multiplied by 2^64
   * @return estimated value of reserves
   */
  function initialReservesValue(
    uint128 baseReserves, uint128 fyTokenReserves, uint128 timeTillMaturity,
    int128 k, int128 c0)
  external pure returns(uint128) {
    unchecked {
      uint256 normalizedBaseReserves = c0.mulu(baseReserves);
      require(normalizedBaseReserves <= MAX);

      // a = (1 - k * timeTillMaturity)
      int128 a = int128(ONE).sub(k.mul(timeTillMaturity.fromUInt()));
      require(a > 0);

      uint256 sum =
        uint256(uint128(normalizedBaseReserves).pow(uint128(a), ONE)) +
        uint256(fyTokenReserves.pow(uint128(a), ONE)) >> 1;
      require(sum <= MAX);

      uint256 result = uint256(uint128(sum).pow(ONE, uint128(a))) << 1;
      require(result <= MAX);

      return uint128(result);
    }
  }
}












