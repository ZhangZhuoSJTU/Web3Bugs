// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOracleFallbackMechanism {
    /// @notice Fallback mechanism to submit price to the registry (should enforce a locking period)
    /// @param _asset asset to set price of
    /// @param _expiryTimestamp timestamp of price
    /// @param _price price to submit
    function setExpiryPriceInRegistryFallback(
        address _asset,
        uint256 _expiryTimestamp,
        uint256 _price
    ) external;
}
