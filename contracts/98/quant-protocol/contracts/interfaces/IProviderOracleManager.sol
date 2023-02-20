// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IQuantConfig.sol";

/// @title Oracle manager for holding asset addresses and their oracle addresses for a single provider
/// @author Rolla
/// @notice Once an oracle is added for an asset it can't be changed!
interface IProviderOracleManager {
    event OracleAdded(address asset, address oracle);

    /// @notice Add an asset to the oracle manager with its corresponding oracle address
    /// @dev Once this is set for an asset, it can't be changed or removed
    /// @param _asset the address of the asset token we are adding the oracle for
    /// @param _oracle the address of the oracle
    function addAssetOracle(address _asset, address _oracle) external;

    /// @notice Get the expiry price from oracle and store it in the price registry so we have a copy
    /// @param _asset asset to set price of
    /// @param _expiryTimestamp timestamp of price
    /// @param _calldata additional parameter that the method may need to execute
    function setExpiryPriceInRegistry(
        address _asset,
        uint256 _expiryTimestamp,
        bytes memory _calldata
    ) external;

    /// @notice quant central configuration
    function config() external view returns (IQuantConfig);

    /// @notice asset address => oracle address
    function assetOracles(address) external view returns (address);

    /// @notice exhaustive list of asset addresses in map
    function assets(uint256) external view returns (address);

    /// @notice Get the oracle address associated with an asset
    /// @param _asset asset to get price of
    function getAssetOracle(address _asset) external view returns (address);

    /// @notice Get the total number of assets managed by the oracle manager
    /// @return total number of assets managed by the oracle manager
    function getAssetsLength() external view returns (uint256);

    /// @notice Function that should be overridden which should return the current price of an asset from the provider
    /// @param _asset the address of the asset token we want the price for
    /// @return the current price of the asset
    function getCurrentPrice(address _asset) external view returns (uint256);

    /// @notice Checks if the option is valid for the oracle manager with the given parameters
    /// @param _underlyingAsset the address of the underlying asset
    /// @param _expiryTime the expiry timestamp of the option
    /// @param _strikePrice the strike price of the option
    function isValidOption(
        address _underlyingAsset,
        uint256 _expiryTime,
        uint256 _strikePrice
    ) external view returns (bool);
}
