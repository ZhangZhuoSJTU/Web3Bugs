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

import { ISynth } from "../../../interfaces/external/ISynth.sol";
import { ISynthetixExchanger } from "../../../interfaces/external/ISynthetixExchanger.sol";

/**
 * @title SynthetixTradeAdapter
 * @author Set Protocol
 *
 * Exchange adapter for Synthetix that returns data for trades
 */
contract SynthetixExchangeAdapter {

    /* ============ Structs ============ */

    /**
     * Struct containing information for trade function
     */
    struct SynthetixTradeInfo {
        bytes32 sourceCurrencyKey;        // Currency key of the token to send
        bytes32 destinationCurrencyKey;   // Currency key the token to receive
    }

    /* ============ State Variables ============ */

    // Address of Synthetix's Exchanger contract
    address public immutable synthetixExchangerAddress;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _synthetixExchangerAddress    Address of Synthetix's Exchanger contract
     */
    constructor(address _synthetixExchangerAddress) public {
        synthetixExchangerAddress = _synthetixExchangerAddress;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Calculate Synthetix trade encoded calldata. To be invoked on the SetToken.
     *
     * @param  _sourceToken              Address of source token to be sold
     * @param  _destinationToken         Address of destination token to buy
     * @param  _destinationAddress       Address to receive traded tokens
     * @param  _sourceQuantity           Amount of source token to sell
     *
     * @return address                   Target address
     * @return uint256                   Call value
     * @return bytes                     Trade calldata
     */
    function getTradeCalldata(
        address _sourceToken,
        address _destinationToken,
        address _destinationAddress,
        uint256 _sourceQuantity,
        uint256 /* _minDestinationQuantity */,
        bytes calldata /* _data */
    )
        external
        view
        returns (address, uint256, bytes memory)
    {
        SynthetixTradeInfo memory synthetixTradeInfo;

        require(
            _sourceToken != _destinationToken,
            "Source token cannot be same as destination token"
        );

        synthetixTradeInfo.sourceCurrencyKey = _getCurrencyKey(_sourceToken);
        synthetixTradeInfo.destinationCurrencyKey = _getCurrencyKey(_destinationToken);

        // Encode method data for SetToken to invoke
        bytes memory methodData = abi.encodeWithSignature(
            "exchange(address,bytes32,uint256,bytes32,address)",
            _destinationAddress,
            synthetixTradeInfo.sourceCurrencyKey,
            _sourceQuantity,
            synthetixTradeInfo.destinationCurrencyKey,
            _destinationAddress
        );

        return (synthetixExchangerAddress, 0, methodData);
    }

    /**
     * Returns the Synthetix contract address.
     * There is no need to approve to SNX as its a proxy
     *
     * @return address
     */
    function getSpender()
        external
        view
        returns (address)
    {
        return synthetixExchangerAddress;
    }

    /**
     * Returns the amount of destination token received for exchanging a quantity of
     * source token, less fees.
     *
     * @param  _sourceToken        Address of source token to be sold
     * @param  _destinationToken   Address of destination token to buy
     * @param  _sourceQuantity     Amount of source token to sell
     *
     * @return amountReceived      Amount of source token received for exchange
     */
    function getAmountReceivedForExchange(
        address _sourceToken,
        address _destinationToken,
        uint256 _sourceQuantity
    )
        external
        view
        returns (uint256 amountReceived)
    {
        SynthetixTradeInfo memory synthetixTradeInfo;

        synthetixTradeInfo.sourceCurrencyKey = _getCurrencyKey(_sourceToken);
        synthetixTradeInfo.destinationCurrencyKey = _getCurrencyKey(_destinationToken);

        (amountReceived,,) = ISynthetixExchanger(synthetixExchangerAddress).getAmountsForExchange(
            _sourceQuantity,
            synthetixTradeInfo.sourceCurrencyKey,
            synthetixTradeInfo.destinationCurrencyKey
        );
    }

    /* ============ Internal Functions ============ */

    /**
     * Gets the Synthetix currency key for _token
     *
     * @param _token  Address of token to get currency key for
     */
    function _getCurrencyKey(address _token) internal view returns (bytes32) {

        try ISynth(_token).currencyKey() returns (bytes32 key){

            return key;

        } catch (bytes memory /* data */) {

            revert("Invalid Synth token address");
        }
    }
}
