// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../../global/Constants.sol";
import "../../internal/nTokenHandler.sol";
import "../../internal/markets/Market.sol";
import "../../internal/markets/CashGroup.sol";
import "../../internal/markets/AssetRate.sol";
import "../../internal/balances/BalanceHandler.sol";
import "../../internal/portfolio/PortfolioHandler.sol";
import "../../math/SafeInt256.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library nTokenMintAction {
    using SafeInt256 for int256;
    using BalanceHandler for BalanceState;
    using CashGroup for CashGroupParameters;
    using Market for MarketParameters;
    using nTokenHandler for nTokenPortfolio;
    using PortfolioHandler for PortfolioState;
    using AssetRate for AssetRateParameters;
    using SafeMath for uint256;

    /// @notice Converts the given amount of cash to nTokens in the same currency.
    /// @param currencyId the currency associated the nToken
    /// @param amountToDepositInternal the amount of asset tokens to deposit denominated in internal decimals
    /// @return nTokens minted by this action
    function nTokenMint(uint256 currencyId, int256 amountToDepositInternal)
        external
        returns (int256)
    {
        uint256 blockTime = block.timestamp;
        nTokenPortfolio memory nToken;
        nTokenHandler.loadNTokenPortfolioStateful(currencyId, nToken);

        (int256 tokensToMint, bytes32 ifCashBitmap) =
            calculateTokensToMint(nToken, amountToDepositInternal, blockTime);

        if (nToken.portfolioState.storedAssets.length == 0) {
            // If the token does not have any assets, then the markets must be initialized first.
            nToken.cashBalance = nToken.cashBalance.add(amountToDepositInternal);
            BalanceHandler.setBalanceStorageForNToken(
                nToken.tokenAddress,
                currencyId,
                nToken.cashBalance
            );
        } else {
            _depositIntoPortfolio(nToken, ifCashBitmap, amountToDepositInternal, blockTime);
        }

        require(tokensToMint >= 0, "Invalid token amount");

        // NOTE: token supply does not change here, it will change after incentives have been claimed
        // during BalanceHandler.finalize
        return tokensToMint;
    }

    /// @notice Calculates the tokens to mint to the account as a ratio of the nToken
    /// present value denominated in asset cash terms.
    function calculateTokensToMint(
        nTokenPortfolio memory nToken,
        int256 amountToDepositInternal,
        uint256 blockTime
    ) internal view returns (int256, bytes32) {
        require(amountToDepositInternal >= 0); // dev: deposit amount negative
        if (amountToDepositInternal == 0) return (0, 0x0);

        if (nToken.lastInitializedTime != 0) {
            // For the sake of simplicity, nTokens cannot be minted if they have assets
            // that need to be settled. This is only done during market initialization.
            uint256 nextSettleTime = nToken.getNextSettleTime();
            require(nextSettleTime > blockTime, "PT: requires settlement");
        }

        (int256 assetCashPV, bytes32 ifCashBitmap) = nToken.getNTokenAssetPV(blockTime);
        require(assetCashPV >= 0, "PT: pv value negative");

        // Allow for the first deposit
        if (nToken.totalSupply == 0) {
            return (amountToDepositInternal, ifCashBitmap);
        }

        return (amountToDepositInternal.mul(nToken.totalSupply).div(assetCashPV), ifCashBitmap);
    }

    /// @notice Portions out assetCashDeposit into amounts to deposit into individual markets. When
    /// entering this method we know that assetCashDeposit is positive and the nToken has been
    /// initialized to have liquidity tokens.
    function _depositIntoPortfolio(
        nTokenPortfolio memory nToken,
        bytes32 ifCashBitmap,
        int256 assetCashDeposit,
        uint256 blockTime
    ) private {
        (int256[] memory depositShares, int256[] memory leverageThresholds) =
            nTokenHandler.getDepositParameters(
                nToken.cashGroup.currencyId,
                nToken.cashGroup.maxMarketIndex
            );

        // Loop backwards from the last market to the first market, the reasoning is a little complicated:
        // If we have to deleverage the markets (i.e. lend instead of provide liquidity) it's quite gas inefficient
        // to calculate the cash amount to lend. We do know that longer term maturities will have more
        // slippage and therefore the residual from the perMarketDeposit will be lower as the maturities get
        // closer to the current block time. Any residual cash from lending will be rolled into shorter
        // markets as this loop progresses.
        int256 residualCash;
        MarketParameters memory market;
        for (uint256 marketIndex = nToken.cashGroup.maxMarketIndex; marketIndex > 0; marketIndex--) {
            int256 fCashAmount;
            nToken.cashGroup.loadMarket(
                market,
                marketIndex,
                true, // Needs liquidity to true
                blockTime
            );
            // If market has not been initialized, continue. This can occur when cash groups extend maxMarketIndex
            // before initializing
            if (market.totalLiquidity == 0) continue;

            // We know from the call into this method that assetCashDeposit is positive
            int256 perMarketDeposit =
                assetCashDeposit.mul(depositShares[marketIndex - 1]).div(Constants.DEPOSIT_PERCENT_BASIS).add(
                    residualCash
                );

            (fCashAmount, residualCash) = _lendOrAddLiquidity(
                nToken,
                market,
                perMarketDeposit,
                leverageThresholds[marketIndex - 1],
                marketIndex,
                blockTime
            );

            if (fCashAmount != 0) {
                // prettier-ignore
                (
                    ifCashBitmap,
                    /* notional */
                ) = BitmapAssetsHandler.addifCashAsset(
                    nToken.tokenAddress,
                    nToken.cashGroup.currencyId,
                    market.maturity,
                    nToken.lastInitializedTime,
                    fCashAmount,
                    ifCashBitmap
                );
            }

            market.setMarketStorage();
        }

        BitmapAssetsHandler.setAssetsBitmap(
            nToken.tokenAddress,
            nToken.cashGroup.currencyId,
            ifCashBitmap
        );
        nToken.portfolioState.storeAssets(nToken.tokenAddress);

        // This will occur if the three month market is over levered and we cannot lend into it
        if (residualCash != 0) {
            // Any remaining residual cash will be put into the nToken balance and added as liquidity on the
            // next market initialization
            nToken.cashBalance = nToken.cashBalance.add(residualCash);
            BalanceHandler.setBalanceStorageForNToken(
                nToken.tokenAddress,
                nToken.cashGroup.currencyId,
                nToken.cashBalance
            );
        }
    }

    /// @notice For a given amount of cash to deposit, decides how much to lend or provide
    /// given the market conditions.
    function _lendOrAddLiquidity(
        nTokenPortfolio memory nToken,
        MarketParameters memory market,
        int256 perMarketDeposit,
        int256 leverageThreshold,
        uint256 marketIndex,
        uint256 blockTime
    ) private returns (int256, int256) {
        int256 fCashAmount;
        bool marketOverLeveraged =
            _isMarketOverLeveraged(nToken.cashGroup, market, leverageThreshold);

        if (marketOverLeveraged) {
            (perMarketDeposit, fCashAmount) = _deleverageMarket(
                nToken.cashGroup,
                market,
                perMarketDeposit,
                blockTime,
                marketIndex
            );

            // Recalculate this after lending into the market
            marketOverLeveraged = _isMarketOverLeveraged(
                nToken.cashGroup,
                market,
                leverageThreshold
            );
        }

        if (!marketOverLeveraged) {
            // (marketIndex - 1) is the index of the nToken portfolio array where the asset
            // is stored
            fCashAmount = fCashAmount.add(
                _addLiquidityToMarket(nToken, market, marketIndex - 1, perMarketDeposit)
            );
            // No residual cash if we're adding liquidity
            return (fCashAmount, 0);
        }

        return (fCashAmount, perMarketDeposit);
    }

    /// @notice Markets are over levered when their proportion is greater than a governance set
    /// threshold. At this point, providing liquidity will incur too much negative fCash on the nToken
    /// account for the given amount of cash deposited, putting the nToken account at risk of liquidation.
    /// If the market is over leveraged, we call `deleverageMarket` to lend to the market instead.
    function _isMarketOverLeveraged(
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        int256 leverageThreshold
    ) private pure returns (bool) {
        int256 totalCashUnderlying = cashGroup.assetRate.convertToUnderlying(market.totalAssetCash);
        int256 proportion =
            market.totalfCash.divInRatePrecision(market.totalfCash.add(totalCashUnderlying));

        // If proportion is over the threshold, the market is over leveraged
        return proportion > leverageThreshold;
    }

    function _addLiquidityToMarket(
        nTokenPortfolio memory nToken,
        MarketParameters memory market,
        uint256 index,
        int256 perMarketDeposit
    ) private pure returns (int256) {
        // Add liquidity to the market
        PortfolioAsset memory asset = nToken.portfolioState.storedAssets[index];
        // We expect that all the liquidity tokens are in the portfolio in order.
        require(
            asset.maturity == market.maturity &&
                // Ensures that the asset type references the proper liquidity token
                asset.assetType == index + Constants.MIN_LIQUIDITY_TOKEN_INDEX,
            "PT: invalid liquidity token"
        );

        // This will update the market state as well, fCashAmount returned here is negative
        (int256 liquidityTokens, int256 fCashAmount) = market.addLiquidity(perMarketDeposit);
        asset.notional = asset.notional.add(liquidityTokens);
        asset.storageState = AssetStorageState.Update;

        return fCashAmount;
    }

    /// @notice Lends into the market to reduce the leverage that the nToken will add liquidity at. May fail due
    /// to slippage or result in some amount of residual cash.
    function _deleverageMarket(
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        int256 perMarketDeposit,
        uint256 blockTime,
        uint256 marketIndex
    ) private returns (int256, int256) {
        uint256 timeToMaturity = market.maturity.sub(blockTime);

        // Shift the last implied rate by some buffer and calculate the exchange rate to fCash. Hope that this
        // is sufficient to cover all potential slippage. We don't use the `getfCashGivenCashAmount` method here
        // because it is very gas inefficient.
        int256 assumedExchangeRate;
        if (market.lastImpliedRate < Constants.DELEVERAGE_BUFFER) {
            assumedExchangeRate = Constants.RATE_PRECISION;
        } else {
            assumedExchangeRate = Market.getExchangeRateFromImpliedRate(
                market.lastImpliedRate.sub(Constants.DELEVERAGE_BUFFER),
                timeToMaturity
            );
        }

        int256 fCashAmount;
        {
            int256 perMarketDepositUnderlying =
                cashGroup.assetRate.convertToUnderlying(perMarketDeposit);
            fCashAmount = perMarketDepositUnderlying.mulInRatePrecision(assumedExchangeRate);
        }
        (int256 netAssetCash, int256 fee) =
            market.calculateTrade(cashGroup, fCashAmount, timeToMaturity, marketIndex);
        BalanceHandler.incrementFeeToReserve(cashGroup.currencyId, fee);

        // This means that the trade failed
        if (netAssetCash == 0) return (perMarketDeposit, 0);

        // Ensure that net the per market deposit figure does not drop below zero, this should not be possible
        // given how we've calculated the exchange rate but extra caution here
        int256 residual = perMarketDeposit.add(netAssetCash);
        require(residual >= 0); // dev: insufficient cash
        return (residual, fCashAmount);
    }
}
