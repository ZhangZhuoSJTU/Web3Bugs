/*
    Copyright 2020 Set Labs Inc.

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
 * @title OneInchExchangeAdapter
 * @author Set Protocol
 *
 * Exchange adapter for 1Inch exchange that returns data for trades
 */

contract OneInchExchangeAdapter {

    /* ============ State Variables ============ */
    
    // Address of 1Inch approve token address
    address public oneInchApprovalAddress;

    // Address of 1Inch exchange address
    address public oneInchExchangeAddress;

    // Bytes to check 1Inch function signature
    bytes4 public oneInchFunctionSignature;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _oneInchApprovalAddress       Address of 1inch approval contract
     * @param _oneInchExchangeAddress       Address of 1inch exchange contract
     * @param _oneInchFunctionSignature     Bytes of 1inch function signature
     */
    constructor(
        address _oneInchApprovalAddress,
        address _oneInchExchangeAddress,
        bytes4 _oneInchFunctionSignature
    )
        public
    {
        oneInchApprovalAddress = _oneInchApprovalAddress;
        oneInchExchangeAddress = _oneInchExchangeAddress;
        oneInchFunctionSignature = _oneInchFunctionSignature;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return 1inch calldata which is already generated from the 1inch API
     *
     * @param  _sourceToken              Address of source token to be sold
     * @param  _destinationToken         Address of destination token to buy
     * @param  _sourceQuantity           Amount of source token to sell
     * @param  _minDestinationQuantity   Min amount of destination token to buy
     * @param  _data                     Arbitrage bytes containing trade call data
     *
     * @return address                   Target contract address
     * @return uint256                   Call value
     * @return bytes                     Trade calldata
     */
    function getTradeCalldata(
        address _sourceToken,
        address _destinationToken,
        address /* _destinationAddress */,
        uint256 _sourceQuantity,
        uint256 _minDestinationQuantity,
        bytes memory _data
    )
        external
        view
        returns (address, uint256, bytes memory)
    {   
        bytes4 signature;
        address fromToken;
        address toToken;
        uint256 fromTokenAmount;
        uint256 minReturnAmount;

        // Parse 1inch calldata and validate parameters match expected inputs
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            signature := mload(add(_data, 32))
            fromToken := mload(add(_data, 36))
            toToken := mload(add(_data, 68))
            fromTokenAmount := mload(add(_data, 100))
            minReturnAmount := mload(add(_data, 132))
        }

        require(
            signature == oneInchFunctionSignature,
            "Not One Inch Swap Function"
        );

        require(
            fromToken == _sourceToken,
            "Invalid send token"
        );

        require(
            toToken == _destinationToken,
            "Invalid receive token"
        );

        require(
            fromTokenAmount == _sourceQuantity,
            "Source quantity mismatch"
        );

        require(
            minReturnAmount >= _minDestinationQuantity,
            "Min destination quantity mismatch"
        );

        return (oneInchExchangeAddress, 0, _data);
    }

    /**
     * Returns the address to approve source tokens to for trading. This is the TokenTaker address
     *
     * @return address             Address of the contract to approve tokens to
     */
    function getSpender()
        external
        view
        returns (address)
    {
        return oneInchApprovalAddress;
    }
}