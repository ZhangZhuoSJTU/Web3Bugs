// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../../global/Types.sol";
import "../../global/Constants.sol";
import "../../math/SafeInt256.sol";
import "interfaces/notional/AssetRateAdapter.sol";

library AssetRate {
    using SafeInt256 for int256;
    event SetSettlementRate(uint256 currencyId, uint256 maturity, uint128 rate);

    uint256 private constant ASSET_RATE_STORAGE_SLOT = 2;
    // Asset rates are in 1e18 decimals (cToken exchange rates), internal balances
    // are in 1e8 decimals. Therefore we leave this as 1e18 / 1e8 = 1e10
    int256 private constant ASSET_RATE_DECIMAL_DIFFERENCE = 1e10;

    /// @notice Converts an internal asset cash value to its underlying token value.
    /// @param ar exchange rate object between asset and underlying
    /// @param assetBalance amount to convert to underlying
    function convertToUnderlying(AssetRateParameters memory ar, int256 assetBalance)
        internal
        pure
        returns (int256)
    {
        if (assetBalance == 0) return 0;

        // Calculation here represents:
        // rateDecimals * balance * internalPrecision / rateDecimals * underlyingPrecision
        int256 underlyingBalance =
            ar.rate.mul(assetBalance).div(ASSET_RATE_DECIMAL_DIFFERENCE).div(ar.underlyingDecimals);

        return underlyingBalance;
    }

    /// @notice Converts an internal underlying cash value to its asset cash value
    /// @param ar exchange rate object between asset and underlying
    /// @param underlyingBalance amount to convert to asset cash, denominated in internal token precision
    function convertFromUnderlying(AssetRateParameters memory ar, int256 underlyingBalance)
        internal
        pure
        returns (int256)
    {
        if (underlyingBalance == 0) return 0;

        // Calculation here represents:
        // rateDecimals * balance * underlyingPrecision / rateDecimals * internalPrecision
        int256 assetBalance =
            underlyingBalance.mul(ASSET_RATE_DECIMAL_DIFFERENCE).mul(ar.underlyingDecimals).div(
                ar.rate
            );

        return assetBalance;
    }

    /// @notice Returns the current per block supply rate, is used when calculating oracle rates
    /// for idiosyncratic fCash with a shorter duration than the 3 month maturity.
    function getSupplyRate(AssetRateParameters memory ar) internal view returns (uint256) {
        // If the rate oracle is not set, the asset is not interest bearing and has an oracle rate of zero.
        if (ar.rateOracle == address(0)) return 0;

        uint256 rate = AssetRateAdapter(ar.rateOracle).getAnnualizedSupplyRate();
        require(rate >= 0); // dev: invalid supply rate

        return rate;
    }

    function _getAssetRateStorage(uint256 currencyId)
        private
        view
        returns (address rateOracle, uint8 underlyingDecimalPlaces)
    {
        bytes32 slot = keccak256(abi.encode(currencyId, ASSET_RATE_STORAGE_SLOT));
        bytes32 data;

        assembly {
            data := sload(slot)
        }

        rateOracle = address(bytes20(data << 96));
        underlyingDecimalPlaces = uint8(uint256(data >> 160));
    }

    /// @notice Gets an asset rate using a view function, does not accrue interest so the
    /// exchange rate will not be up to date. Should only be used for non-stateful methods
    function _getAssetRateView(uint256 currencyId)
        private
        view
        returns (
            int256,
            address,
            uint8
        )
    {
        (address rateOracle, uint8 underlyingDecimalPlaces) = _getAssetRateStorage(currencyId);

        int256 rate;
        if (rateOracle == address(0)) {
            // If no rate oracle is set, then set this to the identity
            rate = ASSET_RATE_DECIMAL_DIFFERENCE;
            underlyingDecimalPlaces = 0;
        } else {
            rate = AssetRateAdapter(rateOracle).getExchangeRateView();
            require(rate > 0); // dev: invalid exchange rate
        }

        return (rate, rateOracle, underlyingDecimalPlaces);
    }

    /// @notice Gets an asset rate using a stateful function, accrues interest so the
    /// exchange rate will be up to date for the current block.
    function _getAssetRateStateful(uint256 currencyId)
        private
        returns (
            int256,
            address,
            uint8
        )
    {
        (address rateOracle, uint8 underlyingDecimalPlaces) = _getAssetRateStorage(currencyId);

        int256 rate;
        if (rateOracle == address(0)) {
            // If no rate oracle is set, then set this to the identity
            rate = ASSET_RATE_DECIMAL_DIFFERENCE;
            underlyingDecimalPlaces = 0;
        } else {
            rate = AssetRateAdapter(rateOracle).getExchangeRateStateful();
            require(rate > 0); // dev: invalid exchange rate
        }

        return (rate, rateOracle, underlyingDecimalPlaces);
    }

    /// @notice Returns an asset rate object using the view method
    function buildAssetRateView(uint256 currencyId)
        internal
        view
        returns (AssetRateParameters memory)
    {
        (int256 rate, address rateOracle, uint8 underlyingDecimalPlaces) =
            _getAssetRateView(currencyId);

        return
            AssetRateParameters({
                rateOracle: rateOracle,
                rate: rate,
                underlyingDecimals: int256(10**underlyingDecimalPlaces)
            });
    }

    /// @notice Returns an asset rate object using the stateful method
    function buildAssetRateStateful(uint256 currencyId)
        internal
        returns (AssetRateParameters memory)
    {
        (int256 rate, address rateOracle, uint8 underlyingDecimalPlaces) =
            _getAssetRateStateful(currencyId);

        return
            AssetRateParameters({
                rateOracle: rateOracle,
                rate: rate,
                underlyingDecimals: int256(10**underlyingDecimalPlaces)
            });
    }

    /// @dev Gets a settlement rate object
    function _getSettlementRateStorage(uint256 currencyId, uint256 maturity)
        private
        view
        returns (
            int256 settlementRate,
            uint8 underlyingDecimalPlaces,
            bytes32 slot
        )
    {
        bytes32 data;
        slot = keccak256(
            abi.encode(
                currencyId,
                keccak256(abi.encode(maturity, Constants.SETTLEMENT_RATE_STORAGE_OFFSET))
            )
        );

        assembly {
            data := sload(slot)
        }

        settlementRate = int256(uint128(uint256(data >> 40)));
        underlyingDecimalPlaces = uint8(uint256(data >> 168));
    }

    /// @notice Returns a settlement rate object using the view method
    function buildSettlementRateView(uint256 currencyId, uint256 maturity)
        internal
        view
        returns (AssetRateParameters memory)
    {
        // prettier-ignore
        (
            int256 settlementRate,
            uint8 underlyingDecimalPlaces,
            /* bytes32 slot */
        ) = _getSettlementRateStorage(currencyId, maturity);

        if (settlementRate == 0) {
            // If settlement rate has not been set then we need to fetch it
            // prettier-ignore
            (
                settlementRate,
                /* address */,
                underlyingDecimalPlaces
            ) = _getAssetRateView(currencyId);
        }

        return AssetRateParameters(address(0), settlementRate, int256(10**underlyingDecimalPlaces));
    }

    /// @notice Returns a settlement rate object and sets the rate if it has not been set yet
    function buildSettlementRateStateful(
        uint256 currencyId,
        uint256 maturity,
        uint256 blockTime
    ) internal returns (AssetRateParameters memory) {
        (int256 settlementRate, uint8 underlyingDecimalPlaces, bytes32 slot) =
            _getSettlementRateStorage(currencyId, maturity);

        if (settlementRate == 0) {
            // Settlement rate has not yet been set, set it in this branch
            address rateOracle;
            // prettier-ignore
            (
                settlementRate,
                rateOracle,
                underlyingDecimalPlaces
            ) = _getAssetRateStateful(currencyId);

            if (rateOracle != address(0)) {
                // Only need to set settlement rates when the rate oracle is set (meaning the asset token has
                // a conversion rate to an underlying). If not set then the asset cash always settles to underlying at a 1-1
                // rate since they are the same.
                require(blockTime != 0 && blockTime <= type(uint40).max); // dev: settlement rate timestamp overflow
                require(settlementRate > 0 && settlementRate <= type(uint128).max); // dev: settlement rate overflow
                uint128 storedRate = uint128(uint256(settlementRate));

                bytes32 data =
                    (bytes32(blockTime) |
                        (bytes32(uint256(storedRate)) << 40) |
                        (bytes32(uint256(underlyingDecimalPlaces)) << 168));

                assembly {
                    sstore(slot, data)
                }

                emit SetSettlementRate(currencyId, maturity, storedRate);
            }
        }

        return AssetRateParameters(address(0), settlementRate, int256(10**underlyingDecimalPlaces));
    }
}
