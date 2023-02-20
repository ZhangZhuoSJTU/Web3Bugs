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

interface IVault {
    function getBalance(address account) external view returns (int256);
    function decimals() external view returns (uint8);
    function getFreeCollateral(address trader) external view returns (uint256);
    function getFreeCollateralByRatio(address trader, uint24 ratio) external view returns (int256);
    function getLiquidateMarginRequirement(address trader) external view returns (int256);
    function getSettlementToken() external view returns (address);
    function getAccountBalance() external view returns (address);
    function getClearingHouse() external view returns (address);
    function getExchange() external view returns (address);
}
