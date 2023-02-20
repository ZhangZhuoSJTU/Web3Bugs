// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "./Accumulator.sol";
import "./VersionedAccumulator.sol";
import "../position/AccountPosition.sol";

/// @dev AccountAccumulator type
struct AccountAccumulator {
    /// @dev latest version that the account was synced too
    uint256 latestVersion;
}

/**
 * @title AccountAccumulatorLib
 * @notice Library that manages syncing an account-level accumulator.
 */
library AccountAccumulatorLib {
    using PositionLib for Position;
    using AccumulatorLib for Accumulator;

    /**
     * @notice Syncs the account to oracle version `versionTo`
     * @param self The struct to operate on
     * @param global Pointer to global accumulator
     * @param position Pointer to global position
     * @param versionTo Oracle version to sync account to
     * @return value The value accumulated sync last sync
     */
    function syncTo(
        AccountAccumulator storage self,
        VersionedAccumulator storage global,
        AccountPosition storage position,
        uint256 versionTo
    ) internal returns (Accumulator memory value) {
        Accumulator memory valueAccumulated =
            global.valueAtVersion[versionTo].sub(global.valueAtVersion[self.latestVersion]);
        value = position.position.mul(valueAccumulated);
        self.latestVersion = versionTo;
    }
}
