// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./LiquidationHelpers.sol";
import "../AccountContextHandler.sol";
import "../valuation/ExchangeRate.sol";
import "../markets/CashGroup.sol";
import "../markets/AssetRate.sol";
import "../portfolio/BitmapAssetsHandler.sol";
import "../portfolio/PortfolioHandler.sol";
import "../balances/BalanceHandler.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library LiquidateCurrency {
    using SafeInt256 for int256;
    using ExchangeRate for ETHRate;
    using PortfolioHandler for PortfolioState;
    using AssetHandler for PortfolioAsset;
    using AssetRate for AssetRateParameters;
    using CashGroup for CashGroupParameters;
    using Market for MarketParameters;
    using AccountContextHandler for AccountContext;
    using BalanceHandler for BalanceState;

    function _hasLiquidityTokens(PortfolioAsset[] memory portfolio, uint256 currencyId)
        private
        pure
        returns (bool)
    {
        for (uint256 i; i < portfolio.length; i++) {
            if (
                portfolio[i].currencyId == currencyId &&
                AssetHandler.isLiquidityToken(portfolio[i].assetType) &&
                // This should not be possible (a deleted asset) in the portfolio
                // at this stage of liquidation but we do this check to be defensive.
                portfolio[i].storageState != AssetStorageState.Delete
            ) {
                return true;
            }
        }

        return false;
    }

    /// @notice Liquidates an account by converting their local currency collateral into cash and
    /// eliminates any haircut value incurred by liquidity tokens or nTokens. Requires no capital
    /// on the part of the liquidator, this is pure arbitrage. It's highly unlikely that an account will
    /// encounter this scenario but this method is here for completeness.
    function liquidateLocalCurrency(
        uint256 localCurrency,
        uint96 maxNTokenLiquidation,
        uint256 blockTime,
        BalanceState memory balanceState,
        LiquidationFactors memory factors,
        PortfolioState memory portfolio
    ) internal view returns (int256) {
        require(factors.localAssetAvailable < 0, "No local debt");

        int256 assetBenefitRequired =
            factors.cashGroup.assetRate.convertFromUnderlying(
                factors
                    .localETHRate
                    .convertETHTo(factors.netETHValue.neg())
                    .mul(Constants.PERCENTAGE_DECIMALS)
                    .div(factors.localETHRate.buffer)
            );

        int256 netAssetCashFromLiquidator;

        if (_hasLiquidityTokens(portfolio.storedAssets, localCurrency)) {
            WithdrawFactors memory w;
            (w, assetBenefitRequired) = _withdrawLocalLiquidityTokens(
                portfolio,
                factors,
                blockTime,
                assetBenefitRequired
            );
            netAssetCashFromLiquidator = w.totalIncentivePaid.neg();
            balanceState.netCashChange = w.totalCashClaim.sub(w.totalIncentivePaid);
        }

        if (factors.nTokenHaircutAssetValue > 0) {
            int256 nTokensToLiquidate;
            {
                // This will not underflow, checked when saving parameters
                int256 haircutDiff =
                    int256(
                        uint8(factors.nTokenParameters[Constants.LIQUIDATION_HAIRCUT_PERCENTAGE]) -
                            uint8(factors.nTokenParameters[Constants.PV_HAIRCUT_PERCENTAGE])
                    ) * Constants.PERCENTAGE_DECIMALS;

                // fullNTokenPV = haircutTokenPV / haircutPercentage
                // benefitGained = nTokensToLiquidate * (liquidatedPV - freeCollateralPV)
                // benefitGained = nTokensToLiquidate * (fullNTokenPV * liquidatedPV - fullNTokenPV * pvHaircut)
                // benefitGained = nTokensToLiquidate * fullNTokenPV * (liquidatedPV - pvHaircut) / totalBalance
                // benefitGained = nTokensToLiquidate * (haircutTokenPV / haircutPercentage) * (liquidationHaircut - pvHaircut) / totalBalance
                // benefitGained = nTokensToLiquidate * haircutTokenPV * (liquidationHaircut - pvHaircut) / (totalBalance * haircutPercentage)
                // nTokensToLiquidate = (benefitGained * totalBalance * haircutPercentage) / (haircutTokenPV * (liquidationHaircut - pvHaircut))
                nTokensToLiquidate = assetBenefitRequired
                    .mul(balanceState.storedNTokenBalance)
                    .mul(int256(uint8(factors.nTokenParameters[Constants.PV_HAIRCUT_PERCENTAGE])))
                    .div(factors.nTokenHaircutAssetValue.mul(haircutDiff));
            }

            nTokensToLiquidate = LiquidationHelpers.calculateLiquidationAmount(
                nTokensToLiquidate,
                balanceState.storedNTokenBalance,
                int256(maxNTokenLiquidation)
            );
            balanceState.netNTokenTransfer = nTokensToLiquidate.neg();

            {
                // fullNTokenPV = haircutTokenPV / haircutPercentage
                // localFromLiquidator = tokensToLiquidate * fullNTokenPV * liquidationHaircut / totalBalance
                // prettier-ignore
                int256 localAssetCash =
                    nTokensToLiquidate
                        .mul(int256(uint8(factors.nTokenParameters[Constants.LIQUIDATION_HAIRCUT_PERCENTAGE])))
                        .mul(factors.nTokenHaircutAssetValue)
                        .div(int256(uint8(factors.nTokenParameters[Constants.PV_HAIRCUT_PERCENTAGE])))
                        .div(balanceState.storedNTokenBalance);

                balanceState.netCashChange = balanceState.netCashChange.add(localAssetCash);
                netAssetCashFromLiquidator = netAssetCashFromLiquidator.add(localAssetCash);
            }
        }

        return netAssetCashFromLiquidator;
    }

    /// @notice Liquidates collateral in the form of cash, liquidity token cash claims, or nTokens in that
    /// liquidation preference.
    function liquidateCollateralCurrency(
        uint128 maxCollateralLiquidation,
        uint96 maxNTokenLiquidation,
        uint256 blockTime,
        BalanceState memory balanceState,
        LiquidationFactors memory factors,
        PortfolioState memory portfolio
    ) internal view returns (int256) {
        require(factors.localAssetAvailable < 0, "No local debt");
        require(factors.collateralAssetAvailable > 0, "No collateral");

        (
            int256 requiredCollateralAssetCash,
            int256 localAssetCashFromLiquidator,
            int256 liquidationDiscount
        ) = _calculateCollateralToRaise(factors, int256(maxCollateralLiquidation));

        int256 collateralAssetRemaining = requiredCollateralAssetCash;
        if (balanceState.storedCashBalance > 0) {
            if (balanceState.storedCashBalance > collateralAssetRemaining) {
                balanceState.netCashChange = collateralAssetRemaining.neg();
                collateralAssetRemaining = 0;
            } else {
                // Sell off all cash balance and calculate remaining collateral
                balanceState.netCashChange = balanceState.storedCashBalance.neg();
                collateralAssetRemaining = collateralAssetRemaining.sub(
                    balanceState.storedCashBalance
                );
            }
        }

        if (
            collateralAssetRemaining > 0 &&
            _hasLiquidityTokens(portfolio.storedAssets, balanceState.currencyId)
        ) {
            int256 newCollateralAssetRemaining =
                _withdrawCollateralLiquidityTokens(
                    portfolio,
                    factors,
                    blockTime,
                    collateralAssetRemaining
                );

            // This is a hack and ugly but there are stack issues in `LiquidateCurrencyAction.liquidateCollateralCurrency`
            // and this is a way to deal with it with the fewest contortions. There are no asset cash transfers within liquidation
            // so we overload the meaning of the field here to hold the net liquidity token cash change. Will zero this out before
            // going into finalize for the liquidated account's cash balances. This value is not simply added to the netCashChange field
            // because the cashClaim value is not stored in the balances and therefore the liquidated account will have too much cash
            // debited from their stored cash value.
            balanceState.netAssetTransferInternalPrecision = collateralAssetRemaining.sub(
                newCollateralAssetRemaining
            );
            collateralAssetRemaining = newCollateralAssetRemaining;
        }

        if (collateralAssetRemaining > 0 && factors.nTokenHaircutAssetValue > 0) {
            collateralAssetRemaining = _calculateCollateralNTokenTransfer(
                balanceState,
                factors,
                collateralAssetRemaining,
                int256(maxNTokenLiquidation)
            );
        }

        if (collateralAssetRemaining > 0) {
            // If there is any collateral asset remaining then recalculate the localAssetCashFromLiquidator
            // prettier-ignore
            (
                /* collateralToRaise */,
                localAssetCashFromLiquidator
            ) = LiquidationHelpers.calculateLocalToPurchase(
                factors,
                liquidationDiscount,
                requiredCollateralAssetCash.sub(collateralAssetRemaining),
                requiredCollateralAssetCash.sub(collateralAssetRemaining)
            );
        }

        return localAssetCashFromLiquidator;
    }

    /// @dev Calculates anticipated collateral to raise, enforcing some limits. Actual transfers may be lower due
    /// to limits on the nToken transfer
    function _calculateCollateralToRaise(
        LiquidationFactors memory factors,
        int256 maxCollateralLiquidation
    )
        private
        pure
        returns (
            int256 requiredCollateralAssetCash,
            int256 localAssetCashFromLiquidator,
            int256 liquidationDiscount
        )
    {
        int256 assetCashBenefitRequired;
        (assetCashBenefitRequired, liquidationDiscount) = LiquidationHelpers
            .calculateCrossCurrencyBenefitAndDiscount(factors);
        {
            // collateralCurrencyBenefit = localPurchased * localBuffer * exchangeRate -
            //      collateralToSell * collateralHaircut
            // localPurchased = collateralToSell / (exchangeRate * liquidationDiscount)
            //
            // collateralCurrencyBenefit = [collateralToSell / (exchangeRate * liquidationDiscount)] * localBuffer * exchangeRate -
            //      collateralToSell * collateralHaircut
            // collateralCurrencyBenefit = (collateralToSell * localBuffer) / liquidationDiscount - collateralToSell * collateralHaircut
            // collateralCurrencyBenefit = collateralToSell * (localBuffer / liquidationDiscount - collateralHaircut)
            // collateralToSell = collateralCurrencyBenefit / [(localBuffer / liquidationDiscount - collateralHaircut)]
            int256 denominator =
                factors
                    .localETHRate
                    .buffer
                    .mul(Constants.PERCENTAGE_DECIMALS)
                    .div(liquidationDiscount)
                    .sub(factors.collateralETHRate.haircut);

            requiredCollateralAssetCash = assetCashBenefitRequired
                .mul(Constants.PERCENTAGE_DECIMALS)
                .div(denominator);
        }

        requiredCollateralAssetCash = LiquidationHelpers.calculateLiquidationAmount(
            requiredCollateralAssetCash,
            factors.collateralAssetAvailable,
            0 // will check userSpecifiedAmount below
        );

        // Enforce the user specified max liquidation amount
        if (
            maxCollateralLiquidation > 0 && requiredCollateralAssetCash > maxCollateralLiquidation
        ) {
            requiredCollateralAssetCash = maxCollateralLiquidation;
        }

        // prettier-ignore
        (requiredCollateralAssetCash, localAssetCashFromLiquidator) = LiquidationHelpers
            .calculateLocalToPurchase(
                factors,
                liquidationDiscount,
                requiredCollateralAssetCash,
                requiredCollateralAssetCash
            );

        return (requiredCollateralAssetCash, localAssetCashFromLiquidator, liquidationDiscount);
    }

    /// @dev Calculates the nToken transfer.
    function _calculateCollateralNTokenTransfer(
        BalanceState memory balanceState,
        LiquidationFactors memory factors,
        int256 collateralAssetRemaining,
        int256 maxNTokenLiquidation
    ) internal pure returns (int256) {
        // fullNTokenPV = haircutTokenPV / haircutPercentage
        // collateralToRaise = tokensToLiquidate * fullNTokenPV * liquidationHaircut / totalBalance
        // tokensToLiquidate = collateralToRaise * totalBalance / (fullNTokenPV * liquidationHaircut)
        // tokensToLiquidate = (collateralToRaise * totalBalance * haircutPercentage) / (haircutTokenPV * liquidationHaircut)
        int256 nTokenLiquidationHaircut =
            int256(uint8(factors.nTokenParameters[Constants.LIQUIDATION_HAIRCUT_PERCENTAGE]));
        int256 nTokenHaircut =
            int256(uint8(factors.nTokenParameters[Constants.PV_HAIRCUT_PERCENTAGE]));
        int256 nTokensToLiquidate =
            collateralAssetRemaining.mul(balanceState.storedNTokenBalance).mul(nTokenHaircut).div(
                factors.nTokenHaircutAssetValue.mul(nTokenLiquidationHaircut)
            );

        if (maxNTokenLiquidation > 0 && nTokensToLiquidate > maxNTokenLiquidation) {
            nTokensToLiquidate = maxNTokenLiquidation;
        }

        if (nTokensToLiquidate > balanceState.storedNTokenBalance) {
            nTokensToLiquidate = balanceState.storedNTokenBalance;
        }

        balanceState.netNTokenTransfer = nTokensToLiquidate.neg();
        // NOTE: it's possible that this results in > DEFAULT_LIQUIDATION_PORTION in PV terms. However, it will not be more than
        // the liquidateHaircutPercentage which will be set to a nominal amount. Since DEFAULT_LIQUIDATION_PORTION is arbitrary we
        // don't put too much emphasis on this and allow it to occur.
        collateralAssetRemaining = collateralAssetRemaining.subNoNeg(
            // collateralToRaise = (nTokenToLiquidate * nTokenPV * liquidateHaircutPercentage) / nTokenBalance
            nTokensToLiquidate
                .mul(factors.nTokenHaircutAssetValue)
                .mul(nTokenLiquidationHaircut)
                .div(nTokenHaircut)
                .div(balanceState.storedNTokenBalance)
        );

        return collateralAssetRemaining;
    }

    struct WithdrawFactors {
        int256 netCashIncrease;
        int256 fCash;
        int256 assetCash;
        int256 totalIncentivePaid;
        int256 totalCashClaim;
        int256 incentivePaid;
    }

    /// @notice Withdraws local liquidity tokens from a portfolio and pays an incentive to the liquidator.
    function _withdrawLocalLiquidityTokens(
        PortfolioState memory portfolioState,
        LiquidationFactors memory factors,
        uint256 blockTime,
        int256 assetAmountRemaining
    ) internal view returns (WithdrawFactors memory, int256) {
        require(portfolioState.newAssets.length == 0); // dev: new assets in portfolio
        factors.markets = new MarketParameters[](factors.cashGroup.maxMarketIndex);
        // Do this to deal with stack issues
        WithdrawFactors memory w;

        for (uint256 i; i < portfolioState.storedAssets.length; i++) {
            PortfolioAsset memory asset = portfolioState.storedAssets[i];
            if (asset.storageState == AssetStorageState.Delete) continue;
            if (
                !AssetHandler.isLiquidityToken(asset.assetType) ||
                asset.currencyId != factors.cashGroup.currencyId
            ) continue;

            uint256 marketIndex = asset.assetType - 1;
            // This is set up this way so that we can delay setting storage of markets so that this method can
            // remain a view function
            factors.cashGroup.loadMarket(
                factors.markets[marketIndex - 1],
                marketIndex,
                true,
                blockTime
            );

            // NOTE: we do not give any credit to the haircut fCash in this procedure but it will end up adding
            // additional collateral value back into the account. It's probably too complex to deal with this so
            // we will just leave it as such.
            (w.assetCash, w.fCash) = asset.getCashClaims(factors.markets[marketIndex - 1]);
            _calculateNetCashIncreaseAndIncentivePaid(factors, w, asset.assetType);

            // (netCashToAccount <= assetAmountRemaining)
            if (w.netCashIncrease.subNoNeg(w.incentivePaid) <= assetAmountRemaining) {
                // The additional cash is insufficient to cover asset amount required so we just remove all of it.
                portfolioState.deleteAsset(i);
                factors.markets[marketIndex - 1].removeLiquidity(asset.notional);

                // assetAmountRemaining = assetAmountRemaining - netCashToAccount
                // netCashToAccount = netCashIncrease - incentivePaid
                // overflow checked above
                assetAmountRemaining =
                    assetAmountRemaining -
                    w.netCashIncrease.sub(w.incentivePaid);
            } else {
                // Otherwise remove a proportional amount of liquidity tokens to cover the amount remaining.
                int256 tokensToRemove =
                    asset.notional.mul(assetAmountRemaining).div(
                        w.netCashIncrease.subNoNeg(w.incentivePaid)
                    );

                (w.assetCash, w.fCash) = factors.markets[marketIndex - 1].removeLiquidity(
                    tokensToRemove
                );
                // Recalculate net cash increase and incentive paid. w.assetCash is different because we partially
                // remove asset cash
                _calculateNetCashIncreaseAndIncentivePaid(factors, w, asset.assetType);

                // Remove liquidity token balance
                portfolioState.storedAssets[i].notional = asset.notional.subNoNeg(tokensToRemove);
                portfolioState.storedAssets[i].storageState = AssetStorageState.Update;
                assetAmountRemaining = 0;
            }

            w.totalIncentivePaid = w.totalIncentivePaid.add(w.incentivePaid);
            w.totalCashClaim = w.totalCashClaim.add(w.assetCash);

            // Add the netfCash asset to the portfolio since we've withdrawn the liquidity tokens
            portfolioState.addAsset(
                factors.cashGroup.currencyId,
                asset.maturity,
                Constants.FCASH_ASSET_TYPE,
                w.fCash
            );

            if (assetAmountRemaining == 0) break;
        }

        return (w, assetAmountRemaining);
    }

    function _calculateNetCashIncreaseAndIncentivePaid(
        LiquidationFactors memory factors,
        WithdrawFactors memory w,
        uint256 assetType
    ) private pure {
        // We can only recollateralize the local currency using the part of the liquidity token that
        // between the pre-haircut cash claim and the post-haircut cash claim. Part of the cash raised
        // is paid out as an incentive so that must be accounted for.
        // netCashIncrease = cashClaim * (1 - haircut)
        // netCashIncrease = netCashToAccount + incentivePaid
        // incentivePaid = netCashIncrease * incentive
        int256 haircut = int256(factors.cashGroup.getLiquidityHaircut(assetType));
        w.netCashIncrease = w.assetCash.mul(Constants.PERCENTAGE_DECIMALS.sub(haircut)).div(
            Constants.PERCENTAGE_DECIMALS
        );
        w.incentivePaid = w.netCashIncrease.mul(Constants.TOKEN_REPO_INCENTIVE_PERCENT).div(
            Constants.PERCENTAGE_DECIMALS
        );
    }

    /// @dev Similar to withdraw liquidity tokens, except there is no incentive paid and we do not worry about
    /// haircut amounts, we simply withdraw as much collateral as needed.
    function _withdrawCollateralLiquidityTokens(
        PortfolioState memory portfolioState,
        LiquidationFactors memory factors,
        uint256 blockTime,
        int256 collateralToWithdraw
    ) internal view returns (int256) {
        require(portfolioState.newAssets.length == 0); // dev: new assets in portfolio
        factors.markets = new MarketParameters[](factors.cashGroup.maxMarketIndex);

        for (uint256 i; i < portfolioState.storedAssets.length; i++) {
            PortfolioAsset memory asset = portfolioState.storedAssets[i];
            if (asset.storageState == AssetStorageState.Delete) continue;
            if (
                !AssetHandler.isLiquidityToken(asset.assetType) ||
                asset.currencyId != factors.cashGroup.currencyId
            ) continue;

            uint256 marketIndex = asset.assetType - 1;
            // This is set up this way so that we can delay setting storage of markets so that this method can
            // remain a view function
            factors.cashGroup.loadMarket(
                factors.markets[marketIndex - 1],
                marketIndex,
                true,
                blockTime
            );
            (int256 cashClaim, int256 fCashClaim) =
                asset.getCashClaims(factors.markets[marketIndex - 1]);

            if (cashClaim <= collateralToWithdraw) {
                // The additional cash is insufficient to cover asset amount required so we just remove all of it.
                portfolioState.deleteAsset(i);
                factors.markets[marketIndex - 1].removeLiquidity(asset.notional);

                // overflow checked above
                collateralToWithdraw = collateralToWithdraw - cashClaim;
            } else {
                // Otherwise remove a proportional amount of liquidity tokens to cover the amount remaining.
                // NOTE: dust can accrue when withdrawing liquidity at this point
                int256 tokensToRemove = asset.notional.mul(collateralToWithdraw).div(cashClaim);
                (cashClaim, fCashClaim) = factors.markets[marketIndex - 1].removeLiquidity(
                    tokensToRemove
                );

                // Remove liquidity token balance
                portfolioState.storedAssets[i].notional = asset.notional.subNoNeg(tokensToRemove);
                portfolioState.storedAssets[i].storageState = AssetStorageState.Update;
                collateralToWithdraw = 0;
            }

            // Add the netfCash asset to the portfolio since we've withdrawn the liquidity tokens
            portfolioState.addAsset(
                factors.cashGroup.currencyId,
                asset.maturity,
                Constants.FCASH_ASSET_TYPE,
                fCashClaim
            );

            if (collateralToWithdraw == 0) return 0;
        }

        return collateralToWithdraw;
    }

    function finalizeLiquidatedCollateralAndPortfolio(
        address liquidateAccount,
        BalanceState memory collateralBalanceState,
        AccountContext memory accountContext,
        PortfolioState memory portfolio,
        MarketParameters[] memory markets
    ) internal {
        // Asset transfer value is set to record liquidity token withdraw balances and should not be
        // finalized inside the liquidated collateral. See comment inside liquidateCollateralCurrency
        // for more details
        int256 tmpAssetTransferAmount = collateralBalanceState.netAssetTransferInternalPrecision;
        collateralBalanceState.netAssetTransferInternalPrecision = 0;

        // Finalize liquidated account balance
        collateralBalanceState.finalize(liquidateAccount, accountContext, false);
        if (accountContext.bitmapCurrencyId == 0) {
            // Portfolio updates only happen if the account has liquidity tokens, which can only be the
            // case in a non-bitmapped portfolio.
            accountContext.storeAssetsAndUpdateContext(
                liquidateAccount,
                portfolio,
                true // is liquidation
            );

            for (uint256 i; i < markets.length; i++) {
                // Will short circuit if market does not need to be set
                markets[i].setMarketStorage();
            }
        }
        accountContext.setAccountContext(liquidateAccount);

        collateralBalanceState.netAssetTransferInternalPrecision = tmpAssetTransferAmount;
    }
}
