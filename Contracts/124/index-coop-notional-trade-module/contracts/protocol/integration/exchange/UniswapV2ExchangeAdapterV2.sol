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

/**
 * @title UniswapV2ExchangeAdapterV2
 * @author Set Protocol
 *
 * A Uniswap Router02 exchange adapter that returns calldata for trading. Includes option for 2 different trade types on Uniswap.
 *
 * CHANGE LOG:
 * - Add helper that encodes path and boolean into bytes
 * - Generalized ability to choose whether to swap an exact amount of source token for a min amount of receive token or swap a max amount of source token for
 * an exact amount of receive token
 * - Add helper to generate data parameter for `getTradeCallData`
 *
 */
contract UniswapV2ExchangeAdapterV2 {

    /* ============ State Variables ============ */

    // Address of Uniswap V2 Router02 contract
    address public immutable router;
    // Uniswap router function string for swapping exact tokens for a minimum of receive tokens
    string internal constant SWAP_EXACT_TOKENS_FOR_TOKENS = "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)";
    // Uniswap router function string for swapping tokens for an exact amount of receive tokens
    string internal constant SWAP_TOKENS_FOR_EXACT_TOKENS = "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)";

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _router       Address of Uniswap V2 Router02 contract
     */
    constructor(address _router) public {
        router = _router;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return calldata for Uniswap V2 Router02. Trade paths and bool to select trade function are encoded in the arbitrary data parameter.
     *
     * Note: When selecting the swap for exact tokens function, _sourceQuantity is defined as the max token quantity you are willing to trade, and
     * _minDestinationQuantity is the exact quantity of token you are receiving.
     *
     * @param  _destinationAddress       Address that assets should be transferred to
     * @param  _sourceQuantity           Fixed/Max amount of source token to sell
     * @param  _destinationQuantity      Min/Fixed amount of destination token to buy
     * @param  _data                     Arbitrary bytes containing trade path and bool to determine function string
     *
     * @return address                   Target contract address
     * @return uint256                   Call value
     * @return bytes                     Trade calldata
     */
    function getTradeCalldata(
        address /* _sourceToken */,
        address /* _destinationToken */,
        address _destinationAddress,
        uint256 _sourceQuantity,
        uint256 _destinationQuantity,
        bytes memory _data
    )
        external
        view
        returns (address, uint256, bytes memory)
    {
        (
            address[] memory path,
            bool shouldSwapExactTokensForTokens
        ) = abi.decode(_data, (address[],bool));

        bytes memory callData = abi.encodeWithSignature(
            shouldSwapExactTokensForTokens ? SWAP_EXACT_TOKENS_FOR_TOKENS : SWAP_TOKENS_FOR_EXACT_TOKENS,
            shouldSwapExactTokensForTokens ? _sourceQuantity : _destinationQuantity,
            shouldSwapExactTokensForTokens ? _destinationQuantity : _sourceQuantity,
            path,
            _destinationAddress,
            block.timestamp
        );
        return (router, 0, callData);
    }

    /**
     * Generate data parameter to be passed to `getTradeCallData`. Returns encoded trade paths and bool to select trade function.
     *
     * @param _sourceToken          Address of the source token to be sold
     * @param _destinationToken     Address of the destination token to buy
     * @param _fixIn                Boolean representing if input tokens amount is fixed
     *
     * @return bytes                Data parameter to be passed to `getTradeCallData`
     */
    function generateDataParam(address _sourceToken, address _destinationToken, bool _fixIn)
        external
        pure
        returns (bytes memory)
    {
        address[] memory path = new address[](2);
        path[0] = _sourceToken;
        path[1] = _destinationToken;
        return abi.encode(path, _fixIn);
    }

    /**
     * Returns the address to approve source tokens to for trading. This is the Uniswap router address
     *
     * @return address             Address of the contract to approve tokens to
     */
    function getSpender() external view returns (address) {
        return router;
    }

    /**
     * Helper that returns the encoded data of trade path and boolean indicating the Uniswap function to use
     *
     * @return bytes               Encoded data used for trading on Uniswap
     */
    function getUniswapExchangeData(address[] memory _path, bool _shouldSwapExactTokensForTokens) external pure returns (bytes memory) {
        return abi.encode(_path, _shouldSwapExactTokensForTokens);
    }
}