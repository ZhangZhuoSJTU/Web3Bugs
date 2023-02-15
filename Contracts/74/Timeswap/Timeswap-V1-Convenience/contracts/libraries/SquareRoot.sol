// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

library SquareRoot {
    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function sqrtUp(uint256 y) internal pure returns (uint256 z) {
        z = sqrt(y);
        if (z % y > 0) z++;
    }
}
