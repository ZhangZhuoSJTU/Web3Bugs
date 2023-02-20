// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../AccountContextHandler.sol";
import "../markets/CashGroup.sol";
import "../valuation/AssetHandler.sol";
import "../../math/Bitmap.sol";
import "../../math/SafeInt256.sol";
import "../../global/Constants.sol";
import "../../global/Types.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library BitmapAssetsHandler {
    using SafeMath for uint256;
    using SafeInt256 for int256;
    using Bitmap for bytes32;
    using CashGroup for CashGroupParameters;

    function _getAssetsBitmapSlot(address account, uint256 currencyId)
        private
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    account,
                    keccak256(abi.encode(currencyId, Constants.ASSETS_BITMAP_STORAGE_OFFSET))
                )
            );
    }

    function getAssetsBitmap(address account, uint256 currencyId) internal view returns (bytes32) {
        bytes32 slot = _getAssetsBitmapSlot(account, currencyId);
        bytes32 data;
        assembly {
            data := sload(slot)
        }
        return data;
    }

    function setAssetsBitmap(
        address account,
        uint256 currencyId,
        bytes32 assetsBitmap
    ) internal {
        bytes32 slot = _getAssetsBitmapSlot(account, currencyId);
        require(assetsBitmap.totalBitsSet() <= Constants.MAX_BITMAP_ASSETS, "Over max assets");

        assembly {
            sstore(slot, assetsBitmap)
        }
    }

    function getifCashSlot(
        address account,
        uint256 currencyId,
        uint256 maturity
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    maturity,
                    keccak256(
                        abi.encode(
                            currencyId,
                            keccak256(abi.encode(account, Constants.IFCASH_STORAGE_OFFSET))
                        )
                    )
                )
            );
    }

    function getifCashNotional(
        address account,
        uint256 currencyId,
        uint256 maturity
    ) internal view returns (int256 notional) {
        bytes32 fCashSlot = getifCashSlot(account, currencyId, maturity);
        assembly {
            notional := sload(fCashSlot)
        }
    }

    /// @notice Adds multiple assets to a bitmap portfolio
    function addMultipleifCashAssets(
        address account,
        AccountContext memory accountContext,
        PortfolioAsset[] memory assets
    ) internal {
        uint256 currencyId = accountContext.bitmapCurrencyId;
        require(currencyId != 0); // dev: invalid account in set ifcash assets
        bytes32 ifCashBitmap = getAssetsBitmap(account, currencyId);

        for (uint256 i; i < assets.length; i++) {
            if (assets[i].notional == 0) continue;
            require(assets[i].currencyId == currencyId); // dev: invalid asset in set ifcash assets
            require(assets[i].assetType == Constants.FCASH_ASSET_TYPE); // dev: invalid asset in set ifcash assets
            int256 finalNotional;

            (ifCashBitmap, finalNotional) = addifCashAsset(
                account,
                currencyId,
                assets[i].maturity,
                accountContext.nextSettleTime,
                assets[i].notional,
                ifCashBitmap
            );

            if (finalNotional < 0)
                accountContext.hasDebt = accountContext.hasDebt | Constants.HAS_ASSET_DEBT;
        }

        setAssetsBitmap(account, currencyId, ifCashBitmap);
    }

    /// @notice Add an ifCash asset in the bitmap and mapping. Updates the bitmap in memory
    /// but not in storage.
    function addifCashAsset(
        address account,
        uint256 currencyId,
        uint256 maturity,
        uint256 nextSettleTime,
        int256 notional,
        bytes32 assetsBitmap
    ) internal returns (bytes32, int256) {
        bytes32 fCashSlot = getifCashSlot(account, currencyId, maturity);
        (uint256 bitNum, bool isExact) = DateTime.getBitNumFromMaturity(nextSettleTime, maturity);
        require(isExact); // dev: invalid maturity in set ifcash asset

        if (assetsBitmap.isBitSet(bitNum)) {
            // Bit is set so we read and update the notional amount
            int256 existingNotional;
            assembly {
                existingNotional := sload(fCashSlot)
            }
            existingNotional = existingNotional.add(notional);

            require(existingNotional >= type(int128).min && existingNotional <= type(int128).max); // dev: bitmap notional overflow
            assembly {
                sstore(fCashSlot, existingNotional)
            }

            // If the new notional is zero then turn off the bit
            if (existingNotional == 0) {
                assetsBitmap = assetsBitmap.setBit(bitNum, false);
            }

            return (assetsBitmap, existingNotional);
        }

        if (notional != 0) {
            // Bit is not set so we turn it on and update the mapping directly, no read required.
            require(notional >= type(int128).min && notional <= type(int128).max); // dev: bitmap notional overflow
            assembly {
                sstore(fCashSlot, notional)
            }
            assetsBitmap = assetsBitmap.setBit(bitNum, true);
        }

        return (assetsBitmap, notional);
    }

    /// @notice Returns the present value of an asset
    function getPresentValue(
        address account,
        uint256 currencyId,
        uint256 maturity,
        uint256 blockTime,
        CashGroupParameters memory cashGroup,
        bool riskAdjusted
    ) internal view returns (int256) {
        int256 notional = getifCashNotional(account, currencyId, maturity);

        // In this case the asset has matured and the total value is just the notional amount
        if (maturity <= blockTime) return notional;

        uint256 oracleRate = cashGroup.calculateOracleRate(maturity, blockTime);
        if (riskAdjusted) {
            return
                AssetHandler.getRiskAdjustedPresentValue(
                    cashGroup,
                    notional,
                    maturity,
                    blockTime,
                    oracleRate
                );
        }

        return AssetHandler.getPresentValue(notional, maturity, blockTime, oracleRate);
    }

    /// @notice Get the net present value of all the ifCash assets
    function getifCashNetPresentValue(
        address account,
        uint256 currencyId,
        uint256 nextSettleTime,
        uint256 blockTime,
        bytes32 assetsBitmap,
        CashGroupParameters memory cashGroup,
        bool riskAdjusted
    ) internal view returns (int256, bool) {
        int256 totalValueUnderlying;
        bool hasDebt;

        uint256 bitNum = assetsBitmap.getNextBitNum();
        while (bitNum != 0) {
            uint256 maturity = DateTime.getMaturityFromBitNum(nextSettleTime, bitNum);
            int256 pv =
                getPresentValue(
                    account,
                    currencyId,
                    maturity,
                    blockTime,
                    cashGroup,
                    riskAdjusted
                );
            totalValueUnderlying = totalValueUnderlying.add(pv);

            if (pv < 0) hasDebt = true;

            // Turn off the bit and look for the next one
            assetsBitmap = assetsBitmap.setBit(bitNum, false);
            bitNum = assetsBitmap.getNextBitNum();
        }

        return (totalValueUnderlying, hasDebt);
    }

    /// @notice Returns the ifCash assets as an array
    function getifCashArray(
        address account,
        uint256 currencyId,
        uint256 nextSettleTime
    ) internal view returns (PortfolioAsset[] memory) {
        bytes32 assetsBitmap = getAssetsBitmap(account, currencyId);
        uint256 index = assetsBitmap.totalBitsSet();
        PortfolioAsset[] memory assets = new PortfolioAsset[](index);
        index = 0;

        uint256 bitNum = assetsBitmap.getNextBitNum();
        while (bitNum != 0) {
            uint256 maturity = DateTime.getMaturityFromBitNum(nextSettleTime, bitNum);
            int256 notional = getifCashNotional(account, currencyId, maturity);

            assets[index].currencyId = currencyId;
            assets[index].maturity = maturity;
            assets[index].assetType = Constants.FCASH_ASSET_TYPE;
            assets[index].notional = notional;
            index += 1;

            // Turn off the bit and look for the next one
            assetsBitmap = assetsBitmap.setBit(bitNum, false);
            bitNum = assetsBitmap.getNextBitNum();
        }

        return assets;
    }

    /// @notice Used to reduce an nToken ifCash assets portfolio proportionately when redeeming
    /// nTokens to its underlying assets.
    function reduceifCashAssetsProportional(
        address account,
        uint256 currencyId,
        uint256 nextSettleTime,
        int256 tokensToRedeem,
        int256 totalSupply
    ) internal returns (PortfolioAsset[] memory) {
        bytes32 assetsBitmap = getAssetsBitmap(account, currencyId);
        uint256 index = assetsBitmap.totalBitsSet();
        PortfolioAsset[] memory assets = new PortfolioAsset[](index);
        index = 0;

        uint256 bitNum = assetsBitmap.getNextBitNum();
        while (bitNum != 0) {
            uint256 maturity = DateTime.getMaturityFromBitNum(nextSettleTime, bitNum);
            bytes32 fCashSlot = getifCashSlot(account, currencyId, maturity);
            int256 notional;
            assembly {
                notional := sload(fCashSlot)
            }

            int256 notionalToTransfer = notional.mul(tokensToRedeem).div(totalSupply);
            notional = notional.sub(notionalToTransfer);
            assembly {
                sstore(fCashSlot, notional)
            }

            assets[index].currencyId = currencyId;
            assets[index].maturity = maturity;
            assets[index].assetType = Constants.FCASH_ASSET_TYPE;
            assets[index].notional = notionalToTransfer;
            index += 1;

            // Turn off the bit and look for the next one
            assetsBitmap = assetsBitmap.setBit(bitNum, false);
            bitNum = assetsBitmap.getNextBitNum();
        }

        // If the entire token supply is redeemed then the assets bitmap will have been reduced to zero.
        // Because solidity truncates division there will always be dust left unless the entire supply is
        // redeemed.
        if (tokensToRedeem == totalSupply) {
            setAssetsBitmap(account, currencyId, 0x00);
        }

        return assets;
    }
}
