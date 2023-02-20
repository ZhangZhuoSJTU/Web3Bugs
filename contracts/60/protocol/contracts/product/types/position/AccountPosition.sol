// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "./PrePosition.sol";
import "../accumulator/Accumulator.sol";

/// @dev AccountPosition type
struct AccountPosition {
    /// @dev The current settled position of the account
    Position position;

    /// @dev The current position delta pending-settlement
    PrePosition pre;

    /// @dev Whether the account is currently locked for liquidation
    bool liquidation;
}

/**
 * @title AccountPositionLib
 * @notice Library that manages an account-level position.
 */
library AccountPositionLib {
    using UFixed18Lib for UFixed18;
    using Fixed18Lib for Fixed18;
    using PositionLib for Position;
    using PrePositionLib for PrePosition;

    /**
     * @notice Settled the account's position to oracle version `toOracleVersion`
     * @param self The struct to operate on
     * @param provider The parameter provider of the product
     * @param toOracleVersion The oracle version to accumulate to
     * @return positionFee The fee accrued from opening or closing a new position
     */
    function settle(AccountPosition storage self, IProductProvider provider, uint256 toOracleVersion) internal returns (UFixed18 positionFee) {
        bool settled;
        (self.position, positionFee, settled) = self.position.settled(self.pre, provider, toOracleVersion);
        if (settled) delete self.pre;
    }

    /**
     * @notice Returns the current maintenance requirement for the account
     * @param self The struct to operate on
     * @param provider The parameter provider of the product
     * @return Current maintenance requirement for the account
     */
    function maintenance(AccountPosition storage self, IProductProvider provider) internal view returns (UFixed18) {
        if (self.liquidation) return UFixed18Lib.ZERO;
        return maintenanceInternal(self.position, provider);
    }

    /**
     * @notice Returns the maintenance requirement after the next oracle version settlement
     * @dev Includes the current pending-settlement position delta, assumes no price change
     * @param self The struct to operate on
     * @param provider The parameter provider of the product
     * @return Next maintenance requirement for the account
     */
    function maintenanceNext(AccountPosition storage self, IProductProvider provider) internal view returns (UFixed18) {
        return maintenanceInternal(self.position.next(self.pre), provider);
    }

    /**
      @notice Returns the maintenance requirement for a given `position`
     * @dev Internal helper
     * @param position The position to compete the maintenance requirement for
     * @param provider The parameter provider of the product
     * @return Next maintenance requirement for the account
     */
    function maintenanceInternal(Position memory position, IProductProvider provider) private view returns (UFixed18) {
        Fixed18 oraclePrice = provider.priceAtVersion(provider.currentVersion());
        UFixed18 notionalMax = Fixed18Lib.from(position.max()).mul(oraclePrice).abs();
        return notionalMax.mul(provider.maintenance());
    }

    /**
     * @notice Returns whether an account is completely closed, i.e. no position or pre-position
     * @param self The struct to operate on
     * @return Whether the account is closed
     */
    function isClosed(AccountPosition memory self) internal pure returns (bool) {
        return self.pre.isEmpty() && self.position.isEmpty();
    }

    /**
     * @notice Returns whether an account has opened position on both sides of the market (maker vs taker)
     * @dev Used to verify the invariant that a single account can only have a position on one side of the
     *      market at a time
     * @param self The struct to operate on
     * @return Whether the account is currently doubled sided
     */
    function isDoubleSided(AccountPosition storage self) internal view returns (bool) {
        bool makerEmpty = self.position.maker.isZero() && self.pre.openPosition.maker.isZero() && self.pre.closePosition.maker.isZero();
        bool takerEmpty = self.position.taker.isZero() && self.pre.openPosition.taker.isZero() && self.pre.closePosition.taker.isZero();

        return !makerEmpty && !takerEmpty;
    }

    /**
     * @notice Returns whether the account's pending-settlement delta closes more position than is open
     * @dev Used to verify the invariant that an account cannot settle into having a negative position
     * @param self The struct to operate on
     * @return Whether the account is currently over closed
     */
    function isOverClosed(AccountPosition storage self) internal view returns (bool) {
        Position memory nextOpen = self.position.add(self.pre.openPosition);

        return  self.pre.closePosition.maker.gt(nextOpen.maker) || self.pre.closePosition.taker.gt(nextOpen.taker);
    }
}
