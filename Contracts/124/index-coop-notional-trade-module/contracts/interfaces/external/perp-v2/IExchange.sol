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

interface IExchange {
    struct FundingGrowth {
        int256 twPremiumX96;
        int256 twPremiumDivBySqrtPriceX96;
    }

    struct SwapParams {
        address trader;
        address baseToken;
        bool isBaseToQuote;
        bool isExactInput;
        uint256 amount;
        uint160 sqrtPriceLimitX96;
        FundingGrowth fundingGrowthGlobal;
    }

    struct SwapResponse {
        uint256 deltaAvailableBase;
        uint256 deltaAvailableQuote;
        int256 exchangedPositionSize;
        int256 exchangedPositionNotional;
        uint256 fee;
        uint256 insuranceFundFee;
        int24 tick;
        int256 realizedPnl;
        int256 openNotional;
    }

    // Note: Do *NOT* add `getFundingGrowthGlobalAndTwaps` to this interface. It may work with the
    // custom bytecode we generated to expose the method in our TS tests but it's no longer part of the
    // public interface of the deployed PerpV2 system contracts. (Removed in v0.15.0).

    function getPool(address baseToken) external view returns (address);
    function getTick(address baseToken) external view returns (int24);
    function getSqrtMarkTwapX96(address baseToken, uint32 twapInterval) external view returns (uint160);
    function getMaxTickCrossedWithinBlock(address baseToken) external view returns (uint24);
    function getAllPendingFundingPayment(address trader) external view returns (int256);
    function getPendingFundingPayment(address trader, address baseToken) external view returns (int256);
}
