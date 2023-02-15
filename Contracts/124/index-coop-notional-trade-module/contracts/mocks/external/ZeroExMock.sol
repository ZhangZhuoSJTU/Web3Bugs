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
pragma experimental ABIEncoderV2;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Minimal 0x Exchange Proxy contract interface.
contract ZeroExMock {

    struct Transformation {
        uint32 deploymentNonce;
        bytes data;
    }

    struct RfqOrder {
        address makerToken;
        address takerToken;
        uint128 makerAmount;
        uint128 takerAmount;
        address maker;
        address taker;
        address txOrigin;
        bytes32 pool;
        uint64 expiry;
        uint256 salt;
    }

    struct Signature {
        uint8 signatureType;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct BatchSellSubcall {
        uint8 subcall;
        uint256 sellAmount;
        bytes data;
    }

    struct MultiHopSellSubcall {
        uint8 subcall;
        bytes data;
    }

    address public mockReceiveToken;
    address public mockSendToken;
    uint256 public mockReceiveAmount;
    uint256 public mockSendAmount;
    // Address of SetToken which will send/receive token
    address public setTokenAddress;

    constructor(
        address _mockSendToken,
        address _mockReceiveToken,
        uint256 _mockSendAmount,
        uint256 _mockReceiveAmount
    ) public {
        mockSendToken = _mockSendToken;
        mockReceiveToken = _mockReceiveToken;
        mockSendAmount = _mockSendAmount;
        mockReceiveAmount = _mockReceiveAmount;
    }

    // Initialize SetToken address which will send/receive tokens for the trade
    function addSetTokenAddress(address _setTokenAddress) external {
        setTokenAddress = _setTokenAddress;
    }

    function transformERC20(
        address /* inputToken */,
        address /* outputToken */,
        uint256 /* inputTokenAmount */,
        uint256 /* minOutputTokenAmount */,
        Transformation[] calldata /* transformations */
    )
        external
        payable
        returns (uint256)
    {
        _transferTokens();
    }

    function transformERC20Staging(
        address /* inputToken */,
        address /* outputToken */,
        uint256 /* inputTokenAmount */,
        uint256 /* minOutputTokenAmount */,
        Transformation[] calldata /* transformations */
    )
        external
        payable
        returns (uint256)
    {
        _transferTokens();
    }

    function sellToUniswap(
        address[] calldata /* tokens */,
        uint256 /* sellAmount */,
        uint256 /* minBuyAmount */,
        bool /* isSushi */
    )
        external
        payable
        returns (uint256)
    {
        _transferTokens();
    }

    function sellToLiquidityProvider(
        address /* inputToken */,
        address /* outputToken */,
        address payable /* provider */,
        address /* recipient */,
        uint256 /* sellAmount */,
        uint256 /* minBuyAmount */,
        bytes calldata /* auxiliaryData */
    )
        external
        payable
        returns (uint256)
    {
        _transferTokens();
    }

    function fillRfqOrder(
        RfqOrder memory /* order */,
        Signature memory /* signature */,
        uint128 /* takerTokenFillAmount */
    )
        external
        payable
        returns (uint128, uint128)
    {
        _transferTokens();
    }

    function batchFillRfqOrders(
        RfqOrder[] memory /* order */,
        Signature[] memory /* signature */,
        uint128[] memory /* takerTokenFillAmount */,
        bool /* revertIfIncomplete */
    )
        external
        payable
        returns (uint128[] memory, uint128[] memory)
    {
        _transferTokens();
    }

    function sellTokenForTokenToUniswapV3(
        bytes memory /* encodedPath */,
        uint256 /* sellAmount */,
        uint256 /* minBuyAmount */,
        address /* recipient */
    )
        external
        returns (uint256)
    {
        _transferTokens();
    }

    function multiplexBatchSellTokenForToken(
        address /* inputToken */,
        address /* outputToken */,
        BatchSellSubcall[] memory /* calls */,
        uint256 /* sellAmount */,
        uint256 /* minBuyAmount */
    )
        external
        payable
        returns (uint256)
    {
        _transferTokens();
    }

    function multiplexMultiHopSellTokenForToken(
        address[] memory /* tokens */,
        MultiHopSellSubcall[] memory /* calls */,
        uint256 /* sellAmount */,
        uint256 /* minBuyAmount */
    )
        external
        payable
        returns (uint256)
    {
        _transferTokens();
    }

    function _transferTokens()
        private
    {
        require(ERC20(mockSendToken).transferFrom(setTokenAddress, address(this), mockSendAmount), "ERC20 TransferFrom failed");
        require(ERC20(mockReceiveToken).transfer(setTokenAddress, mockReceiveAmount), "ERC20 transfer failed");
    }
}
