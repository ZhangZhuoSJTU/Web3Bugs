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
pragma experimental "ABIEncoderV2";

import { ISwapRouter } from  "contracts/interfaces/external/ISwapRouter.sol";
import { BytesLib } from "external/contracts/uniswap/v3/lib/BytesLib.sol";

import { IIndexExchangeAdapter } from "../../../interfaces/IIndexExchangeAdapter.sol";

/**
 * @title UniswapV3IndexExchangeAdapter
 * @author Set Protocol
 *
 * A Uniswap V3 exchange adapter that returns calldata for trading with GeneralIndexModule, allows encoding a trade with a fixed input quantity or
 * a fixed output quantity.
 */
contract UniswapV3IndexExchangeAdapter is IIndexExchangeAdapter {

    using BytesLib for bytes;

    /* ============ Constants ============ */

    // Uniswap router function string for swapping exact amount of input tokens for a minimum of output tokens
    string internal constant SWAP_EXACT_INPUT = "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))";
    // Uniswap router function string for swapping max amoutn of input tokens for an exact amount of output tokens
    string internal constant SWAP_EXACT_OUTPUT = "exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))";

    /* ============ State Variables ============ */

    // Address of Uniswap V3 SwapRouter contract
    address public immutable router;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _router       Address of Uniswap V3 SwapRouter contract
     */
    constructor(address _router) public {
        router = _router;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return calldata for trading with Uniswap V3 SwapRouter. Trade paths are created from _sourceToken,
     * _destinationToken and pool fees (which is encoded in _data).
     *
     * ---------------------------------------------------------------------------------------------------------------
     *   _isSendTokenFixed   |     Parameter             |       Amount                                              |
     * ---------------------------------------------------------------------------------------------------------------
     *      True             |   _sourceQuantity         |   Fixed amount of _sourceToken to trade                   |
     *                       |   _destinationQuantity    |   Minimum amount of _destinationToken willing to receive  |
     * ---------------------------------------------------------------------------------------------------------------
     *      False            |   _sourceQuantity         |   Maximum amount of _sourceToken to trade                 |
     *                       |   _destinationQuantity    |   Fixed amount of _destinationToken want to receive       |
     * ---------------------------------------------------------------------------------------------------------------
     *
     * @param _sourceToken              Address of source token to be sold
     * @param _destinationToken         Address of destination token to buy
     * @param _destinationAddress       Address that assets should be transferred to
     * @param _isSendTokenFixed         Boolean indicating if the send quantity is fixed, used to determine correct trade interface
     * @param _sourceQuantity           Fixed/Max amount of source token to sell
     * @param _destinationQuantity      Min/Fixed amount of destination token to buy
     * @param _data                     Arbitrary bytes containing fees value, expressed in hundredths of a bip,
     *                                  used to determine the pool to trade among similar asset pools on Uniswap V3.
     *                                  Note: SetToken manager must set the appropriate pool fees via `setExchangeData` in GeneralIndexModule
     *                                  for each component that needs to be traded on UniswapV3. This is different from UniswapV3ExchangeAdapter,
     *                                  where `_data` represents UniswapV3 trade path vs just the pool fees percentage.
     *
     * @return address                  Target contract address
     * @return uint256                  Call value
     * @return bytes                    Trade calldata
     */
    function getTradeCalldata(
        address _sourceToken,
        address _destinationToken,
        address _destinationAddress,
        bool _isSendTokenFixed,
        uint256 _sourceQuantity,
        uint256 _destinationQuantity,
        bytes memory _data
    )
        external
        view
        override
        returns (address, uint256, bytes memory)
    {
        uint24 fee = _data.toUint24(0);

        bytes memory callData = _isSendTokenFixed
            ? abi.encodeWithSignature(
                SWAP_EXACT_INPUT,
                ISwapRouter.ExactInputSingleParams(
                    _sourceToken,
                    _destinationToken,
                    fee,
                    _destinationAddress,
                    block.timestamp,
                    _sourceQuantity,
                    _destinationQuantity,
                    0
                )
            ) : abi.encodeWithSignature(
                SWAP_EXACT_OUTPUT,
                ISwapRouter.ExactOutputSingleParams(
                    _sourceToken,
                    _destinationToken,
                    fee,
                    _destinationAddress,
                    block.timestamp,
                    _destinationQuantity,
                    _sourceQuantity,
                    0
                )
            );

        return (router, 0, callData);
    }

    /**
     * Returns the address to approve source tokens to for trading. This is the Uniswap V3 router address.
     *
     * @return address             Address of the contract to approve tokens to
     */
    function getSpender() external view override returns (address) {
        return router;
    }

    /**
     * Helper that returns encoded fee value.
     *
     * @param fee                  UniswapV3 pool fee percentage, expressed in hundredths of a bip
     *
     * @return bytes               Encoded fee value
     */
    function getEncodedFeeData(uint24 fee) external pure returns (bytes memory) {
        return abi.encodePacked(fee);
    }
}