// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Decimal} from "../external/Decimal.sol";
import {IScalingPriceOracle} from "./IScalingPriceOracle.sol";

/// @notice interface to get data from the Scaling Price Oracle
interface IOraclePassThrough {
    // ----------- Getters -----------

    /// @notice reference to the scaling price oracle
    function scalingPriceOracle() external view returns (IScalingPriceOracle);

    /// @notice function to get the current oracle price for the OracleRef contract
    function read()
        external
        view
        returns (Decimal.D256 memory price, bool valid);

    /// @notice function to get the current oracle price for the entire system
    function getCurrentOraclePrice() external view returns (uint256);

    // ----------- Governor only state changing api -----------

    /// @notice function to update the pointer to the scaling price oracle
    /// requires approval from both VOLT and FRAX governance to sign off on the change
    function updateScalingPriceOracle(IScalingPriceOracle newScalingPriceOracle)
        external;

    /// @notice event emitted when the scaling price oracle is updated
    event ScalingPriceOracleUpdate(
        IScalingPriceOracle oldScalingPriceOracle,
        IScalingPriceOracle newScalingPriceOracle
    );
}
