// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../external/FreeCollateralExternal.sol";
import "./actions/nTokenMintAction.sol";
import "../internal/valuation/ExchangeRate.sol";
import "../internal/markets/CashGroup.sol";
import "../internal/markets/AssetRate.sol";
import "../internal/nTokenHandler.sol";
import "../internal/balances/TokenHandler.sol";
import "../global/StorageLayoutV1.sol";
import "../math/SafeInt256.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "interfaces/notional/NotionalViews.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Views is StorageLayoutV1, NotionalViews {
    using CashGroup for CashGroupParameters;
    using TokenHandler for Token;
    using Market for MarketParameters;
    using AssetRate for AssetRateParameters;
    using SafeInt256 for int256;
    using SafeMath for uint256;
    using BalanceHandler for BalanceState;

    /** Governance Parameter Getters **/

    /// @notice Returns the current maximum currency id
    function getMaxCurrencyId() external view override returns (uint16) {
        return maxCurrencyId;
    }

    /// @notice Returns a currency id, a zero means that it is not listed.
    function getCurrencyId(address tokenAddress)
        external
        view
        override
        returns (uint16 currencyId)
    {
        currencyId = tokenAddressToCurrencyId[tokenAddress];
    }

    /// @notice Returns the asset token and underlying token related to a given currency id. If underlying
    /// token is not set then will return the zero address
    function getCurrency(uint16 currencyId)
        external
        view
        override
        returns (Token memory assetToken, Token memory underlyingToken)
    {
        assetToken = TokenHandler.getToken(currencyId, false);
        underlyingToken = TokenHandler.getToken(currencyId, true);
    }

    /// @notice Returns the ETH and Asset rates for a currency as stored, useful for viewing how they are configured
    function getRateStorage(uint16 currencyId)
        external
        view
        override
        returns (ETHRateStorage memory ethRate, AssetRateStorage memory assetRate)
    {
        ethRate = underlyingToETHRateMapping[currencyId];
        assetRate = assetToUnderlyingRateMapping[currencyId];
    }

    /// @notice Returns a currency and its corresponding asset rate and ETH exchange rates. Note that this does not recalculate
    /// cToken interest rates, it only retrieves the latest stored rate.
    function getCurrencyAndRates(uint16 currencyId)
        external
        view
        override
        returns (
            Token memory assetToken,
            Token memory underlyingToken,
            ETHRate memory ethRate,
            AssetRateParameters memory assetRate
        )
    {
        assetToken = TokenHandler.getToken(currencyId, false);
        underlyingToken = TokenHandler.getToken(currencyId, false);
        ethRate = ExchangeRate.buildExchangeRate(currencyId);
        assetRate = AssetRate.buildAssetRateView(currencyId);
    }

    /// @notice Returns cash group settings for a currency
    function getCashGroup(uint16 currencyId)
        external
        view
        override
        returns (CashGroupSettings memory)
    {
        return CashGroup.deserializeCashGroupStorage(currencyId);
    }

    /// @notice Returns the cash group along with the asset rate for convenience.
    function getCashGroupAndAssetRate(uint16 currencyId)
        external
        view
        override
        returns (CashGroupSettings memory cashGroup, AssetRateParameters memory assetRate)
    {
        cashGroup = CashGroup.deserializeCashGroupStorage(currencyId);
        assetRate = AssetRate.buildAssetRateView(currencyId);
    }

    /// @notice Returns market initialization parameters for a given currency
    function getInitializationParameters(uint16 currencyId)
        external
        view
        override
        returns (int256[] memory annualizedAnchorRates, int256[] memory proportions)
    {
        uint256 maxMarketIndex = CashGroup.getMaxMarketIndex(currencyId);
        (annualizedAnchorRates, proportions) = nTokenHandler.getInitializationParameters(
            currencyId,
            maxMarketIndex
        );
    }

    /// @notice Returns nToken deposit parameters for a given currency
    function getDepositParameters(uint16 currencyId)
        external
        view
        override
        returns (int256[] memory depositShares, int256[] memory leverageThresholds)
    {
        uint256 maxMarketIndex = CashGroup.getMaxMarketIndex(currencyId);
        (depositShares, leverageThresholds) = nTokenHandler.getDepositParameters(
            currencyId,
            maxMarketIndex
        );
    }

    /// @notice Returns nToken address for a given currency
    function nTokenAddress(uint16 currencyId) external view override returns (address) {
        return nTokenHandler.nTokenAddress(currencyId);
    }

    /// @notice Returns address of contract owner
    function getOwner() external view override returns (address) {
        return owner;
    }

    /** Global System State View Methods **/

    /// @notice Returns the asset settlement rate for a given maturity
    function getSettlementRate(uint16 currencyId, uint40 maturity)
        external
        view
        override
        returns (AssetRateParameters memory)
    {
        return AssetRate.buildSettlementRateView(currencyId, maturity);
    }

    /// @notice Returns all currently active markets for a currency
    function getActiveMarkets(uint16 currencyId)
        external
        view
        override
        returns (MarketParameters[] memory)
    {
        uint256 blockTime = block.timestamp;
        return _getActiveMarketsAtBlockTime(currencyId, blockTime);
    }

    /// @notice Returns all active markets for a currency at the specified block time, useful for looking
    /// at historical markets
    function getActiveMarketsAtBlockTime(uint16 currencyId, uint32 blockTime)
        external
        view
        override
        returns (MarketParameters[] memory)
    {
        return _getActiveMarketsAtBlockTime(currencyId, blockTime);
    }

    function _getActiveMarketsAtBlockTime(uint256 currencyId, uint256 blockTime)
        internal
        view
        returns (MarketParameters[] memory)
    {
        CashGroupParameters memory cashGroup = CashGroup.buildCashGroupView(currencyId);
        MarketParameters[] memory markets = new MarketParameters[](cashGroup.maxMarketIndex);

        for (uint256 i = 0; i < cashGroup.maxMarketIndex; i++) {
            cashGroup.loadMarket(markets[i], i + 1, true, blockTime);
        }

        return markets;
    }

    /// @notice Returns the current reserve balance for a currency
    function getReserveBalance(uint16 currencyId)
        external
        view
        override
        returns (int256 reserveBalance)
    {
        // prettier-ignore
        (
            reserveBalance,
            /* */,
            /* */,
            /* */
        ) = BalanceHandler.getBalanceStorage(Constants.RESERVE, currencyId);
    }

    function getNTokenPortfolio(address tokenAddress)
        external
        view
        override
        returns (PortfolioAsset[] memory liquidityTokens, PortfolioAsset[] memory netfCashAssets)
    {
        // prettier-ignore
        (
            uint256 currencyId,
            /* incentiveRate */,
            uint256 lastInitializedTime,
            bytes6 parameters
        ) = nTokenHandler.getNTokenContext(tokenAddress);

        liquidityTokens = PortfolioHandler.getSortedPortfolio(
            tokenAddress,
            uint8(parameters[Constants.ASSET_ARRAY_LENGTH])
        );

        netfCashAssets = BitmapAssetsHandler.getifCashArray(
            tokenAddress,
            currencyId,
            lastInitializedTime
        );
    }

    function getNTokenAccount(address tokenAddress)
        external
        view
        override
        returns (
            uint256 currencyId,
            uint256 totalSupply,
            uint256 incentiveAnnualEmissionRate,
            uint256 lastInitializedTime,
            bytes6 nTokenParameters,
            int256 cashBalance,
            uint256 integralTotalSupply,
            uint256 lastSupplyChangeTime
        )
    {
        (
            currencyId,
            incentiveAnnualEmissionRate,
            lastInitializedTime,
            nTokenParameters
        ) = nTokenHandler.getNTokenContext(tokenAddress);

        // prettier-ignore
        (
            totalSupply,
            integralTotalSupply,
            lastSupplyChangeTime
        ) = nTokenHandler.getStoredNTokenSupplyFactors(tokenAddress);

        // prettier-ignore
        (
            cashBalance,
            /* */,
            /* */,
            /* */
        ) = BalanceHandler.getBalanceStorage(tokenAddress, currencyId);
    }

    /** Account Specific View Methods **/

    /// @notice Returns all account details in a single view
    function getAccount(address account)
        external
        view
        override
        returns (
            AccountContext memory accountContext,
            AccountBalance[] memory accountBalances,
            PortfolioAsset[] memory portfolio
        )
    {
        accountContext = AccountContextHandler.getAccountContext(account);
        accountBalances = new AccountBalance[](10);

        uint256 i;
        if (accountContext.bitmapCurrencyId != 0) {
            (
                accountBalances[i].cashBalance,
                accountBalances[i].nTokenBalance,
                accountBalances[i].lastClaimTime,
                accountBalances[i].lastClaimIntegralSupply
            ) = BalanceHandler.getBalanceStorage(account, accountContext.bitmapCurrencyId);
            i += 1;
        }

        bytes18 currencies = accountContext.activeCurrencies;
        while (currencies != 0) {
            accountBalances[i].currencyId = uint256(
                uint16(bytes2(currencies) & Constants.UNMASK_FLAGS)
            );
            if (accountBalances[i].currencyId == 0) break;

            (
                accountBalances[i].cashBalance,
                accountBalances[i].nTokenBalance,
                accountBalances[i].lastClaimTime,
                accountBalances[i].lastClaimIntegralSupply
            ) = BalanceHandler.getBalanceStorage(account, accountBalances[i].currencyId);
            i += 1;
            currencies = currencies << 16;
        }

        if (accountContext.bitmapCurrencyId != 0) {
            portfolio = BitmapAssetsHandler.getifCashArray(
                account,
                accountContext.bitmapCurrencyId,
                accountContext.nextSettleTime
            );
        } else {
            portfolio = PortfolioHandler.getSortedPortfolio(
                account,
                accountContext.assetArrayLength
            );
        }
    }

    /// @notice Returns account context
    function getAccountContext(address account)
        external
        view
        override
        returns (AccountContext memory)
    {
        return AccountContextHandler.getAccountContext(account);
    }

    /// @notice Returns account balances for a given currency
    function getAccountBalance(uint16 currencyId, address account)
        external
        view
        override
        returns (
            int256 cashBalance,
            int256 nTokenBalance,
            uint256 lastClaimTime
        )
    {
        // prettier-ignore
        (
            cashBalance,
            nTokenBalance,
            lastClaimTime,
            /* */
        ) = BalanceHandler.getBalanceStorage(account, currencyId);
    }

    /// @notice Returns account portfolio of assets
    function getAccountPortfolio(address account)
        external
        view
        override
        returns (PortfolioAsset[] memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        if (accountContext.bitmapCurrencyId != 0) {
            return
                BitmapAssetsHandler.getifCashArray(
                    account,
                    accountContext.bitmapCurrencyId,
                    accountContext.nextSettleTime
                );
        } else {
            return PortfolioHandler.getSortedPortfolio(account, accountContext.assetArrayLength);
        }
    }

    /// @notice Returns the fCash amount at the specified maturity for a bitmapped portfolio
    function getfCashNotional(
        address account,
        uint256 currencyId,
        uint256 maturity
    ) external view override returns (int256) {
        return BitmapAssetsHandler.getifCashNotional(account, currencyId, maturity);
    }

    /// @notice Returns the assets bitmap for an account
    function getAssetsBitmap(address account, uint256 currencyId)
        external
        view
        override
        returns (bytes32)
    {
        return BitmapAssetsHandler.getAssetsBitmap(account, currencyId);
    }

    /// @notice Returns free collateral of an account along with an array of the individual net available
    /// asset cash amounts
    function getFreeCollateral(address account)
        external
        view
        override
        returns (int256, int256[] memory)
    {
        return FreeCollateralExternal.getFreeCollateralView(account);
    }

    /** General Calculation View Methods **/

    /// @notice Returns the nTokens that will be minted when some amount of asset tokens are deposited
    function calculateNTokensToMint(uint16 currencyId, uint88 amountToDepositExternalPrecision)
        external
        view
        override
        returns (uint256)
    {
        Token memory token = TokenHandler.getToken(currencyId, false);
        int256 amountToDepositInternal =
            token.convertToInternal(int256(amountToDepositExternalPrecision));
        nTokenPortfolio memory nToken;
        nTokenHandler.loadNTokenPortfolioView(currencyId, nToken);

        // prettier-ignore
        (
            int256 tokensToMint,
            /* */
        ) = nTokenMintAction.calculateTokensToMint(
            nToken,
            amountToDepositInternal,
            block.timestamp
        );

        return SafeCast.toUint256(tokensToMint);
    }

    /// @notice Returns the fCash amount to send when given a cash amount, be sure to buffer these amounts
    /// slightly because the liquidity curve is sensitive to changes in block time
    function getfCashAmountGivenCashAmount(
        uint16 currencyId,
        int88 netCashToAccount,
        uint256 marketIndex,
        uint256 blockTime
    ) external view override returns (int256) {
        CashGroupParameters memory cashGroup = CashGroup.buildCashGroupView(currencyId);
        MarketParameters memory market;
        cashGroup.loadMarket(market, marketIndex, false, blockTime);

        require(market.maturity > blockTime, "Invalid block time");
        uint256 timeToMaturity = market.maturity - blockTime;
        (int256 rateScalar, int256 totalCashUnderlying, int256 rateAnchor) =
            Market.getExchangeRateFactors(market, cashGroup, timeToMaturity, marketIndex);
        int256 fee = Market.getExchangeRateFromImpliedRate(cashGroup.getTotalFee(), timeToMaturity);

        return
            Market.getfCashGivenCashAmount(
                market.totalfCash,
                int256(netCashToAccount),
                totalCashUnderlying,
                rateScalar,
                rateAnchor,
                fee,
                0
            );
    }

    /// @notice Returns the cash amount that will be traded given an fCash amount, be sure to buffer these amounts
    /// slightly because the liquidity curve is sensitive to changes in block time
    function getCashAmountGivenfCashAmount(
        uint16 currencyId,
        int88 fCashAmount,
        uint256 marketIndex,
        uint256 blockTime
    ) external view override returns (int256, int256) {
        CashGroupParameters memory cashGroup = CashGroup.buildCashGroupView(currencyId);
        MarketParameters memory market;
        cashGroup.loadMarket(market, marketIndex, false, blockTime);

        require(market.maturity > blockTime, "Invalid block time");
        uint256 timeToMaturity = market.maturity - blockTime;

        // prettier-ignore
        (int256 assetCash, /* int fee */) =
            market.calculateTrade(cashGroup, fCashAmount, timeToMaturity, marketIndex);

        return (assetCash, cashGroup.assetRate.convertToUnderlying(assetCash));
    }

    /// @notice Returns the claimable incentives for all nToken balances
    /// @param account The address of the account which holds the tokens
    /// @param blockTime The block time when incentives will be minted
    /// @return Incentives an account is eligible to claim
    function nTokenGetClaimableIncentives(address account, uint256 blockTime)
        external
        view
        override
        returns (uint256)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        BalanceState memory balanceState;
        uint256 totalIncentivesClaimable;

        if (accountContext.bitmapCurrencyId != 0) {
            balanceState.loadBalanceState(account, accountContext.bitmapCurrencyId, accountContext);
            if (balanceState.storedNTokenBalance > 0) {
                address tokenAddress = nTokenHandler.nTokenAddress(balanceState.currencyId);

                // prettier-ignore
                (
                    /* totalSupply */,
                    uint256 integralTotalSupply,
                    /* lastSupplyChangeTime */
                ) = nTokenHandler.calculateIntegralTotalSupply(tokenAddress, blockTime);

                uint256 incentivesToClaim = Incentives.calculateIncentivesToClaim(
                    tokenAddress,
                    uint256(balanceState.storedNTokenBalance),
                    balanceState.lastClaimTime,
                    balanceState.lastClaimIntegralSupply,
                    blockTime,
                    integralTotalSupply
                );
                totalIncentivesClaimable = totalIncentivesClaimable.add(incentivesToClaim);
            }
        }

        bytes18 currencies = accountContext.activeCurrencies;
        while (currencies != 0) {
            uint256 currencyId = uint256(uint16(bytes2(currencies) & Constants.UNMASK_FLAGS));
            balanceState.loadBalanceState(account, currencyId, accountContext);

            if (balanceState.storedNTokenBalance > 0) {
                address tokenAddress = nTokenHandler.nTokenAddress(balanceState.currencyId);

                (
                    /* totalSupply */,
                    uint256 integralTotalSupply,
                    /* lastSupplyChangeTime */
                ) = nTokenHandler.calculateIntegralTotalSupply(tokenAddress, blockTime);

                uint256 incentivesToClaim = Incentives.calculateIncentivesToClaim(
                    nTokenHandler.nTokenAddress(balanceState.currencyId),
                    uint256(balanceState.storedNTokenBalance),
                    balanceState.lastClaimTime,
                    balanceState.lastClaimIntegralSupply,
                    blockTime,
                    integralTotalSupply
                );
                totalIncentivesClaimable = totalIncentivesClaimable.add(incentivesToClaim);
            }

            currencies = currencies << 16;
        }

        return totalIncentivesClaimable;
    }

    fallback() external {
        revert("Method not found");
    }
}
