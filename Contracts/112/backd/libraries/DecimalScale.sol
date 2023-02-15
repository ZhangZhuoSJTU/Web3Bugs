// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

library DecimalScale {
    uint8 internal constant DECIMALS = 18; // 18 decimal places

    function scaleFrom(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == DECIMALS) {
            return value;
        } else if (decimals > DECIMALS) {
            return value / 10**(decimals - DECIMALS);
        } else {
            return value * 10**(DECIMALS - decimals);
        }
    }
}
