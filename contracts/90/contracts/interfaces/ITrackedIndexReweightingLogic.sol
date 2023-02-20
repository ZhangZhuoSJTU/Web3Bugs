// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IAnatomyUpdater.sol";

/// @title TrackedIndex reweighitng logic interface
/// @notice Contains reweighitng logic
interface ITrackedIndexReweightingLogic is IAnatomyUpdater {
    /// @notice Call index reweight process
    function reweight() external;
}
