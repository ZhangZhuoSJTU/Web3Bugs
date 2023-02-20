// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.6;

library FullMath {
    function fullMul(uint x, uint y) private pure returns (uint l, uint h) {
        uint mm = mulmod(x, y, uint(-1));
        l = x * y;
        h = mm - l;
        if (mm < l) h -= 1;
    }

    function fullDiv(
        uint l,
        uint h,
        uint d
    ) private pure returns (uint) {
        uint pow2 = d & -d;
        d /= pow2;
        l /= pow2;
        l += h * ((-pow2) / pow2 + 1);
        uint r = 1;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        return l * r;
    }

    function mulDiv(
        uint x,
        uint y,
        uint d
    ) internal pure returns (uint) {
        (uint l, uint h) = fullMul(x, y);
        uint mm = mulmod(x, y, d);
        if (mm > l) h -= 1;
        l -= mm;
        require(h < d, "FullMath::mulDiv: overflow");
        return fullDiv(l, h, d);
    }
}
