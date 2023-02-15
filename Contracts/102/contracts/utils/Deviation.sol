// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Constants} from "./../Constants.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title contract that determines whether or not a new value is within
/// an acceptable deviation threshold
/// @author Elliot Friedman, FEI Protocol
library Deviation {
    using SafeCast for *;

    /// @notice event that is emitted when the threshold is changed
    event DeviationThresholdUpdate(uint256 oldThreshold, uint256 newThreshold);

    /// @notice return the percent deviation between a and b in basis points terms
    function calculateDeviationThresholdBasisPoints(int256 a, int256 b)
        internal
        pure
        returns (uint256)
    {
        int256 delta = a - b;
        int256 basisPoints = (delta * Constants.BP_INT) / a;

        return (basisPoints < 0 ? basisPoints * -1 : basisPoints).toUint256();
    }

    /// @notice function to return whether or not the new price is within
    /// the acceptable deviation threshold
    function isWithinDeviationThreshold(
        uint256 maxDeviationThresholdBasisPoints,
        int256 oldValue,
        int256 newValue
    ) internal pure returns (bool) {
        return
            maxDeviationThresholdBasisPoints >=
            calculateDeviationThresholdBasisPoints(oldValue, newValue);
    }
}
