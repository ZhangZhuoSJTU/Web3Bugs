// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./markets/CashGroup.sol";
import "./markets/AssetRate.sol";
import "./valuation/AssetHandler.sol";
import "./portfolio/BitmapAssetsHandler.sol";
import "./portfolio/PortfolioHandler.sol";
import "./balances/BalanceHandler.sol";
import "../math/SafeInt256.sol";

library nTokenHandler {
    using AssetRate for AssetRateParameters;
    using SafeInt256 for int256;

    /// @dev Stores (uint32)
    bytes32 private constant INCENTIVE_RATE_MASK =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFF;
    /// @dev Stores (uint8, uint32)
    bytes32 private constant ARRAY_TIME_MASK =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000FFFFFFFFFFFF;
    /// @dev Stores (uint8, uint8, uint8, uint8, uint8)
    bytes32 private constant COLLATERAL_MASK =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000FFFFFFFFFFFFFFFFFFFFFF;

    /// @notice Returns an account context object that is specific to nTokens.
    function getNTokenContext(address tokenAddress)
        internal
        view
        returns (
            uint256 currencyId,
            uint256 incentiveAnnualEmissionRate,
            uint256 lastInitializedTime,
            bytes6 parameters
        )
    {
        bytes32 slot = keccak256(abi.encode(tokenAddress, Constants.NTOKEN_CONTEXT_STORAGE_OFFSET));
        bytes32 data;
        assembly {
            data := sload(slot)
        }

        currencyId = uint256(uint16(uint256(data)));
        incentiveAnnualEmissionRate = uint256(uint32(uint256(data >> 16)));
        lastInitializedTime = uint256(uint32(uint256(data >> 48)));
        parameters = bytes6(data << 128);
    }

    /// @notice Returns the nToken token address for a given currency
    function nTokenAddress(uint256 currencyId) internal view returns (address tokenAddress) {
        bytes32 slot = keccak256(abi.encode(currencyId, Constants.NTOKEN_ADDRESS_STORAGE_OFFSET));
        assembly {
            tokenAddress := sload(slot)
        }
    }

    /// @notice Called by governance to set the nToken token address and its reverse lookup. Cannot be
    /// reset once this is set.
    function setNTokenAddress(uint16 currencyId, address tokenAddress) internal {
        bytes32 addressSlot =
            keccak256(abi.encode(currencyId, Constants.NTOKEN_ADDRESS_STORAGE_OFFSET));
        bytes32 currencySlot =
            keccak256(abi.encode(tokenAddress, Constants.NTOKEN_CONTEXT_STORAGE_OFFSET));

        uint256 data;
        assembly {
            data := sload(addressSlot)
        }
        require(data == 0, "PT: token address exists");
        assembly {
            data := sload(currencySlot)
        }
        require(data == 0, "PT: currency exists");

        assembly {
            sstore(addressSlot, tokenAddress)
        }

        // This will initialize all the other token context values to zer
        assembly {
            sstore(currencySlot, currencyId)
        }
    }

    /// @notice Set nToken token collateral parameters
    function setNTokenCollateralParameters(
        address tokenAddress,
        uint8 residualPurchaseIncentive10BPS,
        uint8 pvHaircutPercentage,
        uint8 residualPurchaseTimeBufferHours,
        uint8 cashWithholdingBuffer10BPS,
        uint8 liquidationHaircutPercentage
    ) internal {
        bytes32 slot = keccak256(abi.encode(tokenAddress, Constants.NTOKEN_CONTEXT_STORAGE_OFFSET));
        bytes32 data;
        assembly {
            data := sload(slot)
        }

        require(liquidationHaircutPercentage <= Constants.PERCENTAGE_DECIMALS, "Invalid haircut");
        // The pv haircut percentage must be less than the liquidation percentage or else liquidators will not
        // get profit for liquidating nToken.
        require(pvHaircutPercentage < liquidationHaircutPercentage, "Invalid pv haircut");
        // Ensure that the cash withholding buffer is greater than the residual purchase incentive or
        // the nToken may not have enough cash to pay accounts to buy its negative ifCash
        require(residualPurchaseIncentive10BPS <= cashWithholdingBuffer10BPS, "Invalid discounts");

        // Clear the bytes where collateral parameters will go and OR the data in
        data = data & COLLATERAL_MASK;
        bytes32 parameters =
            (bytes32(uint256(residualPurchaseIncentive10BPS)) |
                (bytes32(uint256(pvHaircutPercentage)) << 8) |
                (bytes32(uint256(residualPurchaseTimeBufferHours)) << 16) |
                (bytes32(uint256(cashWithholdingBuffer10BPS)) << 24) |
                (bytes32(uint256(liquidationHaircutPercentage)) << 32));
        data = data | (bytes32(parameters) << 88);
        assembly {
            sstore(slot, data)
        }
    }

    /// @notice Retrieves the nToken supply factors without any updates or calculations
    function getStoredNTokenSupplyFactors(address tokenAddress)
        internal
        view
        returns (
            uint256 totalSupply,
            uint256 integralTotalSupply,
            uint256 lastSupplyChangeTime
        )
    {
        bytes32 slot = keccak256(abi.encode(tokenAddress, Constants.NTOKEN_TOTAL_SUPPLY_OFFSET));
        bytes32 data;

        assembly {
            data := sload(slot)
        }

        totalSupply = uint256(uint96(uint256(data)));
        // NOTE: DO NOT USE THIS RETURNED VALUE FOR CALCULATING INCENTIVES. The integral total supply
        // must be updated given the block time. Use `calculateIntegralTotalSupply` instead
        integralTotalSupply = uint256(uint128(uint256(data >> 96)));
        lastSupplyChangeTime = uint256(data >> 224);
    }

    /// @notice Retrieves stored total supply factors and 
    function calculateIntegralTotalSupply(address tokenAddress, uint256 blockTime) 
        internal
        view 
        returns (
            uint256 totalSupply,
            uint256 integralTotalSupply,
            uint256 lastSupplyChangeTime
        )
    {
        (
            totalSupply,
            integralTotalSupply,
            lastSupplyChangeTime
        ) = getStoredNTokenSupplyFactors(tokenAddress);

        // Initialize last supply change time if it has not been set.
        if (lastSupplyChangeTime == 0) lastSupplyChangeTime = blockTime;

        require(blockTime >= lastSupplyChangeTime); // dev: invalid block time

        // Add to the integral total supply the total supply of tokens multiplied by the time that the total supply
        // has been the value. This will part of the numerator for the average total supply calculation during
        // minting incentives.
        integralTotalSupply = uint256(int256(integralTotalSupply).add(
            int256(totalSupply).mul(int256(blockTime - lastSupplyChangeTime))
        ));

        require(integralTotalSupply >= 0 && integralTotalSupply < type(uint128).max); // dev: integral total supply overflow
        require(blockTime < type(uint32).max); // dev: last supply change supply overflow
    }


    /// @notice Updates the nToken token supply amount when minting or redeeming.
    function changeNTokenSupply(
        address tokenAddress,
        int256 netChange,
        uint256 blockTime
    ) internal returns (uint256) {
        (
            uint256 totalSupply,
            uint256 integralTotalSupply,
            /* uint256 lastSupplyChangeTime */
        ) = calculateIntegralTotalSupply(tokenAddress, blockTime);

        if (netChange != 0) {
            bytes32 slot = keccak256(abi.encode(tokenAddress, Constants.NTOKEN_TOTAL_SUPPLY_OFFSET));
            // If the totalSupply will change then we store the new total supply, the integral total supply and the
            // current block time. We know that this int256 conversion will not overflow because totalSupply is stored
            // as a uint96 and checked in the next line.
            int256 newTotalSupply = int256(totalSupply).add(netChange);
            require(newTotalSupply >= 0 && uint256(newTotalSupply) < type(uint96).max); // dev: nToken supply overflow

            bytes32 newData = (
                (bytes32(uint256(newTotalSupply))) |
                (bytes32(integralTotalSupply << 96)) |
                (bytes32(blockTime << 224))
            );

            assembly {
                sstore(slot, newData)
            }
        }

        return integralTotalSupply;
    }

    function setIncentiveEmissionRate(address tokenAddress, uint32 newEmissionsRate) internal {
        bytes32 slot = keccak256(abi.encode(tokenAddress, Constants.NTOKEN_CONTEXT_STORAGE_OFFSET));

        bytes32 data;
        assembly {
            data := sload(slot)
        }
        // Clear the 4 bytes where emissions rate will go and OR it in
        data = data & INCENTIVE_RATE_MASK;
        data = data | (bytes32(uint256(newEmissionsRate)) << 16);
        assembly {
            sstore(slot, data)
        }
    }

    function setArrayLengthAndInitializedTime(
        address tokenAddress,
        uint8 arrayLength,
        uint256 lastInitializedTime
    ) internal {
        bytes32 slot = keccak256(abi.encode(tokenAddress, Constants.NTOKEN_CONTEXT_STORAGE_OFFSET));
        require(lastInitializedTime >= 0 && uint256(lastInitializedTime) < type(uint32).max); // dev: next settle time overflow

        bytes32 data;
        assembly {
            data := sload(slot)
        }
        // Clear the 6 bytes where array length and settle time will go
        data = data & ARRAY_TIME_MASK;
        data = data | (bytes32(uint256(lastInitializedTime)) << 48);
        data = data | (bytes32(uint256(arrayLength)) << 80);
        assembly {
            sstore(slot, data)
        }
    }

    /// @notice Returns the array of deposit shares and leverage thresholds for nTokens
    function getDepositParameters(uint256 currencyId, uint256 maxMarketIndex)
        internal
        view
        returns (int256[] memory depositShares, int256[] memory leverageThresholds)
    {
        uint256 slot =
            uint256(keccak256(abi.encode(currencyId, Constants.NTOKEN_DEPOSIT_STORAGE_OFFSET)));
        (depositShares, leverageThresholds) = _getParameters(slot, maxMarketIndex, false);
    }

    /// @notice Sets the deposit parameters
    /// @dev We pack the values in alternating between the two parameters into either one or two
    // storage slots depending on the number of markets. This is to save storage reads when we use the parameters.
    function setDepositParameters(
        uint256 currencyId,
        uint32[] calldata depositShares,
        uint32[] calldata leverageThresholds
    ) internal {
        uint256 slot =
            uint256(keccak256(abi.encode(currencyId, Constants.NTOKEN_DEPOSIT_STORAGE_OFFSET)));
        require(
            depositShares.length <= Constants.MAX_TRADED_MARKET_INDEX,
            "PT: deposit share length"
        );

        require(depositShares.length == leverageThresholds.length, "PT: leverage share length");

        uint256 shareSum;
        for (uint256 i; i < depositShares.length; i++) {
            // This cannot overflow in uint 256 with 9 max slots
            shareSum = shareSum + depositShares[i];
            require(
                leverageThresholds[i] > 0 && leverageThresholds[i] < Constants.RATE_PRECISION,
                "PT: leverage threshold"
            );
        }

        // Total deposit share must add up to 100%
        require(shareSum == uint256(Constants.DEPOSIT_PERCENT_BASIS), "PT: deposit shares sum");
        _setParameters(slot, depositShares, leverageThresholds);
    }

    /// @notice Sets the initialization parameters for the markets, these are read only when markets
    /// are initialized
    function setInitializationParameters(
        uint256 currencyId,
        uint32[] calldata annualizedAnchorRates,
        uint32[] calldata proportions
    ) internal {
        uint256 slot =
            uint256(keccak256(abi.encode(currencyId, Constants.NTOKEN_INIT_STORAGE_OFFSET)));
        require(annualizedAnchorRates.length <= Constants.MAX_TRADED_MARKET_INDEX, "PT: annualized anchor rates length");

        require(proportions.length == annualizedAnchorRates.length, "PT: proportions length");

        for (uint256 i; i < proportions.length; i++) {
            // Proportions must be between zero and the rate precision
            require(
                proportions[i] > 0 && proportions[i] < Constants.RATE_PRECISION,
                "PT: invalid proportion"
            );
        }

        _setParameters(slot, annualizedAnchorRates, proportions);
    }

    /// @notice Returns the array of initialization parameters for a given currency.
    function getInitializationParameters(uint256 currencyId, uint256 maxMarketIndex)
        internal
        view
        returns (int256[] memory annualizedAnchorRates, int256[] memory proportions)
    {
        uint256 slot =
            uint256(keccak256(abi.encode(currencyId, Constants.NTOKEN_INIT_STORAGE_OFFSET)));
        (annualizedAnchorRates, proportions) = _getParameters(slot, maxMarketIndex, true);
    }

    function _getParameters(
        uint256 slot,
        uint256 maxMarketIndex,
        bool noUnset
    ) private view returns (int256[] memory, int256[] memory) {
        bytes32 data;

        assembly {
            data := sload(slot)
        }

        int256[] memory array1 = new int256[](maxMarketIndex);
        int256[] memory array2 = new int256[](maxMarketIndex);
        for (uint256 i; i < maxMarketIndex; i++) {
            array1[i] = int256(uint32(uint256(data)));
            data = data >> 32;
            array2[i] = int256(uint32(uint256(data)));
            data = data >> 32;

            if (noUnset) {
                require(array1[i] > 0 && array2[i] > 0, "PT: init value zero");
            }

            if (i == 3) {
                // Load the second slot which occurs after the 4th market index
                slot = slot + 1;
                assembly {
                    data := sload(slot)
                }
            }
        }

        return (array1, array2);
    }

    function _setParameters(
        uint256 slot,
        uint32[] calldata array1,
        uint32[] calldata array2
    ) private {
        bytes32 data;
        uint256 bitShift;
        uint256 i;
        for (; i < array1.length; i++) {
            // Pack the data into alternating 4 byte slots
            data = data | (bytes32(uint256(array1[i])) << bitShift);
            bitShift += 32;

            data = data | (bytes32(uint256(array2[i])) << bitShift);
            bitShift += 32;

            if (i == 3) {
                // The first 4 (i == 3) pairs of values will fit into 32 bytes of the first storage slot,
                // after this we move one slot over
                assembly {
                    sstore(slot, data)
                }
                slot = slot + 1;
                data = 0x00;
                bitShift = 0;
            }
        }

        // Store the data if i is not exactly 4 which means it was stored completely in the first slot
        // when i == 3
        if (i != 4) {
            assembly {
                sstore(slot, data)
            }
        }
    }

    function loadNTokenPortfolioNoCashGroup(uint256 currencyId, nTokenPortfolio memory nToken)
        internal
        view
    {
        nToken.tokenAddress = nTokenAddress(currencyId);
        // prettier-ignore
        (
            /* currencyId */,
            /* incentiveRate */,
            uint256 lastInitializedTime,
            bytes6 parameters
        ) = getNTokenContext(nToken.tokenAddress);

        // prettier-ignore
        (
            uint256 totalSupply,
            /* integralTotalSupply */,
            /* lastSupplyChangeTime */
        ) = getStoredNTokenSupplyFactors(nToken.tokenAddress);

        nToken.lastInitializedTime = lastInitializedTime;
        nToken.totalSupply = int256(totalSupply);
        nToken.parameters = parameters;

        nToken.portfolioState = PortfolioHandler.buildPortfolioState(
            nToken.tokenAddress,
            uint8(parameters[Constants.ASSET_ARRAY_LENGTH]),
            0
        );

        // prettier-ignore
        (
            nToken.cashBalance,
            /* nTokenBalance */,
            /* lastClaimTime */,
            /* lastClaimIntegralSupply */
        ) = BalanceHandler.getBalanceStorage(nToken.tokenAddress, currencyId);
    }

    /// @notice Uses buildCashGroupStateful
    function loadNTokenPortfolioStateful(uint256 currencyId, nTokenPortfolio memory nToken)
        internal
    {
        loadNTokenPortfolioNoCashGroup(currencyId, nToken);
        nToken.cashGroup = CashGroup.buildCashGroupStateful(currencyId);
    }

    /// @notice Uses buildCashGroupView
    function loadNTokenPortfolioView(uint256 currencyId, nTokenPortfolio memory nToken)
        internal
        view
    {
        loadNTokenPortfolioNoCashGroup(currencyId, nToken);
        nToken.cashGroup = CashGroup.buildCashGroupView(currencyId);
    }

    function getNextSettleTime(nTokenPortfolio memory nToken) internal pure returns (uint256) {
        if (nToken.lastInitializedTime == 0) return 0;
        return DateTime.getReferenceTime(nToken.lastInitializedTime) + Constants.QUARTER;
    }

    /// @notice Returns the nToken present value denominated in asset terms.
    function getNTokenAssetPV(nTokenPortfolio memory nToken, uint256 blockTime)
        internal
        view
        returns (int256, bytes32)
    {
        int256 totalAssetPV;
        int256 totalUnderlyingPV;
        bytes32 ifCashBitmap =
            BitmapAssetsHandler.getAssetsBitmap(nToken.tokenAddress, nToken.cashGroup.currencyId);

        {
            uint256 nextSettleTime = getNextSettleTime(nToken);
            // If the first asset maturity has passed (the 3 month), this means that all the LTs must
            // be settled except the 6 month (which is now the 3 month). We don't settle LTs except in
            // initialize markets so we calculate the cash value of the portfolio here.
            if (nextSettleTime <= blockTime) {
                // NOTE: this condition should only be present for a very short amount of time, which is the window between
                // when the markets are no longer tradable at quarter end and when the new markets have been initialized.
                // We time travel back to one second before maturity to value the liquidity tokens. Although this value is
                // not strictly correct the different should be quite slight. We do this to ensure that free collateral checks
                // for withdraws and liquidations can still be processed. If this condition persists for a long period of time then
                // the entire protocol will have serious problems as markets will not be tradable.
                blockTime = nextSettleTime - 1;
            }
        }

        // Since we are not doing a risk adjusted valuation here we do not need to net off residual fCash
        // balances in the future before discounting to present. If we did, then the ifCash assets would
        // have to be in the portfolio array first. PV here is denominated in asset cash terms, not in
        // underlying terms.
        {
            MarketParameters memory market;
            for (uint256 i; i < nToken.portfolioState.storedAssets.length; i++) {
                // NOTE: getLiquidityTokenValue can rewrite fCash values in memory, however, that does not
                // happen in this call because there are no fCash values in the nToken portfolio.
                (int256 assetCashClaim, int256 pv) =
                    AssetHandler.getLiquidityTokenValue(
                        i,
                        nToken.cashGroup,
                        market,
                        nToken.portfolioState.storedAssets,
                        blockTime,
                        false
                    );

                totalAssetPV = totalAssetPV.add(assetCashClaim);
                totalUnderlyingPV = totalUnderlyingPV.add(pv);
            }
        }

        // Then iterate over bitmapped assets and get present value
        // prettier-ignore
        (
            int256 bitmapPv, 
            /* */
        ) = BitmapAssetsHandler.getifCashNetPresentValue(
            nToken.tokenAddress,
            nToken.cashGroup.currencyId,
            nToken.lastInitializedTime,
            blockTime,
            ifCashBitmap,
            nToken.cashGroup,
            false
        );
        totalUnderlyingPV = totalUnderlyingPV.add(bitmapPv);

        // Return the total present value denominated in asset terms
        totalAssetPV = totalAssetPV
            .add(nToken.cashGroup.assetRate.convertFromUnderlying(totalUnderlyingPV))
            .add(nToken.cashBalance);

        return (totalAssetPV, ifCashBitmap);
    }
}
