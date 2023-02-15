// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IPriceOracle.sol";

/// @title Chainlink price oracle interface
/// @notice Extends IPriceOracle interface
interface IChainlinkPriceOracle is IPriceOracle {
    /// @notice Adds `_asset` to the oracle
    /// @param _asset Asset's address
    /// @param _asset Asset aggregator's address
    function addAsset(address _asset, address _assetAggregator) external;
}
