// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Decimal} from "../external/Decimal.sol";

/// @notice contract that receives a chainlink price feed and then linearly interpolates that rate over
/// a 1 month period into the VOLT price. Interest is compounded monthly when the rate is updated
/// @author Elliot Friedman
interface IScalingPriceOracle {
    /// @notice the time frame over which all changes in CPI data are applied
    /// 28 days was chosen as that is the shortest length of a month
    function TIMEFRAME() external view returns (uint256);

    /// @notice the maximum allowable deviation in basis points for a new chainlink oracle update
    /// only allow price changes by 20% in a month.
    /// Any change over this threshold in either direction will be rejected
    function MAXORACLEDEVIATION() external view returns (uint256);

    /// @notice get the current scaled oracle price
    /// applies the change smoothly over a 28 day period
    /// scaled by 18 decimals
    function getCurrentOraclePrice() external view returns (uint256);

    /// @notice current amount that oracle price is inflating/deflating by monthly in basis points
    function monthlyChangeRateBasisPoints() external view returns (int256);

    /// @notice oracle price. starts off at 1 scaled up by 18 decimals
    function oraclePrice() external view returns (uint256);

    /// @notice event when the monthly change rate is updated
    event CPIMonthlyChangeRateUpdate(
        int256 oldChangeRateBasisPoints,
        int256 newChangeRateBasisPoints
    );
}
