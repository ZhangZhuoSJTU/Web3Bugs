// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IAnatomyUpdater.sol";

/// @title ManagedIndex reweighing logic interface
/// @notice Contains reweighing logic
interface IManagedIndexReweightingLogic is IAnatomyUpdater {
    /// @notice Updates index anatomy with corresponding weights and assets
    /// @param _assets List for new asset(s) for the index
    /// @param _weights List of new asset(s) corresponding weights
    function reweight(address[] calldata _assets, uint8[] calldata _weights) external;
}
