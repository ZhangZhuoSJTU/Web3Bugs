// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IIndex.sol";

/// @title Managed index interface
/// @notice Interface for dynamic indexes that could be updated with new anatomy data
interface IManagedIndex is IIndex {
    /// @notice Updates index anatomy with corresponding weights and assets
    /// @param _assets List for new asset(s) for the index
    /// @param _weights List of new asset(s) corresponding weights
    function reweight(address[] calldata _assets, uint8[] calldata _weights) external;
}
