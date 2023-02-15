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

import { BytesLib } from "external/contracts/uniswap/v3/lib/BytesLib.sol";
import { IDMMFactory } from "../../../interfaces/external/IDMMFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IIndexExchangeAdapter } from "../../../interfaces/IIndexExchangeAdapter.sol";

/**
 * @title KyberV3IndexExchangeAdapter
 * @author Set Protocol
 *
 * A Kyber V3 DMM exchange adapter that returns calldata for trading with GeneralIndexModule, allows encoding a trade with a fixed input quantity or
 * a fixed output quantity.
 */
contract KyberV3IndexExchangeAdapter is IIndexExchangeAdapter {

    using BytesLib for bytes;

    /* ============ Constants ============ */

    // DMMRouter function string for swapping exact tokens for a minimum of receive tokens
    string internal constant SWAP_EXACT_TOKENS_FOR_TOKENS = "swapExactTokensForTokens(uint256,uint256,address[],address[],address,uint256)";
    // DMMRouter function string for swapping tokens for an exact amount of receive tokens
    string internal constant SWAP_TOKENS_FOR_EXACT_TOKENS = "swapTokensForExactTokens(uint256,uint256,address[],address[],address,uint256)";

    /* ============ State Variables ============ */

    address public immutable dmmRouter;
    IDMMFactory public immutable dmmFactory;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _dmmRouter       Address of Kyber V3 DMM Router
     * @param _dmmFactory      Address of Kyber V3 DMM Factory
     */
    constructor(address _dmmRouter, IDMMFactory _dmmFactory) public {
        dmmRouter = _dmmRouter;
        dmmFactory = _dmmFactory;        
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return calldata for trading with Kyber V3 DMM Router. Trade paths are created from _sourceToken and
     * _destinationToken. On Kyber DMM exchange, for each token pair, there can be possibly many multiple pools with
     * different configurations for the pricing curve. Hence the address of the pool to be used for trading must be passed
     * in the _data parameter.
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
     * @param  _sourceToken              Address of source token to be sold
     * @param  _destinationToken         Address of destination token to buy
     * @param  _destinationAddress       Address that assets should be transferred to
     * @param  _isSendTokenFixed         Boolean indicating if the send quantity is fixed, used to determine correct trade interface
     * @param  _sourceQuantity           Fixed/Max amount of source token to sell
     * @param  _destinationQuantity      Min/Fixed amount of destination token to buy
     * @param  _data                     Arbitray bytes containing the pool address to be used for trading. Can use 
     *                                   `getPoolWithBestLiquidity()` to get the most liquid pool for a given pair of tokens
     *                                   on the Kyber DMM exchange.
     *
     * @return address                   Target contract address
     * @return uint256                   Call value
     * @return bytes                     Trade calldata
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
        
        address[] memory path = new address[](2);
        path[0] = _sourceToken;
        path[1] = _destinationToken;

        address[] memory poolsPath = new address[](1);
        poolsPath[0] = _data.toAddress(0);
        
        require(dmmFactory.isPool(IERC20(_sourceToken), IERC20(_destinationToken), poolsPath[0]), "Invalid pool address");

        bytes memory callData = abi.encodeWithSignature(
            _isSendTokenFixed ? SWAP_EXACT_TOKENS_FOR_TOKENS : SWAP_TOKENS_FOR_EXACT_TOKENS,
            _isSendTokenFixed ? _sourceQuantity : _destinationQuantity,
            _isSendTokenFixed ? _destinationQuantity : _sourceQuantity,
            poolsPath,
            path,
            _destinationAddress,
            block.timestamp
        );
        return (dmmRouter, 0, callData);
    }

    /**
     * Returns the address to approve source tokens to for trading. This is the Kyber DMM Router.
     *
     * @return address             Address of the contract to approve tokens to
     */
    function getSpender() external view override returns (address) {
        return dmmRouter;
    }
} 