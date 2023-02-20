// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Top N market capitalization categories interface
/// @notice Interface describing logic for top market capitalization categories management
interface ITopNMarketCapCategories {
    struct DiffDetails {
        uint snapshotId;
        uint totalCapitalizationInBase;
        uint assetCount;
        DiffAsset[] assets;
    }

    struct DiffAsset {
        address asset;
        bool isRemoved;
        uint capitalizationInBase;
    }

    /// @notice Compare asset changes (diff) between provided snapshots within given category
    /// @param _categoryId Category id to check
    /// @param _lastSnapshotId Snapshot id to compare with the latest snapshot
    /// @param _topN Assets amount to compare
    /// @return diff Assets diff object of type DiffDetails
    function assetDiff(
        uint _categoryId,
        uint _lastSnapshotId,
        uint _topN
    ) external view returns (DiffDetails memory diff);
}
