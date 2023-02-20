// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Decimal} from "../external/Decimal.sol";
import {CoreRef} from "./../refs/CoreRef.sol";
import {IScalingPriceOracle} from "./IScalingPriceOracle.sol";
import {IOraclePassThrough} from "./IOraclePassThrough.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice contract that passes all price calls to the Scaling Price Oracle
/// The Scaling Price Oracle can be changed if there is a decision to change how data is interpolated
/// without needing all contracts in the system to be upgraded, only this contract will have to change where it points
/// @author Elliot Friedman
contract OraclePassThrough is IOraclePassThrough, Ownable {
    using Decimal for Decimal.D256;

    /// @notice reference to the scaling price oracle
    IScalingPriceOracle public override scalingPriceOracle;

    constructor(IScalingPriceOracle _scalingPriceOracle) Ownable() {
        scalingPriceOracle = _scalingPriceOracle;
    }

    /// @notice updates the oracle price
    /// @dev no-op, ScalingPriceOracle is updated automatically
    /// added for backwards compatibility with OracleRef
    function update() public {}

    // ----------- Getters -----------

    /// @notice function to get the current oracle price for the OracleRef contract
    function read()
        external
        view
        override
        returns (Decimal.D256 memory price, bool valid)
    {
        uint256 currentPrice = scalingPriceOracle.getCurrentOraclePrice();

        price = Decimal.from(currentPrice).div(1e18);
        valid = true;
    }

    /// @notice function to get the current oracle price for the entire system
    function getCurrentOraclePrice() external view override returns (uint256) {
        return scalingPriceOracle.getCurrentOraclePrice();
    }

    // ----------- Governance only state changing api -----------

    /// @notice function to update the pointer to the scaling price oracle
    /// requires approval from all parties on multisig to update
    function updateScalingPriceOracle(IScalingPriceOracle newScalingPriceOracle)
        external
        override
        onlyOwner
    {
        IScalingPriceOracle oldScalingPriceOracle = scalingPriceOracle;
        scalingPriceOracle = newScalingPriceOracle;

        emit ScalingPriceOracleUpdate(
            oldScalingPriceOracle,
            newScalingPriceOracle
        );
    }
}
