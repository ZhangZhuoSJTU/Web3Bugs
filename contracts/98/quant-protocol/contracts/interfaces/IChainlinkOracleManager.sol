// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IProviderOracleManager.sol";
import "./IOracleFallbackMechanism.sol";

interface IChainlinkOracleManager is
    IProviderOracleManager,
    IOracleFallbackMechanism
{
    event PriceRegistrySubmission(
        address asset,
        uint256 expiryTimestamp,
        uint256 price,
        uint256 expiryRoundId,
        address priceSubmitter,
        bool isFallback
    );

    /// @notice Set the price of an asset at a timestamp using a chainlink round id
    /// @param _asset address of asset to set price for
    /// @param _expiryTimestamp expiry timestamp to set the price at
    /// @param _roundIdAfterExpiry the chainlink round id immediately after the expiry timestamp
    function setExpiryPriceInRegistryByRound(
        address _asset,
        uint256 _expiryTimestamp,
        uint256 _roundIdAfterExpiry
    ) external;

    function fallbackPeriodSeconds() external view returns (uint256);

    /// @notice Searches for the round in the asset oracle immediately after the expiry timestamp
    /// @param _asset address of asset to search price for
    /// @param _expiryTimestamp expiry timestamp to find the price at or before
    /// @return the round id immediately after the timestamp submitted
    function searchRoundToSubmit(address _asset, uint256 _expiryTimestamp)
        external
        view
        returns (uint80);

    /// @notice The amount of decimals the strike asset has
    function strikeAssetDecimals() external view returns (uint8);
}
