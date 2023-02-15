// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../FreeCollateralExternal.sol";
import "../SettleAssetsExternal.sol";
import "../../internal/markets/Market.sol";
import "../../internal/markets/CashGroup.sol";
import "../../internal/markets/AssetRate.sol";
import "../../internal/balances/BalanceHandler.sol";
import "../../internal/portfolio/PortfolioHandler.sol";
import "../../internal/portfolio/TransferAssets.sol";
import "../../math/SafeInt256.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library TradingAction {
    using PortfolioHandler for PortfolioState;
    using AccountContextHandler for AccountContext;
    using Market for MarketParameters;
    using CashGroup for CashGroupParameters;
    using AssetRate for AssetRateParameters;
    using SafeInt256 for int256;
    using SafeMath for uint256;

    event LendBorrowTrade(
        address account,
        uint16 currencyId,
        uint40 maturity,
        int256 netAssetCash,
        int256 netfCash,
        int256 netFee
    );
    event AddRemoveLiquidity(
        address account,
        uint16 currencyId,
        uint40 maturity,
        int256 netAssetCash,
        int256 netfCash,
        int256 netLiquidityTokens
    );

    event SettledCashDebt(
        address settledAccount,
        uint16 currencyId,
        int256 amountToSettleAsset,
        int256 fCashAmount
    );

    event nTokenResidualPurchase(
        uint16 currencyId,
        uint40 maturity,
        int256 fCashAmountToPurchase,
        int256 netAssetCashNToken
    );

    /// @dev Used internally to manage stack issues
    struct TradeContext {
        int256 cash;
        int256 fCashAmount;
        int256 fee;
        int256 netCash;
        int256 totalFee;
        uint256 blockTime;
    }

    /// @dev Executes trades for a bitmapped portfolio
    function executeTradesBitmapBatch(
        address account,
        AccountContext calldata accountContext,
        bytes32[] calldata trades
    ) external returns (int256, bool) {
        CashGroupParameters memory cashGroup =
            CashGroup.buildCashGroupStateful(accountContext.bitmapCurrencyId);
        MarketParameters memory market;
        bytes32 ifCashBitmap =
            BitmapAssetsHandler.getAssetsBitmap(account, accountContext.bitmapCurrencyId);
        bool didIncurDebt;
        TradeContext memory c;
        c.blockTime = block.timestamp;

        for (uint256 i; i < trades.length; i++) {
            uint256 maturity;
            (maturity, c.cash, c.fCashAmount, c.fee) = _executeTrade(
                account,
                cashGroup,
                market,
                trades[i],
                c.blockTime
            );

            (ifCashBitmap, c.fCashAmount) = BitmapAssetsHandler.addifCashAsset(
                account,
                accountContext.bitmapCurrencyId,
                maturity,
                accountContext.nextSettleTime,
                c.fCashAmount,
                ifCashBitmap
            );

            if (c.fCashAmount < 0) didIncurDebt = true;
            c.netCash = c.netCash.add(c.cash);
            c.totalFee = c.totalFee.add(c.fee);
        }

        BitmapAssetsHandler.setAssetsBitmap(account, accountContext.bitmapCurrencyId, ifCashBitmap);
        BalanceHandler.incrementFeeToReserve(accountContext.bitmapCurrencyId, c.totalFee);

        return (c.netCash, didIncurDebt);
    }

    /// @dev Executes trades for an array portfolio
    function executeTradesArrayBatch(
        address account,
        uint256 currencyId,
        PortfolioState memory portfolioState,
        bytes32[] calldata trades
    ) external returns (PortfolioState memory, int256) {
        CashGroupParameters memory cashGroup = CashGroup.buildCashGroupStateful(currencyId);
        MarketParameters memory market;
        TradeContext memory c;
        c.blockTime = block.timestamp;

        for (uint256 i; i < trades.length; i++) {
            TradeActionType tradeType = TradeActionType(uint256(uint8(bytes1(trades[i]))));

            if (
                tradeType == TradeActionType.AddLiquidity ||
                tradeType == TradeActionType.RemoveLiquidity
            ) {
                // Liquidity tokens can only be added by array portfolio
                c.cash = _executeLiquidityTrade(
                    account,
                    cashGroup,
                    market,
                    tradeType,
                    trades[i],
                    portfolioState,
                    c.netCash
                );
            } else {
                uint256 maturity;
                (maturity, c.cash, c.fCashAmount, c.fee) = _executeTrade(
                    account,
                    cashGroup,
                    market,
                    trades[i],
                    c.blockTime
                );
                // Stack issues here :(
                _addfCashAsset(portfolioState, currencyId, maturity, c.fCashAmount);
                c.totalFee = c.totalFee.add(c.fee);
            }

            c.netCash = c.netCash.add(c.cash);
        }

        BalanceHandler.incrementFeeToReserve(currencyId, c.totalFee);

        return (portfolioState, c.netCash);
    }

    /// @dev used to clear the stack
    function _addfCashAsset(
        PortfolioState memory portfolioState,
        uint256 currencyId,
        uint256 maturity,
        int256 notional
    ) private pure {
        portfolioState.addAsset(currencyId, maturity, Constants.FCASH_ASSET_TYPE, notional);
    }

    function _executeTrade(
        address account,
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        bytes32 trade,
        uint256 blockTime
    )
        private
        returns (
            uint256 maturity,
            int256 cashAmount,
            int256 fCashAmount,
            int256 fee
        )
    {
        TradeActionType tradeType = TradeActionType(uint256(uint8(bytes1(trade))));
        if (tradeType == TradeActionType.PurchaseNTokenResidual) {
            (maturity, cashAmount, fCashAmount) = _purchaseNTokenResidual(
                cashGroup,
                blockTime,
                trade
            );
        } else if (tradeType == TradeActionType.SettleCashDebt) {
            (maturity, cashAmount, fCashAmount) = _settleCashDebt(cashGroup, blockTime, trade);
        } else if (tradeType == TradeActionType.Lend || tradeType == TradeActionType.Borrow) {
            (cashAmount, fCashAmount, fee) = _executeLendBorrowTrade(
                cashGroup,
                market,
                tradeType,
                blockTime,
                trade
            );

            // This is a little ugly but required to deal with stack issues. We know the market is loaded with the proper
            // maturity inside _executeLendBorrowTrade
            maturity = market.maturity;
            emit LendBorrowTrade(
                account,
                uint16(cashGroup.currencyId),
                uint40(maturity),
                cashAmount,
                fCashAmount,
                fee
            );
        } else {
            revert("Invalid trade type");
        }
    }

    function _executeLiquidityTrade(
        address account,
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        TradeActionType tradeType,
        bytes32 trade,
        PortfolioState memory portfolioState,
        int256 netCash
    ) private returns (int256) {
        uint256 marketIndex = uint256(uint8(bytes1(trade << 8)));
        cashGroup.loadMarket(market, marketIndex, true, block.timestamp);

        int256 cashAmount;
        int256 fCashAmount;
        int256 tokens;
        if (tradeType == TradeActionType.AddLiquidity) {
            cashAmount = int256(uint88(bytes11(trade << 16)));
            // Setting cash amount to zero will deposit all net cash accumulated in this trade into
            // liquidity. This feature allows accounts to borrow in one maturity to provide liquidity
            // in another in a single transaction without dust. It also allows liquidity providers to
            // sell off the net cash residuals and use the cash amount in the new market without dust
            if (cashAmount == 0) {
                cashAmount = netCash;
                require(cashAmount > 0, "Invalid cash roll");
            }

            (tokens, fCashAmount) = market.addLiquidity(cashAmount);
            cashAmount = cashAmount.neg(); // Net cash is negative
        } else {
            tokens = int256(uint88(bytes11(trade << 16)));
            (cashAmount, fCashAmount) = market.removeLiquidity(tokens);
            tokens = tokens.neg();
        }

        {
            uint256 minImpliedRate = uint256(uint32(bytes4(trade << 104)));
            uint256 maxImpliedRate = uint256(uint32(bytes4(trade << 136)));
            require(market.lastImpliedRate >= minImpliedRate, "Trade failed, slippage");
            if (maxImpliedRate != 0)
                require(market.lastImpliedRate <= maxImpliedRate, "Trade failed, slippage");
            market.setMarketStorage();
        }

        // Add the assets in this order so they are sorted
        portfolioState.addAsset(
            cashGroup.currencyId,
            market.maturity,
            Constants.FCASH_ASSET_TYPE,
            fCashAmount
        );
        portfolioState.addAsset(
            cashGroup.currencyId,
            market.maturity,
            marketIndex + 1,
            tokens
        );

        emit AddRemoveLiquidity(
            account,
            uint16(cashGroup.currencyId),
            uint40(market.maturity),
            cashAmount,
            fCashAmount,
            tokens
        );

        return (cashAmount);
    }

    function _executeLendBorrowTrade(
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        TradeActionType tradeType,
        uint256 blockTime,
        bytes32 trade
    )
        private
        returns (
            int256,
            int256,
            int256
        )
    {
        uint256 marketIndex = uint256(uint8(bytes1(trade << 8)));
        cashGroup.loadMarket(market, marketIndex, false, blockTime);

        int256 fCashAmount = int256(uint88(bytes11(trade << 16)));
        if (tradeType == TradeActionType.Borrow) fCashAmount = fCashAmount.neg();

        (int256 cashAmount, int256 fee) =
            market.calculateTrade(
                cashGroup,
                fCashAmount,
                market.maturity.sub(blockTime),
                marketIndex
            );
        require(cashAmount != 0, "Trade failed, liquidity");

        uint256 rateLimit = uint256(uint32(bytes4(trade << 104)));
        if (rateLimit != 0) {
            if (tradeType == TradeActionType.Borrow) {
                require(market.lastImpliedRate <= rateLimit, "Trade failed, slippage");
            } else {
                require(market.lastImpliedRate >= rateLimit, "Trade failed, slippage");
            }
        }
        market.setMarketStorage();

        return (cashAmount, fCashAmount, fee);
    }

    /// @notice If an account has a negative cash balance we allow anyone to lend to to that account at a penalty
    /// rate to the 3 month market.
    function _settleCashDebt(
        CashGroupParameters memory cashGroup,
        uint256 blockTime,
        bytes32 trade
    )
        internal
        returns (
            uint256,
            int256,
            int256
        )
    {
        address counterparty = address(bytes20(trade << 8));
        int256 amountToSettleAsset = int256(int88(bytes11(trade << 168)));

        AccountContext memory counterpartyContext =
            AccountContextHandler.getAccountContext(counterparty);

        if (counterpartyContext.mustSettleAssets()) {
            counterpartyContext = SettleAssetsExternal.settleAssetsAndFinalize(counterparty, counterpartyContext);
        }

        // This will check if the amountToSettleAsset is valid and revert if it is not. Amount to settle is a positive
        // number denominated in asset terms. If amountToSettleAsset is set equal to zero on the input, will return the
        // max amount to settle.
        amountToSettleAsset = BalanceHandler.setBalanceStorageForSettleCashDebt(
            counterparty,
            cashGroup,
            amountToSettleAsset,
            counterpartyContext
        );

        // Settled account must borrow from the 3 month market at a penalty rate. Even if the market is
        // not initialized we can still settle cash debts because we reference the previous 3 month market's oracle
        // rate which is where the new 3 month market's oracle rate will be initialized to.
        uint256 threeMonthMaturity = DateTime.getReferenceTime(blockTime) + Constants.QUARTER;
        int256 fCashAmount =
            _getfCashSettleAmount(cashGroup, threeMonthMaturity, blockTime, amountToSettleAsset);

        // It's possible that this action will put an account into negative free collateral. In this case they
        // will immediately become eligible for liquidation and the account settling the debt can also liquidate
        // them in the same transaction. Do not run a free collateral check here to allow this to happen.
        {
            PortfolioAsset[] memory assets = new PortfolioAsset[](1);
            assets[0].currencyId = cashGroup.currencyId;
            assets[0].maturity = threeMonthMaturity;
            assets[0].notional = fCashAmount.neg(); // This is the debt the settled account will incur
            assets[0].assetType = Constants.FCASH_ASSET_TYPE;
            counterpartyContext = TransferAssets.placeAssetsInAccount(
                counterparty,
                counterpartyContext,
                assets
            );
        }
        counterpartyContext.setAccountContext(counterparty);

        emit SettledCashDebt(
            counterparty,
            uint16(cashGroup.currencyId),
            amountToSettleAsset,
            fCashAmount.neg()
        );

        return (threeMonthMaturity, amountToSettleAsset.neg(), fCashAmount);
    }

    /// @dev Helper method to calculate the fCashAmount from the penalty settlement rate
    function _getfCashSettleAmount(
        CashGroupParameters memory cashGroup,
        uint256 threeMonthMaturity,
        uint256 blockTime,
        int256 amountToSettleAsset
    ) private view returns (int256) {
        uint256 oracleRate = cashGroup.calculateOracleRate(threeMonthMaturity, blockTime);

        int256 exchangeRate =
            Market.getExchangeRateFromImpliedRate(
                oracleRate.add(cashGroup.getSettlementPenalty()),
                threeMonthMaturity.sub(blockTime)
            );

        // Amount to settle is positive, this returns the fCashAmount that the settler will
        // receive as a positive number
        return
            cashGroup.assetRate.convertToUnderlying(amountToSettleAsset).mul(exchangeRate).div(
                Constants.RATE_PRECISION
            );
    }

    /// @dev Enables purchasing of NToken residuals
    function _purchaseNTokenResidual(
        CashGroupParameters memory cashGroup,
        uint256 blockTime,
        bytes32 trade
    )
        internal
        returns (
            uint256,
            int256,
            int256
        )
    {
        uint256 maturity = uint256(uint32(bytes4(trade << 8)));
        int256 fCashAmountToPurchase = int256(int88(bytes11(trade << 40)));
        require(maturity > blockTime, "Invalid maturity");
        // Require that the residual to purchase does not fall on an existing maturity (i.e.
        // it is an idiosyncratic maturity)
        require(
            !DateTime.isValidMarketMaturity(cashGroup.maxMarketIndex, maturity, blockTime),
            "Invalid maturity"
        );

        address nTokenAddress = nTokenHandler.nTokenAddress(cashGroup.currencyId);
        // prettier-ignore
        (
            /* currencyId */,
            /* incentiveRate */,
            uint256 lastInitializedTime,
            bytes6 parameters
        ) = nTokenHandler.getNTokenContext(nTokenAddress);

        // Restrict purchasing until some amount of time after the last initialized time to ensure that arbitrage
        // opportunities are not available (by generating residuals and then immediately purchasing them at a discount)
        require(
            blockTime >
                lastInitializedTime.add(
                    uint256(uint8(parameters[Constants.RESIDUAL_PURCHASE_TIME_BUFFER])) * 3600
                ),
            "Insufficient block time"
        );

        int256 notional =
            BitmapAssetsHandler.getifCashNotional(nTokenAddress, cashGroup.currencyId, maturity);
        // Check if amounts are valid and set them to the max available if necessary
        if (notional < 0 && fCashAmountToPurchase < 0) {
            if (fCashAmountToPurchase < notional) fCashAmountToPurchase = notional;
        } else if (notional > 0 && fCashAmountToPurchase > 0) {
            if (fCashAmountToPurchase > notional) fCashAmountToPurchase = notional;
        } else {
            revert("Invalid amount");
        }

        int256 netAssetCashNToken =
            _getResidualPriceAssetCash(
                cashGroup,
                maturity,
                blockTime,
                fCashAmountToPurchase,
                parameters
            );

        _updateNTokenPortfolio(
            nTokenAddress,
            cashGroup.currencyId,
            maturity,
            lastInitializedTime,
            fCashAmountToPurchase,
            netAssetCashNToken
        );

        emit nTokenResidualPurchase(
            uint16(cashGroup.currencyId),
            uint40(maturity),
            fCashAmountToPurchase,
            netAssetCashNToken
        );

        return (maturity, netAssetCashNToken.neg(), fCashAmountToPurchase);
    }

    function _getResidualPriceAssetCash(
        CashGroupParameters memory cashGroup,
        uint256 maturity,
        uint256 blockTime,
        int256 fCashAmount,
        bytes6 parameters
    ) internal view returns (int256) {
        uint256 oracleRate = cashGroup.calculateOracleRate(maturity, blockTime);
        uint256 purchaseIncentive =
            uint256(uint8(parameters[Constants.RESIDUAL_PURCHASE_INCENTIVE])) *
                10 *
                Constants.BASIS_POINT;

        if (fCashAmount > 0) {
            oracleRate = oracleRate.add(purchaseIncentive);
        } else if (oracleRate > purchaseIncentive) {
            oracleRate = oracleRate.sub(purchaseIncentive);
        } else {
            // If the oracle rate is less than the purchase incentive floor the interest rate at zero
            oracleRate = 0;
        }

        int256 exchangeRate =
            Market.getExchangeRateFromImpliedRate(oracleRate, maturity.sub(blockTime));

        // Returns the net asset cash from the nToken perspective, which is the same sign as the fCash amount
        return
            cashGroup.assetRate.convertFromUnderlying(fCashAmount.divInRatePrecision(exchangeRate));
    }

    function _updateNTokenPortfolio(
        address nTokenAddress,
        uint256 currencyId,
        uint256 maturity,
        uint256 lastInitializedTime,
        int256 fCashAmountToPurchase,
        int256 netAssetCashNToken
    ) private {
        bytes32 ifCashBitmap = BitmapAssetsHandler.getAssetsBitmap(nTokenAddress, currencyId);
        // prettier-ignore
        (
            ifCashBitmap,
            /* notional */
        ) = BitmapAssetsHandler.addifCashAsset(
            nTokenAddress,
            currencyId,
            maturity,
            lastInitializedTime,
            fCashAmountToPurchase.neg(),
            ifCashBitmap
        );
        BitmapAssetsHandler.setAssetsBitmap(nTokenAddress, currencyId, ifCashBitmap);

        // prettier-ignore
        (
            int256 nTokenCashBalance,
            /* storedNTokenBalance */,
            /* lastClaimTime */,
            /* lastClaimIntegralSupply */
        ) = BalanceHandler.getBalanceStorage(nTokenAddress, currencyId);
        nTokenCashBalance = nTokenCashBalance.add(netAssetCashNToken);

        // This will ensure that the cash balance is not negative
        BalanceHandler.setBalanceStorageForNToken(nTokenAddress, currencyId, nTokenCashBalance);
    }
}
