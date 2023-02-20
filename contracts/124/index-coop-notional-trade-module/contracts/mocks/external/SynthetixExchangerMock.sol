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
import { SynthMock } from "./SynthMock.sol";

contract SynthetixExchangerMock {
    using SafeMath for uint;

    bytes32 sUsdCurrencyKey;
    mapping(bytes32 => mapping(bytes32 => uint256)) private rates;
    mapping(bytes32 => address) private coins;

    constructor(
        address _sUsd,
        address _sEth,
        address _sBtc,
        bytes32 _sUsdCurrencyKey,
        bytes32 _sEthCurrencyKey,
        bytes32 _sBtcCurrencyKey,
        uint256 _usdPerEthRate,
        uint256 _ethsPerUsdRate,
        uint256 _usdPerBtcRate,
        uint256 _btcPerUsdRate
    )
        public
    {
        sUsdCurrencyKey = _sUsdCurrencyKey;

        coins[_sUsdCurrencyKey] = _sUsd;
        coins[_sEthCurrencyKey] = _sEth;
        coins[_sBtcCurrencyKey] = _sBtc;

        rates[_sUsdCurrencyKey][_sUsdCurrencyKey] = 1000000000000000000;

        rates[_sUsdCurrencyKey][_sEthCurrencyKey] = _usdPerEthRate;
        rates[_sEthCurrencyKey][_sUsdCurrencyKey] = _ethsPerUsdRate;

        rates[_sUsdCurrencyKey][_sBtcCurrencyKey] = _usdPerBtcRate;
        rates[_sBtcCurrencyKey][_sUsdCurrencyKey] = _btcPerUsdRate;
    }

    function exchange(
        address /* from */,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey,
        address /* destinationAddress */
    )
        external
        view
        returns (uint256 amountReceived)
    {

        (uint targetAmount,,) = getAmountsForExchange(
            sourceAmount,
            sourceCurrencyKey,
            destinationCurrencyKey
        );

        // DHedge mock:
        // Source synth burn sourceAmount;
        // Destination synth mint targetAmount;

        return targetAmount;
    }

    function getAmountsForExchange(
        uint256 _sourceAmount,
        bytes32 _sourceCurrencyKey,
        bytes32 _destinationCurrencyKey
    )
        public
        view
        returns (
            uint256 amountReceived,
            uint256 fee,
            uint256 exchangeFeeRate
        )
    {

        // Logic adapted from Synthetix/ExchangeRates.sol:_effectiveValueAndRates
        //
        // > /Synthetixio/synthetix
        // > /blob/c803c3b51d026bb4552a0e1a9bcc55914502a8d4
        // > /contracts/ExchangeRates.sol#L672-L686
        //

        // Calculate the effective value by going from source -> USD -> destination
        uint sourceRate = rates[_sourceCurrencyKey][sUsdCurrencyKey];
        // If there's no change in the currency, then just return the amount they gave us
        if (_sourceCurrencyKey == _destinationCurrencyKey) {
            amountReceived = _sourceAmount;
        } else {
            uint destinationRate = rates[_destinationCurrencyKey][sUsdCurrencyKey];
            amountReceived = _sourceAmount.mul(sourceRate).div(destinationRate);
        }

        return (amountReceived, 0, 0);
    }
}

