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
pragma experimental ABIEncoderV2;

import { FixedPoint96 } from "@uniswap/v3-core/contracts/libraries/FixedPoint96.sol";
import { FullMath } from "@uniswap/v3-core/contracts/libraries/FullMath.sol";

import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";

/**
 * @title UniswapV3Math
 * @author Set Protocol
 *
 * Helper functions for managing UniswapV3 math.
 */
library UniswapV3Math {

    /**
     * @dev Converts a UniswapV3 sqrtPriceX96 value to a priceX96 value. This method is borrowed from
     * PerpProtocol's `lushan` repo, in lib/PerpMath.
     *
     * For more info about the sqrtPriceX96 format see:
     * https://docs.uniswap.org/sdk/guides/fetching-prices#understanding-sqrtprice
     *
     * @param _sqrtPriceX96     Square root of a UniswapV3 encoded fixed-point pool price.
     * @return                  _sqrtPriceX96 converted to a priceX96 value
     */
    function formatSqrtPriceX96ToPriceX96(uint160 _sqrtPriceX96) internal pure returns (uint256) {
        return FullMath.mulDiv(_sqrtPriceX96, _sqrtPriceX96, FixedPoint96.Q96);
    }

    /**
     * @dev Converts a UniswapV3 X96 format price into a PRECISE_UNIT price. This method is borrowed from
     * PerpProtocol's `lushan` repo, in lib/PerpMath
     *
     * For more info about the priceX96 format see:
     * https://docs.uniswap.org/sdk/guides/fetching-prices#understanding-sqrtprice
     *
     * @param _valueX96         UniswapV3 encoded fixed-point pool price
     * @return                  _priceX96 as a PRECISE_UNIT value
     */
    function formatX96ToX10_18(uint256 _valueX96) internal pure returns (uint256) {
        return FullMath.mulDiv(_valueX96, PreciseUnitMath.preciseUnit(), FixedPoint96.Q96);
    }
}
