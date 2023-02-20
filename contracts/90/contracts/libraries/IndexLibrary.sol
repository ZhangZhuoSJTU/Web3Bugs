// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "./FullMath.sol";
import "./FixedPoint112.sol";

/// @title Index library
/// @notice Provides various utilities for indexes
library IndexLibrary {
    using FullMath for uint;

    /// @notice Initial index quantity to mint
    uint constant INITIAL_QUANTITY = 10000;

    /// @notice Total assets weight within an index
    uint8 constant MAX_WEIGHT = type(uint8).max;

    /// @notice Returns amount of asset equivalent to the given parameters
    /// @param _assetPerBaseInUQ Asset per base price in UQ
    /// @param _weight Weight of the given asset
    /// @param _amountInBase Total assets amount in base
    /// @return Amount of asset
    function amountInAsset(
        uint _assetPerBaseInUQ,
        uint8 _weight,
        uint _amountInBase
    ) internal pure returns (uint) {
        require(_assetPerBaseInUQ > 0, "IndexLibrary: ORACLE");

        return ((_amountInBase * _weight) / MAX_WEIGHT).mulDiv(_assetPerBaseInUQ, FixedPoint112.Q112);
    }
}
