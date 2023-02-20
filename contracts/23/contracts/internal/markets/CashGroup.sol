// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./Market.sol";
import "./AssetRate.sol";
import "./DateTime.sol";
import "../../global/Types.sol";
import "../../global/Constants.sol";
import "../../math/SafeInt256.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library CashGroup {
    using SafeMath for uint256;
    using SafeInt256 for int256;
    using AssetRate for AssetRateParameters;
    using Market for MarketParameters;

    // Offsets for the bytes of the different parameters
    uint256 private constant RATE_ORACLE_TIME_WINDOW = 8;
    uint256 private constant TOTAL_FEE = 16;
    uint256 private constant RESERVE_FEE_SHARE = 24;
    uint256 private constant DEBT_BUFFER = 32;
    uint256 private constant FCASH_HAIRCUT = 40;
    uint256 private constant SETTLEMENT_PENALTY = 48;
    uint256 private constant LIQUIDATION_FCASH_HAIRCUT = 56;
    uint256 private constant LIQUIDATION_DEBT_BUFFER = 64;
    // 7 bytes allocated, one byte per market for the liquidity token haircut
    uint256 private constant LIQUIDITY_TOKEN_HAIRCUT = 72;
    // 7 bytes allocated, one byte per market for the rate scalar
    uint256 private constant RATE_SCALAR = 144;

    /// @notice Returns the rate scalar scaled by time to maturity. The rate scalar multiplies
    /// the ln() portion of the liquidity curve as an inverse so it increases with time to
    /// maturity. The effect of the rate scalar on slippage must decrease with time to maturity.
    function getRateScalar(
        CashGroupParameters memory cashGroup,
        uint256 marketIndex,
        uint256 timeToMaturity
    ) internal pure returns (int256) {
        require(marketIndex >= 1); // dev: invalid market index
        require(timeToMaturity <= uint256(type(int256).max)); // dev: time to maturity overflow

        uint256 offset = RATE_SCALAR + 8 * (marketIndex - 1);
        int256 scalar = int256(uint8(uint256(cashGroup.data >> offset))) * Constants.RATE_PRECISION;
        int256 rateScalar =
            scalar.mul(int256(Constants.IMPLIED_RATE_TIME)).div(int256(timeToMaturity));

        // Rate scalar is denominated in RATE_PRECISION, it is unlikely to underflow in the
        // division above.
        require(rateScalar > 0); // dev: rate scalar underflow
        return rateScalar;
    }

    /// @notice Haircut on liquidity tokens to account for the risk associated with changes in the
    /// proportion of cash to fCash within the pool. This is set as a percentage less than or equal to 100.
    function getLiquidityHaircut(CashGroupParameters memory cashGroup, uint256 assetType)
        internal
        pure
        returns (uint256)
    {
        require(assetType > 1); // dev: liquidity haircut invalid asset type
        uint256 offset =
            LIQUIDITY_TOKEN_HAIRCUT + 8 * (assetType - Constants.MIN_LIQUIDITY_TOKEN_INDEX);
        uint256 liquidityTokenHaircut = uint256(uint8(uint256(cashGroup.data >> offset)));
        return liquidityTokenHaircut;
    }

    /// @notice Total trading fee denominated in basis points
    function getTotalFee(CashGroupParameters memory cashGroup) internal pure returns (uint256) {
        return uint256(uint8(uint256(cashGroup.data >> TOTAL_FEE))) * Constants.BASIS_POINT;
    }

    /// @notice Percentage of the total trading fee that goes to the reserve
    function getReserveFeeShare(CashGroupParameters memory cashGroup)
        internal
        pure
        returns (int256)
    {
        return int256(uint8(uint256(cashGroup.data >> RESERVE_FEE_SHARE)));
    }

    /// @notice fCash haircut for valuation denominated in basis points
    function getfCashHaircut(CashGroupParameters memory cashGroup) internal pure returns (uint256) {
        return
            uint256(uint8(uint256(cashGroup.data >> FCASH_HAIRCUT))) * (5 * Constants.BASIS_POINT);
    }

    /// @notice fCash debt buffer for valuation denominated in basis points
    function getDebtBuffer(CashGroupParameters memory cashGroup) internal pure returns (uint256) {
        return uint256(uint8(uint256(cashGroup.data >> DEBT_BUFFER))) * (5 * Constants.BASIS_POINT);
    }

    /// @notice Time window factor for the rate oracle denominated in seconds
    function getRateOracleTimeWindow(CashGroupParameters memory cashGroup)
        internal
        pure
        returns (uint256)
    {
        // This is denominated in minutes in storage
        return uint256(uint8(uint256(cashGroup.data >> RATE_ORACLE_TIME_WINDOW))) * 60;
    }

    /// @notice Penalty rate for settling cash debts denominated in basis points
    function getSettlementPenalty(CashGroupParameters memory cashGroup)
        internal
        pure
        returns (uint256)
    {
        return
            uint256(uint8(uint256(cashGroup.data >> SETTLEMENT_PENALTY))) *
            (5 * Constants.BASIS_POINT);
    }

    /// @notice Haircut for fCash during liquidation denominated in basis points
    function getLiquidationfCashHaircut(CashGroupParameters memory cashGroup)
        internal
        pure
        returns (uint256)
    {
        return
            uint256(uint8(uint256(cashGroup.data >> LIQUIDATION_FCASH_HAIRCUT))) *
            (5 * Constants.BASIS_POINT);
    }

    function getLiquidationDebtBuffer(CashGroupParameters memory cashGroup)
        internal
        pure
        returns (uint256)
    {
        return
            uint256(uint8(uint256(cashGroup.data >> LIQUIDATION_DEBT_BUFFER))) *
            (5 * Constants.BASIS_POINT);
    }

    function loadMarket(
        CashGroupParameters memory cashGroup,
        MarketParameters memory market,
        uint256 marketIndex,
        bool needsLiquidity,
        uint256 blockTime
    ) internal view {
        require(marketIndex > 0 && marketIndex <= cashGroup.maxMarketIndex, "Invalid market");
        uint256 maturity =
            DateTime.getReferenceTime(blockTime).add(DateTime.getTradedMarket(marketIndex));

        market.loadMarket(
            cashGroup.currencyId,
            maturity,
            blockTime,
            needsLiquidity,
            getRateOracleTimeWindow(cashGroup)
        );
    }

    /// @notice Returns the linear interpolation between two market rates. The formula is
    /// slope = (longMarket.oracleRate - shortMarket.oracleRate) / (longMarket.maturity - shortMarket.maturity)
    /// interpolatedRate = slope * (assetMaturity - shortMarket.maturity) + shortMarket.oracleRate
    function interpolateOracleRate(
        uint256 shortMaturity,
        uint256 longMaturity,
        uint256 shortRate,
        uint256 longRate,
        uint256 assetMaturity
    ) internal pure returns (uint256) {
        require(shortMaturity < assetMaturity); // dev: cash group interpolation error, short maturity
        require(assetMaturity < longMaturity); // dev: cash group interpolation error, long maturity

        // It's possible that the rates are inverted where the short market rate > long market rate and
        // we will get an underflow here so we check for that
        if (longRate >= shortRate) {
            return
                (longRate - shortRate)
                    .mul(assetMaturity - shortMaturity)
                // No underflow here, checked above
                    .div(longMaturity - shortMaturity)
                    .add(shortRate);
        } else {
            // In this case the slope is negative so:
            // interpolatedRate = shortMarket.oracleRate - slope * (assetMaturity - shortMarket.maturity)
            // NOTE: this subtraction should never overflow, the linear interpolation between two points above zero
            // cannot go below zero
            return
                shortRate.sub(
                    // This is reversed to keep it it positive
                    (shortRate - longRate)
                        .mul(assetMaturity - shortMaturity)
                    // No underflow here, checked above
                        .div(longMaturity - shortMaturity)
                );
        }
    }

    /// @dev Gets an oracle rate without interpolation
    function calculateOracleRate(
        CashGroupParameters memory cashGroup,
        uint256 maturity,
        uint256 blockTime
    ) internal view returns (uint256) {
        (uint256 marketIndex, bool idiosyncratic) =
            DateTime.getMarketIndex(cashGroup.maxMarketIndex, maturity, blockTime);
        uint256 timeWindow = getRateOracleTimeWindow(cashGroup);

        if (!idiosyncratic) {
            return Market.getOracleRate(cashGroup.currencyId, maturity, timeWindow, blockTime);
        }

        uint256 longMaturity =
            DateTime.getReferenceTime(blockTime).add(DateTime.getTradedMarket(marketIndex));
        uint256 longRate =
            Market.getOracleRate(cashGroup.currencyId, longMaturity, timeWindow, blockTime);

        uint256 shortMaturity;
        uint256 shortRate;
        if (marketIndex == 1) {
            // In this case the short market is the annualized asset supply rate
            shortMaturity = blockTime;
            shortRate = cashGroup.assetRate.getSupplyRate();
        } else {
            shortMaturity = DateTime.getReferenceTime(blockTime).add(
                DateTime.getTradedMarket(marketIndex - 1)
            );

            shortRate = Market.getOracleRate(
                cashGroup.currencyId,
                shortMaturity,
                timeWindow,
                blockTime
            );
        }

        return interpolateOracleRate(shortMaturity, longMaturity, shortRate, longRate, maturity);
    }

    function _getCashGroupStorageBytes(uint256 currencyId) private view returns (bytes32) {
        bytes32 slot = keccak256(abi.encode(currencyId, Constants.CASH_GROUP_STORAGE_OFFSET));
        bytes32 data;

        assembly {
            data := sload(slot)
        }

        return data;
    }

    /// @dev Helper method for validating maturities in ERC1155Action
    function getMaxMarketIndex(uint256 currencyId) internal view returns (uint8) {
        bytes32 data = _getCashGroupStorageBytes(currencyId);
        return uint8(data[31]);
    }

    /// @notice Checks all cash group settings for invalid values and sets them into storage
    function setCashGroupStorage(uint256 currencyId, CashGroupSettings calldata cashGroup)
        internal
    {
        bytes32 slot = keccak256(abi.encode(currencyId, Constants.CASH_GROUP_STORAGE_OFFSET));
        require(
            cashGroup.maxMarketIndex >= 0 &&
                cashGroup.maxMarketIndex <= Constants.MAX_TRADED_MARKET_INDEX,
            "CG: invalid market index"
        );
        // Due to the requirements of the yield curve we do not allow a cash group to have solely a 3 month market.
        // The reason is that borrowers will not have a further maturity to roll from their 3 month fixed to a 6 month
        // fixed. It also complicates the logic in the nToken initialization method
        require(cashGroup.maxMarketIndex != 1, "CG: invalid market index");
        require(
            cashGroup.reserveFeeShare <= Constants.PERCENTAGE_DECIMALS,
            "CG: invalid reserve share"
        );
        require(cashGroup.liquidityTokenHaircuts.length == cashGroup.maxMarketIndex);
        require(cashGroup.rateScalars.length == cashGroup.maxMarketIndex);
        // This is required so that fCash liquidation can proceed correctly
        require(cashGroup.liquidationfCashHaircut5BPS < cashGroup.fCashHaircut5BPS);
        require(cashGroup.liquidationDebtBuffer5BPS < cashGroup.debtBuffer5BPS);

        // Market indexes cannot decrease or they will leave fCash assets stranded in the future with no valuation curve
        uint8 previousMaxMarketIndex = uint8(uint256(_getCashGroupStorageBytes(currencyId)));
        require(
            previousMaxMarketIndex <= cashGroup.maxMarketIndex,
            "CG: market index cannot decrease"
        );

        // Per cash group settings
        bytes32 data =
            (bytes32(uint256(cashGroup.maxMarketIndex)) |
                (bytes32(uint256(cashGroup.rateOracleTimeWindowMin)) << RATE_ORACLE_TIME_WINDOW) |
                (bytes32(uint256(cashGroup.totalFeeBPS)) << TOTAL_FEE) |
                (bytes32(uint256(cashGroup.reserveFeeShare)) << RESERVE_FEE_SHARE) |
                (bytes32(uint256(cashGroup.debtBuffer5BPS)) << DEBT_BUFFER) |
                (bytes32(uint256(cashGroup.fCashHaircut5BPS)) << FCASH_HAIRCUT) |
                (bytes32(uint256(cashGroup.settlementPenaltyRate5BPS)) << SETTLEMENT_PENALTY) |
                (bytes32(uint256(cashGroup.liquidationfCashHaircut5BPS)) <<
                    LIQUIDATION_FCASH_HAIRCUT) |
                (bytes32(uint256(cashGroup.liquidationDebtBuffer5BPS)) << LIQUIDATION_DEBT_BUFFER));

        // Per market group settings
        for (uint256 i; i < cashGroup.liquidityTokenHaircuts.length; i++) {
            require(
                cashGroup.liquidityTokenHaircuts[i] <= Constants.PERCENTAGE_DECIMALS,
                "CG: invalid token haircut"
            );

            data =
                data |
                (bytes32(uint256(cashGroup.liquidityTokenHaircuts[i])) <<
                    (LIQUIDITY_TOKEN_HAIRCUT + i * 8));
        }

        for (uint256 i; i < cashGroup.rateScalars.length; i++) {
            // Causes a divide by zero error
            require(cashGroup.rateScalars[i] != 0, "CG: invalid rate scalar");
            data = data | (bytes32(uint256(cashGroup.rateScalars[i])) << (RATE_SCALAR + i * 8));
        }

        assembly {
            sstore(slot, data)
        }
    }

    /// @notice Deserialize the cash group storage bytes into a user friendly object
    function deserializeCashGroupStorage(uint256 currencyId)
        internal
        view
        returns (CashGroupSettings memory)
    {
        bytes32 data = _getCashGroupStorageBytes(currencyId);
        uint8 maxMarketIndex = uint8(data[31]);
        uint8[] memory tokenHaircuts = new uint8[](uint256(maxMarketIndex));
        uint8[] memory rateScalars = new uint8[](uint256(maxMarketIndex));

        for (uint8 i; i < maxMarketIndex; i++) {
            tokenHaircuts[i] = uint8(data[22 - i]);
            rateScalars[i] = uint8(data[13 - i]);
        }

        return
            CashGroupSettings({
                maxMarketIndex: maxMarketIndex,
                rateOracleTimeWindowMin: uint8(data[30]),
                totalFeeBPS: uint8(data[29]),
                reserveFeeShare: uint8(data[28]),
                debtBuffer5BPS: uint8(data[27]),
                fCashHaircut5BPS: uint8(data[26]),
                settlementPenaltyRate5BPS: uint8(data[25]),
                liquidationfCashHaircut5BPS: uint8(data[24]),
                liquidationDebtBuffer5BPS: uint8(data[23]),
                liquidityTokenHaircuts: tokenHaircuts,
                rateScalars: rateScalars
            });
    }

    function _buildCashGroup(uint256 currencyId, AssetRateParameters memory assetRate)
        private
        view
        returns (CashGroupParameters memory)
    {
        bytes32 data = _getCashGroupStorageBytes(currencyId);
        uint256 maxMarketIndex = uint256(uint8(uint256(data)));

        return
            CashGroupParameters({
                currencyId: currencyId,
                maxMarketIndex: maxMarketIndex,
                assetRate: assetRate,
                data: data
            });
    }

    /// @notice Builds a cash group using a view version of the asset rate
    function buildCashGroupView(uint256 currencyId)
        internal
        view
        returns (CashGroupParameters memory)
    {
        AssetRateParameters memory assetRate = AssetRate.buildAssetRateView(currencyId);
        return _buildCashGroup(currencyId, assetRate);
    }

    /// @notice Builds a cash group using a stateful version of the asset rate
    function buildCashGroupStateful(uint256 currencyId)
        internal
        returns (CashGroupParameters memory)
    {
        AssetRateParameters memory assetRate = AssetRate.buildAssetRateStateful(currencyId);
        return _buildCashGroup(currencyId, assetRate);
    }
}
