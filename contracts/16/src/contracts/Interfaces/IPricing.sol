//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../lib/LibPrices.sol";

interface IPricing {
    function getFundingRate(uint256 index) external view returns (Prices.FundingRateInstant memory);

    function currentHour() external returns (uint8);

    function getInsuranceFundingRate(uint256 index) external view returns (Prices.FundingRateInstant memory);

    function currentFundingIndex() external view returns (uint256);

    function fairPrice() external view returns (uint256);

    function timeValue() external view returns (int256);

    function getTWAPs(uint256 hour) external view returns (Prices.TWAP memory);

    function get24HourPrices() external view returns (uint256, uint256);

    function getHourlyAvgTracerPrice(uint256 hour) external view returns (uint256);

    function getHourlyAvgOraclePrice(uint256 hour) external view returns (uint256);

    function recordTrade(uint256 tradePrice) external;
}
