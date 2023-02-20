// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IPriceOracle.sol";

/// @title Phuture price oracle interface
/// @notice Aggregates all price oracles and works with them through IPriceOracle interface
interface IPhuturePriceOracle is IPriceOracle {
    /// @notice Assigns given oracle to specified asset. Then oracle will be used to manage asset price
    /// @param _asset Asset to register
    /// @param _oracle Oracle to assign
    function setOracleOf(address _asset, address _oracle) external;

    /// @notice Removes oracle of specified asset
    /// @param _asset Asset to remove oracle from
    function removeOracleOf(address _asset) external;

    /// @notice Converts to index amount
    /// @param _baseAmount Amount in base
    /// @param _indexDecimals Index's decimals
    /// @return Asset per base in UQ with index decimals
    function convertToIndex(uint _baseAmount, uint8 _indexDecimals) external view returns (uint);

    /// @notice Checks if the given asset has oracle assigned
    /// @param _asset Asset to check
    /// @return Returns boolean flag defining if the given asset has oracle assigned
    function containsOracleOf(address _asset) external view returns (bool);

    /// @notice Price oracle assigned to the given `_asset`
    /// @param _asset Asset to obtain price oracle for
    /// @return Returns price oracle assigned to the `_asset`
    function priceOracleOf(address _asset) external view returns (address);
}
