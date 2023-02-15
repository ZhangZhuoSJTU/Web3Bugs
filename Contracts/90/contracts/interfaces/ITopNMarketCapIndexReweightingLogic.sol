// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IAnatomyUpdater.sol";

/// @title TopNMarketCapIndex reweighitng logic interface
/// @notice Contains reweighitng logic
interface ITopNMarketCapIndexReweightingLogic is IAnatomyUpdater {
    /// @notice Call index reweight process
    /// @param _category Index category
    /// @param _snapshotId Snapshot identifier
    /// @param _topN Number of assets
    /// @return New snaphsot id
    function reweight(
        uint _category,
        uint _snapshotId,
        uint _topN
    ) external returns (uint);
}
