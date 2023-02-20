// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./interfaces/IIndexLayout.sol";

/// @title Index layout
/// @notice Contains storage layout of index
abstract contract IndexLayout is IIndexLayout {
    /// @inheritdoc IIndexLayout
    address public override factory;
    /// @inheritdoc IIndexLayout
    address public override vTokenFactory;
    /// @inheritdoc IIndexLayout
    address public override registry;

    /// @notice Timestamp of last AUM fee charge
    uint internal lastTransferTime;

    /// @notice Set with asset addresses
    EnumerableSet.AddressSet internal assets;
    /// @notice Set with previously used asset addresses
    EnumerableSet.AddressSet internal inactiveAssets;
    /// @notice Map of assets and their corresponding weights in index
    mapping(address => uint8) internal weightOf;
}
