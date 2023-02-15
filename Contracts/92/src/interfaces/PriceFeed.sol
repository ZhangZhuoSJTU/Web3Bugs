// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {CERC20} from "./CERC20.sol";

/// @notice Price Feed
/// @author Compound Labs
/// @notice Minimal cToken price feed interface.
interface PriceFeed {
    /// @notice Get the underlying price of the cToken's asset.
    /// @param cToken The cToken to get the underlying price of.
    /// @return The underlying asset price scaled by 1e18.
    function getUnderlyingPrice(CERC20 cToken) external view returns (uint256);
}
