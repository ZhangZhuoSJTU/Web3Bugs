// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

library DecimalScale {
    uint8 internal constant _DECIMALS = 18; // 18 decimal places

    function scaleFrom(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == _DECIMALS) {
            return value;
        } else if (decimals > _DECIMALS) {
            return value / 10**(decimals - _DECIMALS);
        } else {
            return value * 10**(_DECIMALS - decimals);
        }
    }

    function scaleTo(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == _DECIMALS) {
            return value;
        } else if (decimals > _DECIMALS) {
            return value * 10**(decimals - _DECIMALS);
        } else {
            return value / 10**(_DECIMALS - decimals);
        }
    }
}
