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

import { BytesLib } from "../../../../external/contracts/uniswap/v3/lib/BytesLib.sol";
import { ISwapRouter } from "../../../interfaces/external/ISwapRouter.sol";


/**
 * @title UniswapV3TradeAdapter
 * @author Set Protocol
 *
 * Exchange adapter for Uniswap V3 SwapRouter that encodes trade data
 */
contract UniswapV3ExchangeAdapter {

    using BytesLib for bytes;

    /* ============= Constants ================= */

    // signature of exactInput SwapRouter function
    string internal constant EXACT_INPUT = "exactInput((bytes,address,uint256,uint256,uint256))";

    /* ============ State Variables ============ */

    // Address of Uniswap V3 SwapRouter contract
    address public immutable swapRouter;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _swapRouter    Address of Uniswap V3 SwapRouter
     */
    constructor(address _swapRouter) public {
        swapRouter = _swapRouter;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return calldata for Uniswap V3 SwapRouter
     *
     * @param  _sourceToken              Address of source token to be sold
     * @param  _destinationToken         Address of destination token to buy
     * @param  _destinationAddress       Address that assets should be transferred to
     * @param  _sourceQuantity           Amount of source token to sell
     * @param  _minDestinationQuantity   Min amount of destination token to buy
     * @param  _data                     Uniswap V3 path. Equals the output of the generateDataParam function
     *
     * @return address                   Target contract address
     * @return uint256                   Call value
     * @return bytes                     Trade calldata
     */
    function getTradeCalldata(
        address _sourceToken,
        address _destinationToken,
        address _destinationAddress,
        uint256 _sourceQuantity,
        uint256 _minDestinationQuantity,
        bytes calldata _data
    )
        external
        view
        returns (address, uint256, bytes memory)
    {

        address sourceFromPath = _data.toAddress(0);
        require(_sourceToken == sourceFromPath, "UniswapV3ExchangeAdapter: source token path mismatch");

        address destinationFromPath = _data.toAddress(_data.length - 20);
        require(_destinationToken == destinationFromPath, "UniswapV3ExchangeAdapter: destination token path mismatch");

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams(
            _data,
            _destinationAddress,
            block.timestamp,
            _sourceQuantity,
            _minDestinationQuantity
        );

        bytes memory callData = abi.encodeWithSignature(EXACT_INPUT, params);
        return (swapRouter, 0, callData);
    }

    /**
     * Returns the address to approve source tokens to for trading. This is the Uniswap SwapRouter address
     *
     * @return address             Address of the contract to approve tokens to
     */
    function getSpender() external view returns (address) {
        return swapRouter;
    }

    /**
     * Returns the appropriate _data argument for getTradeCalldata. Equal to the encodePacked path with the
     * fee of each hop between it, e.g [token1, fee1, token2, fee2, token3]. Note: _fees.length == _path.length - 1
     *
     * @param _path array of addresses to use as the path for the trade
     * @param _fees array of uint24 representing the pool fee to use for each hop
     */
    function generateDataParam(address[] calldata _path, uint24[] calldata _fees) external pure returns (bytes memory) {
        bytes memory data = "";
        for (uint256 i = 0; i < _path.length - 1; i++) {
            data = abi.encodePacked(data, _path[i], _fees[i]);
        }

        // last encode has no fee associated with it since _fees.length == _path.length - 1
        return abi.encodePacked(data, _path[_path.length - 1]);
    }
} 