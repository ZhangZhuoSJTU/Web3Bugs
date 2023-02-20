//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./LibMath.sol";
import "../Interfaces/Types.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./LibPerpetuals.sol";

library Balances {
    using LibMath for int256;
    using LibMath for uint256;
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    uint256 public constant MAX_DECIMALS = 18;

    // Size of a position
    struct Position {
        int256 quote;
        int256 base;
    }

    // Information about a trade
    struct Trade {
        uint256 price;
        uint256 amount;
        Perpetuals.Side side;
    }

    // Contains information about the balance of an account in a Tracer market
    struct Account {
        Position position;
        uint256 totalLeveragedValue;
        uint256 lastUpdatedIndex;
        uint256 lastUpdatedGasPrice;
    }

    /**
     * @notice Calculates the notional value of a position as base * price
     * @param position the position the account is currently in
     * @param price The (fair) price of the base asset
     * @return Notional value of a position given the price
     */
    function notionalValue(Position memory position, uint256 price) internal pure returns (uint256) {
        /* cast is safe due to semantics of `abs` */
        return PRBMathUD60x18.mul(uint256(PRBMathSD59x18.abs(position.base)), price);
    }

    /**
     * @notice Calculates the margin as quote + base * base_price
     * @param position The position the account is currently in
     * @param price The price of the base asset
     * @return Margin of the position
     */
    function margin(Position memory position, uint256 price) internal pure returns (int256) {
        /*
         * A cast *must* occur somewhere here in order for this to type check.
         *
         * After you've convinced yourself of this, the next intellectual jump
         * that needs to be made is *what* to cast. We can't cast `quote` as it's
         * allowed to be negative. We can't cast `base` as it's allowed to be
         * negative. Thus, by elimination, the only thing we're left with is
         * `price`.
         *
         * `price` has type `uint256` (i.e., it's unsigned). Thus, our below
         * cast **will** throw iff. `price >= type(int256).max()`.
         */
        int256 signedPrice = LibMath.toInt256(price);
        return position.quote + PRBMathSD59x18.mul(position.base, signedPrice);
    }

    /**
     * @notice Calculates the notional value. i.e. the absolute value of a position
     * @param position The position the account is currently in
     * @param price The price of the base asset
     */
    function leveragedNotionalValue(Position memory position, uint256 price) internal pure returns (uint256) {
        uint256 _notionalValue = notionalValue(position, price);
        int256 marginValue = margin(position, price);

        int256 signedNotionalValue = LibMath.toInt256(_notionalValue);

        if (signedNotionalValue - marginValue < 0) {
            return 0;
        } else {
            return uint256(signedNotionalValue - marginValue);
        }
    }

    /**
     * @notice Calculates the minimum margin needed for an account.
     * Calculated as minMargin = notionalValue / maxLev + 6 * liquidationGasCost
     *                         = (base * price) / maxLev + 6 * liquidationGasCost
     * @param position Position to calculate the minimum margin for
     * @param price Price by which to evaluate the minimum margin
     * @param liquidationGasCost Cost for liquidation denominated in quote tokens
     * @param maximumLeverage (True) maximum leverage of a market.
     *   May be less than the set max leverage of the market because
     *   of deleveraging
     * @return Minimum margin of the position given the parameters
     */
    function minimumMargin(
        Position memory position,
        uint256 price,
        uint256 liquidationGasCost,
        uint256 maximumLeverage
    ) internal pure returns (uint256) {
        // There should be no Minimum margin when user has no position
        if (position.base == 0) {
            return 0;
        }

        uint256 _notionalValue = notionalValue(position, price);

        uint256 adjustedLiquidationGasCost = liquidationGasCost * 6;

        uint256 minimumMarginWithoutGasCost = PRBMathUD60x18.div(_notionalValue, maximumLeverage);

        return adjustedLiquidationGasCost + minimumMarginWithoutGasCost;
    }

    /**
     * @notice Checks the validity of a potential margin given the necessary parameters
     * @param position The position
     * @param liquidationGasCost The cost of calling liquidate
     * @return a bool representing the validity of a margin
     */
    function marginIsValid(
        Balances.Position memory position,
        uint256 liquidationGasCost,
        uint256 price,
        uint256 trueMaxLeverage
    ) internal pure returns (bool) {
        uint256 minMargin = minimumMargin(position, price, liquidationGasCost, trueMaxLeverage);
        int256 _margin = margin(position, price);

        if (_margin < 0) {
            /* Margin being less than 0 is always invalid, even if position is 0.
               This could happen if user attempts to over-withdraw */
            return false;
        }

        return (uint256(_margin) >= minMargin);
    }

    /**
     * @notice Gets the amount that can be matched between two orders
     *         Calculated as min(amountRemaining)
     * @param orderA First order
     * @param fillA Amount of the first order that has been filled
     * @param orderB Second order
     * @param fillB Amount of the second order that has been filled
     * @return Amount matched between two orders
     */
    function fillAmount(
        Perpetuals.Order memory orderA,
        uint256 fillA,
        Perpetuals.Order memory orderB,
        uint256 fillB
    ) internal pure returns (uint256) {
        return LibMath.min(orderA.amount - fillA, orderB.amount - fillB);
    }

    /**
     * @notice Applies changes to a position given a trade
     * @param position Position of the people giving the trade
     * @param trade Amount of the first order that has been filled
     * @param feeRate Fee rate being applied to the trade
     * @return New position
     */
    function applyTrade(
        Position memory position,
        Trade memory trade,
        uint256 feeRate
    ) internal pure returns (Position memory) {
        int256 signedAmount = LibMath.toInt256(trade.amount);
        int256 signedPrice = LibMath.toInt256(trade.price);
        int256 quoteChange = PRBMathSD59x18.mul(signedAmount, signedPrice);
        int256 fee = getFee(trade.amount, trade.price, feeRate);

        int256 newQuote = 0;
        int256 newBase = 0;

        if (trade.side == Perpetuals.Side.Long) {
            newBase = position.base + signedAmount;
            newQuote = position.quote - quoteChange + fee;
        } else if (trade.side == Perpetuals.Side.Short) {
            newBase = position.base - signedAmount;
            newQuote = position.quote + quoteChange - fee;
        }

        Position memory newPosition = Position(newQuote, newBase);

        return newPosition;
    }

    /**
     * @notice Calculates the fee (in quote tokens)
     * @param amount The position (in base tokens)
     * @param executionPrice The execution price (denominated in quote/base)
     * @param feeRate Fee rate being applied to the trade (a %, in WAD)
     * @return Value of the fee being applied to the trade
     */
    function getFee(
        uint256 amount,
        uint256 executionPrice,
        uint256 feeRate
    ) internal pure returns (int256) {
        uint256 quoteChange = PRBMathUD60x18.mul(amount, executionPrice);

        int256 fee = PRBMathUD60x18.mul(quoteChange, feeRate).toInt256();
        return fee;
    }

    /**
     * @notice converts a raw token amount to its WAD representation. Used for tokens
     * that don't have 18 decimal places
     */
    function tokenToWad(uint256 tokenDecimals, uint256 amount) internal pure returns (int256) {
        uint256 scaler = 10**(MAX_DECIMALS - tokenDecimals);
        return amount.toInt256() * scaler.toInt256();
    }

    /**
     * @notice converts a wad token amount to its raw representation.
     */
    function wadToToken(uint256 tokenDecimals, uint256 wadAmount) internal pure returns (uint256) {
        uint256 scaler = uint256(10**(MAX_DECIMALS - tokenDecimals));
        return uint256(wadAmount / scaler);
    }
}
