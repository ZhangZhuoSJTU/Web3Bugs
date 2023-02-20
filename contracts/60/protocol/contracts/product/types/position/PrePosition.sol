// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "./Position.sol";
import "../ProductProvider.sol";

/// @dev PrePosition type
struct PrePosition {
    /// @dev Oracle version at which the new position delta was recorded
    uint256 oracleVersion;

    /// @dev Size of position to open at oracle version
    Position openPosition;

    /// @dev Size of position to close at oracle version
    Position closePosition;
}

/**
 * @title PrePositionLib
 * @notice Library that manages a pre-settlement position delta.
 * @dev PrePositions track the currently awaiting-settlement deltas to a settled Position. These are
 *      Primarily necessary to introduce lag into the settlement system such that oracle lag cannot be
 *      gamed to a user's advantage. When a user opens or closes a new position, it sits as a PrePosition
 *      for one oracle version until it's settle into the Position, making it then effective. PrePositions
 *      are automatically settled at the correct oracle version even if a flywheel call doesn't happen until
 *      several version into the future by using the historical version lookups in the corresponding "Versioned"
 *      global state types.
 */
library PrePositionLib {
    using UFixed18Lib for UFixed18;
    using Fixed18Lib for Fixed18;
    using PositionLib for Position;
    using ProductProviderLib for IProductProvider;

    /**
     * @notice Returns whether there is no pending-settlement position delta
     * @dev Can be "empty" even with a non-zero oracleVersion if a position is opened and
     *      closed in the same version netting out to a zero position delta
     * @param self The struct to operate on
     * @return Whether the pending-settlement position delta is empty
     */
    function isEmpty(PrePosition memory self) internal pure returns (bool) {
        return self.openPosition.isEmpty() && self.closePosition.isEmpty();
    }

    /**
     * @notice Increments the maker side of the open position delta
     * @dev Nets out open and close deltas to minimize the size of each
     * @param self The struct to operate on
     * @param oracle The price oracle provider
     * @param amount The position amount to open
     */
    function openMake(PrePosition storage self, IOracle oracle, UFixed18 amount) internal {
        self.openPosition.maker = self.openPosition.maker.add(amount);
        self.oracleVersion = oracle.currentVersion();
        netMake(self);
    }

    /**
     * @notice Increments the maker side of the close position delta
     * @dev Nets out open and close deltas to minimize the size of each
     * @param self The struct to operate on
     * @param oracle The price oracle provider
     * @param amount The maker position amount to close
     */
    function closeMake(PrePosition storage self, IOracle oracle, UFixed18 amount) internal {
        self.closePosition.maker = self.closePosition.maker.add(amount);
        self.oracleVersion = oracle.currentVersion();
        netMake(self);
    }

    /**
     * @notice Increments the taker side of the open position delta
     * @dev Nets out open and close deltas to minimize the size of each
     * @param self The struct to operate on
     * @param oracle The price oracle provider
     * @param amount The taker position amount to open
     */
    function openTake(PrePosition storage self, IOracle oracle, UFixed18 amount) internal {
        self.openPosition.taker = self.openPosition.taker.add(amount);
        self.oracleVersion = oracle.currentVersion();
        netTake(self);
    }

    /**
     * @notice Increments the taker side of the close position delta
     * @dev Nets out open and close deltas to minimize the size of each
     * @param self The struct to operate on
     * @param oracle The price oracle provider
     * @param amount The taker position amount to close
     */
    function closeTake(PrePosition storage self, IOracle oracle, UFixed18 amount) internal {
        self.closePosition.taker = self.closePosition.taker.add(amount);
        self.oracleVersion = oracle.currentVersion();
        netTake(self);
    }

    /**
     * @notice Nets out the open and close on the maker side of the position delta
     * @param self The struct to operate on
     */
    function netMake(PrePosition storage self) private {
        if (self.openPosition.maker.gt(self.closePosition.maker)) {
            self.openPosition.maker = self.openPosition.maker.sub(self.closePosition.maker);
            self.closePosition.maker = UFixed18Lib.ZERO;
        } else {
            self.closePosition.maker = self.closePosition.maker.sub(self.openPosition.maker);
            self.openPosition.maker = UFixed18Lib.ZERO;
        }
    }

    /**
     * @notice Nets out the open and close on the taker side of the position delta
     * @param self The struct to operate on
     */
    function netTake(PrePosition storage self) private {
        if (self.openPosition.taker.gt(self.closePosition.taker)) {
            self.openPosition.taker = self.openPosition.taker.sub(self.closePosition.taker);
            self.closePosition.taker = UFixed18Lib.ZERO;
        } else {
            self.closePosition.taker = self.closePosition.taker.sub(self.openPosition.taker);
            self.openPosition.taker = UFixed18Lib.ZERO;
        }
    }

    /**
     * @notice Returns whether the the pending position delta can be settled at version `toOracleVersion`
     * @dev Pending-settlement positions deltas can be settled (1) oracle version after they are recorded
     * @param self The struct to operate on
     * @param toOracleVersion The potential oracle version to settle
     * @return Whether the position delta can be settled
     */
    function canSettle(PrePosition memory self, uint256 toOracleVersion) internal pure returns (bool) {
        return !isEmpty(self) && toOracleVersion > self.oracleVersion;
    }

    /**
     * @notice Computes the fee incurred for opening or closing the pending-settlement position
     * @param self The struct to operate on
     * @param provider The parameter provider of the product
     * @param toOracleVersion The oracle version at which settlement takes place
     * @return positionFee The maker / taker fee incurred
     */
    function computeFee(PrePosition memory self, IProductProvider provider, uint256 toOracleVersion) internal view returns (UFixed18 positionFee) {
        Fixed18 oraclePrice = provider.priceAtVersion(toOracleVersion);
        Position memory positionDelta = self.openPosition.add(self.closePosition);

        (UFixed18 makerNotional, UFixed18 takerNotional) = (
            Fixed18Lib.from(positionDelta.maker).mul(oraclePrice).abs(),
            Fixed18Lib.from(positionDelta.taker).mul(oraclePrice).abs()
        );

        positionFee = positionFee.add(makerNotional.mul(provider.safeMakerFee()));
        positionFee = positionFee.add(takerNotional.mul(provider.safeTakerFee()));
    }

    /**
     * @notice Computes the next oracle version to settle
     * @dev - If there is no pending-settlement position delta, returns the current oracle version
     *      - If the pending-settlement position delta is not yet ready to be settled, returns the current oracle version
     *      - Otherwise returns the oracle version at which the pending-settlement position delta can be first settled
     *
     *      Corresponds to point (b) in the Position settlement flow
     * @param self The struct to operate on
     * @param oracle The price oracle provider
     * @return Next oracle version to settle
     */
    function oracleVersionToSettle(PrePosition storage self, IOracle oracle) internal view returns (uint256) {
        uint256 current = oracle.currentVersion();
        uint256 next = self.oracleVersion + 1;

        if (next == 1) return current;      // no pre position
        if (next > current) return current; // pre in future
        return next;                        // settle pre
    }
}
