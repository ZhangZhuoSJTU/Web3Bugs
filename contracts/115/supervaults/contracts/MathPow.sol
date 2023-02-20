// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

library MathPow {
  function pow(uint256 x, uint256 n) internal pure returns (uint256 z) {
    z = n % 2 != 0 ? x : 1;

    for (n /= 2; n != 0; n /= 2) {
      x = x*x; 

      if (n % 2 != 0) {
        z = z*x;
      }
    }
  }
}
