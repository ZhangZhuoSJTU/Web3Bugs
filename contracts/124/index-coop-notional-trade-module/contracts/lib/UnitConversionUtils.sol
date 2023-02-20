/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { SignedSafeMath } from "@openzeppelin/contracts/math/SignedSafeMath.sol";

/**
 * @title UnitConversionUtils
 * @author Set Protocol
 *
 * Utility functions to convert PRECISE_UNIT values to and from other decimal units
 */
library UnitConversionUtils {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    /**
     * @dev Converts a uint256 PRECISE_UNIT quote quantity into an alternative decimal format.
     *
     * This method is borrowed from PerpProtocol's `lushan` repo in lib/SettlementTokenMath
     *
     * @param _amount       PRECISE_UNIT amount to convert from
     * @param _decimals     Decimal precision format to convert to
     * @return              Input converted to alternative decimal precision format
     */
    function fromPreciseUnitToDecimals(uint256 _amount, uint8 _decimals) internal pure returns (uint256) {
        return _amount.div(10**(18 - uint(_decimals)));
    }

    /**
     * @dev Converts an int256 PRECISE_UNIT quote quantity into an alternative decimal format.
     *
     * This method is borrowed from PerpProtocol's `lushan` repo in lib/SettlementTokenMath
     *
     * @param _amount       PRECISE_UNIT amount to convert from
     * @param _decimals     Decimal precision format to convert to
     * @return              Input converted to alternative decimal precision format
     */
    function fromPreciseUnitToDecimals(int256 _amount, uint8 _decimals) internal pure returns (int256) {
        return _amount.div(int256(10**(18 - uint(_decimals))));
    }

    /**
     * @dev Converts an arbitrarily decimalized quantity into a int256 PRECISE_UNIT quantity.
     *
     * @param _amount       Non-PRECISE_UNIT amount to convert
     * @param _decimals     Decimal precision of amount being converted to PRECISE_UNIT
     * @return              Input converted to int256 PRECISE_UNIT decimal format
     */
    function toPreciseUnitsFromDecimals(int256 _amount, uint8 _decimals) internal pure returns (int256) {
        return _amount.mul(int256(10**(18 - (uint(_decimals)))));
    }

    /**
     * @dev Converts an arbitrarily decimalized quantity into a uint256 PRECISE_UNIT quantity.
     *
     * @param _amount       Non-PRECISE_UNIT amount to convert
     * @param _decimals     Decimal precision of amount being converted to PRECISE_UNIT
     * @return              Input converted to uint256 PRECISE_UNIT decimal format
     */
    function toPreciseUnitsFromDecimals(uint256 _amount, uint8 _decimals) internal pure returns (uint256) {
        return _amount.mul(10**(18 - (uint(_decimals))));
    }
}
