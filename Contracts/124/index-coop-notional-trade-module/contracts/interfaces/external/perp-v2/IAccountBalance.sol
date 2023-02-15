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

interface IAccountBalance {
    function getBaseTokens(address trader) external view returns (address[] memory);
    function hasOrder(address trader) external view returns (bool);
    function getMarginRequirementForLiquidation(address trader) external view returns (int256);
    function getTotalDebtValue(address trader) external view returns (uint256);
    function getPnlAndPendingFee(address trader) external view returns (int256,int256,uint256);
    function getBase(address trader, address baseToken) external view returns (int256);
    function getQuote(address trader, address baseToken) external view returns (int256);
    function getNetQuoteBalanceAndPendingFee(address trader) external view returns (int256, uint256);
    function getTotalPositionSize(address trader, address baseToken) external view returns (int256);
    function getTotalPositionValue(address trader, address baseToken) external view returns (int256);
    function getTotalAbsPositionValue(address trader) external view returns (uint256);
    function getClearingHouseConfig() external view returns (address);
    function getExchange() external view returns (address);
    function getOrderBook() external view returns (address);
    function getVault() external view returns (address);
    function getTakerPositionSize(address trader, address baseToken) external view returns (int256);
    function getTakerOpenNotional(address trader, address baseToken) external view returns (int256);
}
