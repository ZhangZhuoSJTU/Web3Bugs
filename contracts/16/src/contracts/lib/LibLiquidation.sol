// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./LibMath.sol";
import "./LibPerpetuals.sol";
import "./LibBalances.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

library LibLiquidation {
    using LibMath for uint256;
    using LibMath for int256;
    using PRBMathUD60x18 for uint256;
    using PRBMathSD59x18 for int256;

    // Information about the liquidation receipt
    struct LiquidationReceipt {
        address tracer;
        address liquidator;
        address liquidatee;
        uint256 price;
        uint256 time;
        uint256 escrowedAmount;
        uint256 releaseTime;
        int256 amountLiquidated;
        bool escrowClaimed;
        Perpetuals.Side liquidationSide;
        bool liquidatorRefundClaimed;
    }

    /**
     * @return The amount a liquidator must escrow in order to liquidate a given position.
     *         Calculated as currentMargin - (minMargin - currentMargin) * portion of whole position being liquidated
     * @dev Assumes params are WAD
     * @param minMargin User's minimum margin
     * @param currentMargin User's current margin
     * @param amount Amount being liquidated
     * @param totalBase User's total base
     */
    function calcEscrowLiquidationAmount(
        uint256 minMargin,
        int256 currentMargin,
        int256 amount,
        int256 totalBase
    ) internal pure returns (uint256) {
        int256 amountToEscrow = currentMargin - (minMargin.toInt256() - currentMargin);
        int256 amountToEscrowProportional = PRBMathSD59x18.mul(amountToEscrow, PRBMathSD59x18.div(amount, totalBase));
        if (amountToEscrowProportional < 0) {
            return 0;
        }
        return uint256(amountToEscrowProportional);
    }

    /**
     * @notice Calculates the updated quote and base of the trader and liquidator on a liquidation event.
     * @param liquidatedQuote The quote of the account being liquidated
     * @param liquidatedBase The base of the account being liquidated
     * @param amount The amount that is to be liquidated from the position
     */
    function liquidationBalanceChanges(
        int256 liquidatedBase, //10^18
        int256 liquidatedQuote, //10^18
        int256 amount //10^18
    )
        public
        pure
        returns (
            int256 _liquidatorQuoteChange,
            int256 _liquidatorBaseChange,
            int256 _liquidateeQuoteChange,
            int256 _liquidateeBaseChange
        )
    {
        // proportionate amount of base to take
        // base * (amount / abs(quote))
        if (liquidatedBase == 0) {
            return (0, 0, 0, 0);
        }

        int256 portionOfQuote = PRBMathSD59x18.mul(
            liquidatedQuote,
            PRBMathSD59x18.div(amount, PRBMathSD59x18.abs(liquidatedBase))
        );

        // todo with the below * -1, note ints can overflow as 2^-127 is valid but 2^127 is not.
        if (liquidatedBase < 0) {
            _liquidatorBaseChange = amount * (-1);
            _liquidateeBaseChange = amount;
        } else {
            _liquidatorBaseChange = amount;
            _liquidateeBaseChange = amount * (-1);
        }

        /* If quote is negative, liquidator always takes on negative quote */
        _liquidatorQuoteChange = portionOfQuote;
        _liquidateeQuoteChange = portionOfQuote * (-1);
    }

    /**
     * @notice Calculates the amount of slippage experienced compared to value of position in a receipt
     * @param unitsSold Amount of quote units sold in the orders
     * @param maxSlippage The upper bound for slippage
     * @param avgPrice The average price of units sold in orders
     * @param receipt The receipt for the state during liquidation
     */
    function calculateSlippage(
        uint256 unitsSold, //10^18
        uint256 maxSlippage, //10^18
        uint256 avgPrice, //10^18
        LiquidationReceipt memory receipt
    ) internal pure returns (uint256) {
        // Check price slippage and update account states
        if (
            avgPrice == receipt.price || // No price change
            (avgPrice < receipt.price && receipt.liquidationSide == Perpetuals.Side.Short) || // Price dropped, but position is short
            (avgPrice > receipt.price && receipt.liquidationSide == Perpetuals.Side.Long) // Price jumped, but position is long
        ) {
            // No slippage
            return 0;
        } else {
            // Liquidator took a long position, and price dropped
            uint256 amountSoldFor = PRBMathUD60x18.mul(avgPrice, unitsSold);
            uint256 amountExpectedFor = PRBMathUD60x18.mul(receipt.price, unitsSold);

            // The difference in how much was expected vs how much liquidator actually got.
            // i.e. The amount lost by liquidator
            uint256 amountToReturn = 0;
            uint256 percentSlippage = 0;
            if (avgPrice < receipt.price && receipt.liquidationSide == Perpetuals.Side.Long) {
                amountToReturn = amountExpectedFor - amountSoldFor;
            } else if (avgPrice > receipt.price && receipt.liquidationSide == Perpetuals.Side.Short) {
                amountToReturn = amountSoldFor - amountExpectedFor;
            }
            if (amountToReturn <= 0) {
                return 0;
            }

            // slippage percent = slippage / total amount
            percentSlippage = PRBMathUD60x18.div(amountToReturn, amountExpectedFor);

            if (percentSlippage > maxSlippage) {
                amountToReturn = PRBMathUD60x18.mul(maxSlippage, amountExpectedFor);
            }
            return amountToReturn;
        }
    }

    /**
     * @return true if the margin is greater than 10x liquidation gas cost (in quote tokens)
     * @dev Assumes params are WAD except liquidationGasCost
     * @param updatedPosition The agent's position after being liquidated
     * @param lastUpdatedGasPrice The last updated gas price of the account to be liquidated
     * @param liquidationGasCost Approximately how much gas is used to call liquidate()
     * @param price Current fair price
     * @param minimumLeftoverGasCostMultiplier The amount to multiply the liquidation cost by in
     *                                         in order to calculate minimum leftover margin
     */
    function partialLiquidationIsValid(
        Balances.Position memory updatedPosition,
        uint256 lastUpdatedGasPrice,
        uint256 liquidationGasCost,
        uint256 price,
        uint256 minimumLeftoverGasCostMultiplier
    ) internal pure returns (bool) {
        uint256 minimumLeftoverMargin = PRBMathUD60x18.mul(lastUpdatedGasPrice, liquidationGasCost) *
            minimumLeftoverGasCostMultiplier;

        int256 margin = Balances.margin(updatedPosition, price);
        return margin >= minimumLeftoverMargin.toInt256() || (updatedPosition.base == 0 && updatedPosition.quote == 0);
    }
}
