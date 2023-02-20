// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../../global/Types.sol";
import "../../global/Constants.sol";
import "../markets/CashGroup.sol";
import "../markets/AssetRate.sol";
import "../portfolio/PortfolioHandler.sol";
import "../../math/SafeInt256.sol";
import "../../math/ABDKMath64x64.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library AssetHandler {
    using SafeMath for uint256;
    using SafeInt256 for int256;
    using CashGroup for CashGroupParameters;
    using AssetRate for AssetRateParameters;

    function isLiquidityToken(uint256 assetType) internal pure returns (bool) {
        return
            assetType >= Constants.MIN_LIQUIDITY_TOKEN_INDEX &&
            assetType <= Constants.MAX_LIQUIDITY_TOKEN_INDEX;
    }

    /// @notice Liquidity tokens settle every 90 days (not at the designated maturity). This method
    /// calculates the settlement date for any PortfolioAsset.
    function getSettlementDate(PortfolioAsset memory asset) internal pure returns (uint256) {
        require(asset.assetType > 0 && asset.assetType <= Constants.MAX_LIQUIDITY_TOKEN_INDEX); // dev: settlement date invalid asset type
        // 3 month tokens and fCash tokens settle at maturity
        if (asset.assetType <= Constants.MIN_LIQUIDITY_TOKEN_INDEX) return asset.maturity;

        uint256 marketLength = DateTime.getTradedMarket(asset.assetType - 1);
        // Liquidity tokens settle at tRef + 90 days. The formula to get a maturity is:
        // maturity = tRef + marketLength
        // Here we calculate:
        // tRef = maturity - marketLength + 90 days
        return asset.maturity.sub(marketLength).add(Constants.QUARTER);
    }

    /// @notice Returns the continuously compounded discount rate given an oracle rate and a time to maturity.
    /// The formula is: notional * e^(-rate * timeToMaturity).
    function getDiscountFactor(uint256 timeToMaturity, uint256 oracleRate)
        internal
        pure
        returns (int256)
    {
        int128 expValue =
            ABDKMath64x64.fromUInt(oracleRate.mul(timeToMaturity).div(Constants.IMPLIED_RATE_TIME));
        expValue = ABDKMath64x64.div(expValue, Constants.RATE_PRECISION_64x64);
        expValue = ABDKMath64x64.exp(expValue * -1);
        expValue = ABDKMath64x64.mul(expValue, Constants.RATE_PRECISION_64x64);
        int256 discountFactor = ABDKMath64x64.toInt(expValue);

        return discountFactor;
    }

    /// @notice Present value of an fCash asset without any risk adjustments.
    function getPresentValue(
        int256 notional,
        uint256 maturity,
        uint256 blockTime,
        uint256 oracleRate
    ) internal pure returns (int256) {
        if (notional == 0) return 0;

        uint256 timeToMaturity = maturity.sub(blockTime);
        int256 discountFactor = getDiscountFactor(timeToMaturity, oracleRate);

        require(discountFactor <= Constants.RATE_PRECISION); // dev: get present value invalid discount factor
        return notional.mulInRatePrecision(discountFactor);
    }

    /// @notice Present value of an fCash asset with risk adjustments. Positive fCash value will be discounted more
    /// heavily than the oracle rate given and vice versa for negative fCash.
    function getRiskAdjustedPresentValue(
        CashGroupParameters memory cashGroup,
        int256 notional,
        uint256 maturity,
        uint256 blockTime,
        uint256 oracleRate
    ) internal pure returns (int256) {
        if (notional == 0) return 0;
        uint256 timeToMaturity = maturity.sub(blockTime);

        int256 discountFactor;
        if (notional > 0) {
            discountFactor = getDiscountFactor(
                timeToMaturity,
                oracleRate.add(cashGroup.getfCashHaircut())
            );
        } else {
            uint256 debtBuffer = cashGroup.getDebtBuffer();
            // If the adjustment exceeds the oracle rate we floor the value of the fCash
            // at the notional value. We don't want to require the account to hold more than
            // absolutely required.
            if (debtBuffer >= oracleRate) return notional;

            discountFactor = getDiscountFactor(timeToMaturity, oracleRate - debtBuffer);
        }

        require(discountFactor <= Constants.RATE_PRECISION); // dev: get risk adjusted pv, invalid discount factor
        return notional.mulInRatePrecision(discountFactor);
    }

    /// @notice Returns the non haircut claims on cash and fCash by the liquidity token.
    function getCashClaims(PortfolioAsset memory token, MarketParameters memory market)
        internal
        pure
        returns (int256 assetCash, int256 fCash)
    {
        require(isLiquidityToken(token.assetType) && token.notional >= 0); // dev: invalid asset, get cash claims

        assetCash = market.totalAssetCash.mul(token.notional).div(market.totalLiquidity);
        fCash = market.totalfCash.mul(token.notional).div(market.totalLiquidity);
    }

    /// @notice Returns the haircut claims on cash and fCash
    /// @return (assetCash, fCash)
    function getHaircutCashClaims(
        PortfolioAsset memory token,
        MarketParameters memory market,
        CashGroupParameters memory cashGroup
    ) internal pure returns (int256, int256) {
        require(isLiquidityToken(token.assetType) && token.notional >= 0); // dev: invalid asset get haircut cash claims

        require(token.currencyId == cashGroup.currencyId); // dev: haircut cash claims, currency id mismatch
        // This won't overflow, the liquidity token haircut is stored as an uint8
        int256 haircut = int256(cashGroup.getLiquidityHaircut(token.assetType));

        int256 assetCash =
            _calcToken(market.totalAssetCash, token.notional, haircut, market.totalLiquidity);

        int256 fCash =
            _calcToken(market.totalfCash, token.notional, haircut, market.totalLiquidity);

        return (assetCash, fCash);
    }

    /// @dev This is here to clean up the stack in getHaircutCashClaims
    function _calcToken(
        int256 numerator,
        int256 tokens,
        int256 haircut,
        int256 liquidity
    ) private pure returns (int256) {
        return numerator.mul(tokens).mul(haircut).div(Constants.PERCENTAGE_DECIMALS).div(liquidity);
    }

    /// @notice Returns the asset cash claim and the present value of the fCash asset (if it exists)
    function getLiquidityTokenValue(
        uint256 index,
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        PortfolioAsset[] memory assets,
        uint256 blockTime,
        bool riskAdjusted
    ) internal view returns (int256, int256) {
        PortfolioAsset memory liquidityToken = assets[index];
        require(isLiquidityToken(liquidityToken.assetType) && liquidityToken.notional >= 0); // dev: get liquidity token value, not liquidity token

        {
            (uint256 marketIndex, bool idiosyncratic) =
                DateTime.getMarketIndex(
                    cashGroup.maxMarketIndex,
                    liquidityToken.maturity,
                    blockTime
                );
            // Liquidity tokens can never be idiosyncratic
            require(!idiosyncratic); // dev: idiosyncratic liquidity token

            // This market will always be initialized, if a liquidity token exists that means the market has some liquidity in it.
            cashGroup.loadMarket(market, marketIndex, true, blockTime);
        }

        int256 assetCashClaim;
        int256 fCashClaim;
        if (riskAdjusted) {
            (assetCashClaim, fCashClaim) = getHaircutCashClaims(liquidityToken, market, cashGroup);
        } else {
            (assetCashClaim, fCashClaim) = getCashClaims(liquidityToken, market);
        }

        // Find the matching fCash asset and net off the value, assumes that the portfolio is sorted and
        // in that case we know the previous asset will be the matching fCash asset
        if (
            index > 0 &&
            assets[index - 1].currencyId == liquidityToken.currencyId &&
            assets[index - 1].maturity == liquidityToken.maturity &&
            assets[index - 1].assetType == Constants.FCASH_ASSET_TYPE
        ) {
            // Net off the fCashClaim here and we will discount it to present value in the second pass.
            // WARNING: this modifies the portfolio in memory and therefore we cannot store this portfolio!
            assets[index - 1].notional = assets[index - 1].notional.add(fCashClaim);
            return (assetCashClaim, 0);
        }

        // If not matching fCash asset found then get the pv directly
        if (riskAdjusted) {
            int256 pv =
                getRiskAdjustedPresentValue(
                    cashGroup,
                    fCashClaim,
                    liquidityToken.maturity,
                    blockTime,
                    market.oracleRate
                );

            return (assetCashClaim, pv);
        } else {
            int256 pv =
                getPresentValue(fCashClaim, liquidityToken.maturity, blockTime, market.oracleRate);

            return (assetCashClaim, pv);
        }
    }

    /// @notice Returns the asset cash claim and the present value of the fCash asset (if it exists)
    function getNetCashGroupValue(
        PortfolioAsset[] memory assets,
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        uint256 blockTime,
        uint256 portfolioIndex
    ) internal view returns (int256, uint256) {
        int256 presentValueAsset;
        int256 presentValueUnderlying;

        // First calculate value of liquidity tokens because we need to net off fCash value
        // before discounting to present value
        for (uint256 i = portfolioIndex; i < assets.length; i++) {
            if (!isLiquidityToken(assets[i].assetType)) continue;
            if (assets[i].currencyId != cashGroup.currencyId) break;

            (int256 assetCashClaim, int256 pv) =
                getLiquidityTokenValue(
                    i,
                    cashGroup,
                    market,
                    assets,
                    blockTime,
                    true // risk adjusted
                );

            presentValueAsset = presentValueAsset.add(assetCashClaim);
            presentValueUnderlying = presentValueUnderlying.add(pv);
        }

        uint256 j = portfolioIndex;
        for (; j < assets.length; j++) {
            if (assets[j].assetType != Constants.FCASH_ASSET_TYPE) continue;
            // If we hit a different currency id then we've accounted for all assets in this currency
            if (assets[j].currencyId != cashGroup.currencyId) break;

            uint256 maturity = assets[j].maturity;
            uint256 oracleRate = cashGroup.calculateOracleRate(maturity, blockTime);

            int256 pv =
                getRiskAdjustedPresentValue(
                    cashGroup,
                    assets[j].notional,
                    maturity,
                    blockTime,
                    oracleRate
                );
            presentValueUnderlying = presentValueUnderlying.add(pv);
        }

        presentValueAsset = presentValueAsset.add(
            cashGroup.assetRate.convertFromUnderlying(presentValueUnderlying)
        );

        return (presentValueAsset, j);
    }
}
