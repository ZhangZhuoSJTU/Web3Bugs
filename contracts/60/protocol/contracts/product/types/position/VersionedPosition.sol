// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "./PrePosition.sol";

//// @dev VersionedPosition type
struct VersionedPosition {
    /// @dev Latest synced oracle version
    uint256 latestVersion;

    /// @dev Mapping of global position at each version
    mapping(uint256 => Position) positionAtVersion;

    /// @dev Current global pending-settlement position delta
    PrePosition pre;
}

/**
 * @title VersionedPositionLib
 * @notice Library that manages global position state.
 * @dev Global position state is used to compute utilization rate and socialization, and to account for and
 *      distribute fees globally.
 *
 *      Positions are stamped for historical lookup anytime there is a global settlement, which services
 *      the delayed-position accounting. It is not guaranteed that every version will have a value stamped, but
 *      only versions when a settlement occurred are needed for this historical computation.
 */
library VersionedPositionLib {
    using PositionLib for Position;
    using PrePositionLib for PrePosition;

    /**
     * @notice Returns the current global position
     * @return Current global position
     */
    function position(VersionedPosition storage self) internal view returns (Position memory) {
        return self.positionAtVersion[self.latestVersion];
    }

    /**
     * @notice Settled the global position to oracle version `toOracleVersion`
     * @param self The struct to operate on
     * @param provider The parameter provider of the product
     * @param toOracleVersion The oracle version to accumulate to
     * @return positionFee The fee accrued from opening or closing a new position
     */
    function settle(VersionedPosition storage self, IProductProvider provider, uint256 toOracleVersion) internal returns (UFixed18 positionFee) {
        if (toOracleVersion <= self.latestVersion) return UFixed18Lib.ZERO;

        bool settled;
        (self.positionAtVersion[toOracleVersion], positionFee, settled) = position(self).settled(self.pre, provider, toOracleVersion);
        if (settled) delete self.pre;

        self.latestVersion = toOracleVersion;
    }
}
