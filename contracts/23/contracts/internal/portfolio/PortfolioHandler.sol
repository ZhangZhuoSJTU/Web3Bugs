// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./TransferAssets.sol";
import "../valuation/AssetHandler.sol";
import "../../math/SafeInt256.sol";

/// @notice Handles the management of an array of assets including reading from storage, inserting
/// updating, deleting and writing back to storage.
library PortfolioHandler {
    using SafeInt256 for int256;
    using AssetHandler for PortfolioAsset;

    /// @notice Primarily used by the TransferAssets library
    function addMultipleAssets(PortfolioState memory portfolioState, PortfolioAsset[] memory assets)
        internal
        pure
    {
        for (uint256 i; i < assets.length; i++) {
            if (assets[i].notional == 0) continue;

            addAsset(
                portfolioState,
                assets[i].currencyId,
                assets[i].maturity,
                assets[i].assetType,
                assets[i].notional
            );
        }
    }

    function _mergeAssetIntoArray(
        PortfolioAsset[] memory assetArray,
        uint256 currencyId,
        uint256 maturity,
        uint256 assetType,
        int256 notional
    ) private pure returns (bool) {
        for (uint256 i; i < assetArray.length; i++) {
            if (assetArray[i].assetType != assetType) continue;
            if (assetArray[i].currencyId != currencyId) continue;
            if (assetArray[i].maturity != maturity) continue;

            // If the storage index is -1 this is because it's been deleted from settlement. We cannot
            // add fcash that has been settled.
            require(assetArray[i].storageState != AssetStorageState.Delete); // dev: portfolio handler deleted storage

            int256 newNotional = assetArray[i].notional.add(notional);
            // Liquidity tokens cannot be reduced below zero.
            if (AssetHandler.isLiquidityToken(assetType)) {
                require(newNotional >= 0); // dev: portfolio handler negative liquidity token balance
            }

            require(newNotional >= type(int88).min && newNotional <= type(int88).max); // dev: portfolio handler notional overflow

            assetArray[i].notional = newNotional;
            assetArray[i].storageState = AssetStorageState.Update;

            return true;
        }

        return false;
    }

    /// @notice Adds an asset to a portfolio state in memory (does not write to storage)
    /// @dev Ensures that only one version of an asset exists in a portfolio (i.e. does not allow two fCash assets of the same maturity
    /// to exist in a single portfolio). Also ensures that liquidity tokens do not have a negative notional.
    function addAsset(
        PortfolioState memory portfolioState,
        uint256 currencyId,
        uint256 maturity,
        uint256 assetType,
        int256 notional
    ) internal pure {
        if (
            // Will return true if merged
            _mergeAssetIntoArray(
                portfolioState.storedAssets,
                currencyId,
                maturity,
                assetType,
                notional
            )
        ) return;

        if (portfolioState.lastNewAssetIndex > 0) {
            bool merged = _mergeAssetIntoArray(
                portfolioState.newAssets,
                currencyId,
                maturity,
                assetType,
                notional
            );
            if (merged) return;
        }

        // At this point if we have not merged the asset then append to the array
        // Cannot remove liquidity that the portfolio does not have
        if (AssetHandler.isLiquidityToken(assetType)) {
            require(notional >= 0); // dev: portfolio handler negative liquidity token balance
        }
        require(notional >= type(int88).min && notional <= type(int88).max); // dev: portfolio handler notional overflow

        // Need to provision a new array at this point
        if (portfolioState.lastNewAssetIndex == portfolioState.newAssets.length) {
            portfolioState.newAssets = _extendNewAssetArray(portfolioState.newAssets);
        }

        // Otherwise add to the new assets array. It should not be possible to add matching assets in a single transaction, we will
        // check this again when we write to storage.
        portfolioState.newAssets[portfolioState.lastNewAssetIndex].currencyId = currencyId;
        portfolioState.newAssets[portfolioState.lastNewAssetIndex].maturity = maturity;
        portfolioState.newAssets[portfolioState.lastNewAssetIndex].assetType = assetType;
        portfolioState.newAssets[portfolioState.lastNewAssetIndex].notional = notional;
        portfolioState.newAssets[portfolioState.lastNewAssetIndex].storageState = AssetStorageState
            .NoChange;
        portfolioState.lastNewAssetIndex += 1;
    }

    /// @dev Extends the new asset array if it is not large enough, this is likely to get a bit expensive if we do
    /// it too much
    function _extendNewAssetArray(PortfolioAsset[] memory newAssets)
        private
        pure
        returns (PortfolioAsset[] memory)
    {
        PortfolioAsset[] memory extendedArray = new PortfolioAsset[](newAssets.length + 1);
        for (uint256 i; i < newAssets.length; i++) {
            extendedArray[i] = newAssets[i];
        }

        return extendedArray;
    }

    /// @notice Takes a portfolio state and writes it to storage.
    /// @dev This method should only be called directly by the nToken. Account updates to portfolios should happen via
    /// the storeAssetsAndUpdateContext call in the AccountContextHandler.sol library.
    function storeAssets(PortfolioState memory portfolioState, address account)
        internal
        returns (
            bool,
            bytes32,
            uint8,
            uint40
        )
    {
        uint256 initialSlot = uint256(
            keccak256(abi.encode(account, Constants.PORTFOLIO_ARRAY_STORAGE_OFFSET))
        );
        bool hasDebt;
        // NOTE: cannot have more than 16 assets or this byte object will overflow. Max assets is
        // set to 7 and the worst case during liquidation would be 7 liquidity tokens that generate
        // 7 additional fCash assets for a total of 14 assets. Although even in this case all assets
        // would be of the same currency so it would not change the end result of the active currency
        // calculation.
        bytes32 portfolioActiveCurrencies;
        uint256 nextSettleTime;

        // Mark any zero notional assets as deleted
        for (uint256 i; i < portfolioState.storedAssets.length; i++) {
            if (
                portfolioState.storedAssets[i].storageState != AssetStorageState.Delete &&
                portfolioState.storedAssets[i].notional == 0
            ) {
                deleteAsset(portfolioState, i);
            }
        }

        // First delete assets from asset storage to maintain asset storage indexes
        for (uint256 i; i < portfolioState.storedAssets.length; i++) {
            PortfolioAsset memory asset = portfolioState.storedAssets[i];

            if (asset.storageState == AssetStorageState.Delete) {
                // Delete asset from storage
                uint256 currentSlot = asset.storageSlot;
                assembly {
                    sstore(currentSlot, 0x00)
                }
                continue;
            }

            if (portfolioState.storedAssets[i].storageState == AssetStorageState.Update) {
                // Apply updates
                uint256 currentSlot = asset.storageSlot;
                bytes32 encodedAsset = _encodeAssetToBytes(portfolioState.storedAssets[i]);
                assembly {
                    sstore(currentSlot, encodedAsset)
                }
            }

            (hasDebt, portfolioActiveCurrencies, nextSettleTime) = _updatePortfolioContext(
                asset,
                hasDebt,
                portfolioActiveCurrencies,
                nextSettleTime
            );
        }

        // Add new assets
        uint256 assetStorageLength = portfolioState.storedAssetLength;
        for (uint256 i; i < portfolioState.newAssets.length; i++) {
            PortfolioAsset memory asset = portfolioState.newAssets[i];
            if (asset.notional == 0) continue;

            bytes32 encodedAsset = _encodeAssetToBytes(portfolioState.newAssets[i]);
            uint256 newAssetSlot = initialSlot + assetStorageLength;

            (hasDebt, portfolioActiveCurrencies, nextSettleTime) = _updatePortfolioContext(
                asset,
                hasDebt,
                portfolioActiveCurrencies,
                nextSettleTime
            );

            assembly {
                sstore(newAssetSlot, encodedAsset)
            }
            assetStorageLength += 1;
        }

        return (
            hasDebt,
            portfolioActiveCurrencies,
            uint8(assetStorageLength),
            uint40(nextSettleTime)
        );
    }

    /// @notice Updates context information during the store assets method
    function _updatePortfolioContext(
        PortfolioAsset memory asset,
        bool hasDebt,
        bytes32 portfolioActiveCurrencies,
        uint256 nextSettleTime
    )
        private
        pure
        returns (
            bool,
            bytes32,
            uint256
        )
    {
        if (nextSettleTime == 0 || nextSettleTime > asset.getSettlementDate()) {
            nextSettleTime = asset.getSettlementDate();
        }
        hasDebt = hasDebt || asset.notional < 0;
        portfolioActiveCurrencies =
            (portfolioActiveCurrencies >> 16) |
            (bytes32(asset.currencyId) << 240);

        return (hasDebt, portfolioActiveCurrencies, nextSettleTime);
    }

    /// @dev Encodes assets for storage
    function _encodeAssetToBytes(PortfolioAsset memory asset) internal pure returns (bytes32) {
        require(asset.currencyId > 0 && asset.currencyId <= type(uint16).max); // dev: encode asset currency id overflow
        require(asset.maturity > 0 && asset.maturity <= type(uint40).max); // dev: encode asset maturity overflow
        require(asset.assetType > 0 && asset.assetType <= Constants.MAX_LIQUIDITY_TOKEN_INDEX); // dev: encode asset type invalid
        require(asset.notional >= type(int88).min && asset.notional <= type(int88).max); // dev: encode asset notional overflow

        return (bytes32(asset.currencyId) |
            (bytes32(asset.maturity) << 16) |
            (bytes32(asset.assetType) << 56) |
            (bytes32(asset.notional) << 64));
    }

    /// @notice Deletes an asset from a portfolio
    /// @dev This method should only be called during settlement, assets can only be removed from a portfolio before settlement
    /// by adding the offsetting negative position
    function deleteAsset(PortfolioState memory portfolioState, uint256 index) internal pure {
        require(index < portfolioState.storedAssets.length); // dev: stored assets bounds
        require(portfolioState.storedAssetLength > 0); // dev: stored assets length is zero
        require(portfolioState.storedAssets[index].storageState != AssetStorageState.Delete); // dev: cannot re-delete asset

        portfolioState.storedAssetLength -= 1;

        uint256 maxActiveSlotIndex;
        uint256 maxActiveSlot;
        // The max active slot is the last storage slot where an asset exists, it's not clear where this will be in the
        // array so we search for it here.
        for (uint256 i; i < portfolioState.storedAssets.length; i++) {
            if (
                portfolioState.storedAssets[i].storageSlot > maxActiveSlot &&
                portfolioState.storedAssets[i].storageState != AssetStorageState.Delete
            ) {
                maxActiveSlot = portfolioState.storedAssets[i].storageSlot;
                maxActiveSlotIndex = i;
            }
        }

        if (index == maxActiveSlotIndex) {
            // In this case we are deleting the asset with the max storage slot so no swap is necessary.
            portfolioState.storedAssets[index].storageState = AssetStorageState.Delete;
            return;
        }

        // Swap the storage slots of the deleted asset with the last non-deleted asset in the array. Mark them accordingly
        // so that when we call store assets they will be updated appropriately
        (
            portfolioState.storedAssets[maxActiveSlotIndex].storageSlot,
            portfolioState.storedAssets[index].storageSlot
        ) = (
            portfolioState.storedAssets[index].storageSlot,
            portfolioState.storedAssets[maxActiveSlotIndex].storageSlot
        );
        portfolioState.storedAssets[maxActiveSlotIndex].storageState = AssetStorageState.Update;
        portfolioState.storedAssets[index].storageState = AssetStorageState.Delete;
    }

    /// @notice Returns a portfolio array, will be sorted
    function getSortedPortfolio(address account, uint8 assetArrayLength)
        internal
        view
        returns (PortfolioAsset[] memory)
    {
        PortfolioAsset[] memory assets = _loadAssetArray(account, assetArrayLength);
        // No sorting required for length of 1
        if (assets.length <= 1) return assets;

        _quickSortInPlace(assets, 0, int256(assets.length) - 1);
        return assets;
    }

    /// @notice Builds a portfolio array from storage. The new assets hint parameter will
    /// be used to provision a new array for the new assets. This will increase gas efficiency
    /// so that we don't have to make copies when we extend the array.
    function buildPortfolioState(
        address account,
        uint8 assetArrayLength,
        uint256 newAssetsHint
    ) internal view returns (PortfolioState memory) {
        PortfolioState memory state;
        if (assetArrayLength == 0) return state;

        state.storedAssets = getSortedPortfolio(account, assetArrayLength);
        state.storedAssetLength = assetArrayLength;
        state.newAssets = new PortfolioAsset[](newAssetsHint);

        return state;
    }

    /// @dev These ids determine the sort order of assets
    function _getEncodedId(PortfolioAsset memory asset) private pure returns (uint256) {
        return TransferAssets.encodeAssetId(asset.currencyId, asset.maturity, asset.assetType);
    }

    function _quickSortInPlace(
        PortfolioAsset[] memory assets,
        int256 left,
        int256 right
    ) private pure {
        if (left == right) return;
        int256 i = left;
        int256 j = right;

        uint256 pivot = _getEncodedId(assets[uint256(left + (right - left) / 2)]);
        while (i <= j) {
            while (_getEncodedId(assets[uint256(i)]) < pivot) i++;
            while (pivot < _getEncodedId(assets[uint256(j)])) j--;
            if (i <= j) {
                (assets[uint256(i)], assets[uint256(j)]) = (assets[uint256(j)], assets[uint256(i)]);
                i++;
                j--;
            }
        }

        if (left < j) _quickSortInPlace(assets, left, j);
        if (i < right) _quickSortInPlace(assets, i, right);
    }

    function _loadAssetArray(address account, uint8 length)
        private
        view
        returns (PortfolioAsset[] memory)
    {
        PortfolioAsset[] memory assets = new PortfolioAsset[](length);
        uint256 slot = uint256(
            keccak256(abi.encode(account, Constants.PORTFOLIO_ARRAY_STORAGE_OFFSET))
        );

        for (uint256 i; i < length; i++) {
            bytes32 data;
            assembly {
                data := sload(slot)
            }

            assets[i].currencyId = uint256(uint16(uint256(data)));
            assets[i].maturity = uint256(uint40(uint256(data >> 16)));
            assets[i].assetType = uint256(uint8(uint256(data >> 56)));
            assets[i].notional = int256(int88(uint256(data >> 64)));
            assets[i].storageSlot = slot;
            slot = slot + 1;
        }

        return assets;
    }
}
