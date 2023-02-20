// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

library SquareRoot {
    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function sqrtUp(uint256 x) internal pure returns (uint256 y) {
        y = sqrt(x);
        if (x % y != 0) y++;
    }
}
