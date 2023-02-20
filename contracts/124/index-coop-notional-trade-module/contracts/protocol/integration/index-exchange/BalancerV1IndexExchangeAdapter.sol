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

import { IIndexExchangeAdapter } from "../../../interfaces/IIndexExchangeAdapter.sol";

/**
 * @title BalancerV1IndexExchangeAdapter
 * @author Set Protocol
 *
 * A Balancer exchange adapter that returns calldata for trading with GeneralIndexModule, allows trading a fixed input amount or for a fixed
 * output amount.
 */
contract BalancerV1IndexExchangeAdapter is IIndexExchangeAdapter {

    /* ============ Constants ============ */

    // Amount of pools examined when fetching quote
    uint256 private constant BALANCER_POOL_LIMIT = 3;
    
    /* ============ State Variables ============ */
    
    // Address of Balancer V1 Proxy contract
    address public immutable balancerProxy;
    // Balancer proxy function string for swapping exact tokens for a minimum of receive tokens
    string internal constant EXACT_IN = "smartSwapExactIn(address,address,uint256,uint256,uint256)";
    // Balancer proxy function string for swapping tokens for an exact amount of receive tokens
    string internal constant EXACT_OUT = "smartSwapExactOut(address,address,uint256,uint256,uint256)";

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _balancerProxy       Balancer exchange proxy address
     */
    constructor(address _balancerProxy) public {
        balancerProxy = _balancerProxy;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return calldata for Balancer Proxy, _isSendTokenFixed indicates whether a fixed amount of token should be sold for an unfixed amount, or
     * if an unfixed amount of token should be spent for a fixed amount.
     *
     * Note: When _isSendTokenFixed is false, _sourceQuantity is defined as the max token quantity you are willing to trade, and
     * _destinationQuantity is the exact quantity of token you are receiving.
     *
     * @param  _sourceToken              Address of source token to be sold
     * @param  _destinationToken         Address of destination token to buy
     * @param  _isSendTokenFixed         Boolean indicating if the send quantity is fixed, used to determine correct trade interface
     * @param  _sourceQuantity           Fixed/Max amount of source token to sell
     * @param  _destinationQuantity      Min/Fixed amount of destination tokens to receive
     *
     * @return address                   Target contract address
     * @return uint256                   Call value
     * @return bytes                     Trade calldata
     */
    function getTradeCalldata(
        address _sourceToken,
        address _destinationToken,
        address /*_destinationAddress*/,
        bool _isSendTokenFixed,
        uint256 _sourceQuantity,
        uint256 _destinationQuantity,
        bytes memory /*_data*/
    )
        external
        view
        override
        returns (address, uint256, bytes memory)
    {   
        bytes memory callData = abi.encodeWithSignature(
            _isSendTokenFixed ? EXACT_IN : EXACT_OUT,
            _sourceToken,
            _destinationToken,
            _isSendTokenFixed ? _sourceQuantity : _destinationQuantity,
            _isSendTokenFixed ? _destinationQuantity : _sourceQuantity,
            BALANCER_POOL_LIMIT
        );

        return (balancerProxy, 0, callData);
    }

    /**
     * Returns the address to approve source tokens to for trading. This is the Balancer proxy address
     *
     * @return address             Address of the contract to approve tokens to
     */
    function getSpender() external view override returns (address) {
        return balancerProxy;
    }
} 