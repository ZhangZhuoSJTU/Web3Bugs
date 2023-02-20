// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./PortfolioHandler.sol";
import "./BitmapAssetsHandler.sol";
import "../AccountContextHandler.sol";
import "../../external/SettleAssetsExternal.sol";

/// @notice Helper library for transferring assets from one portfolio to another
library TransferAssets {
    using AccountContextHandler for AccountContext;
    using PortfolioHandler for PortfolioState;
    using SafeInt256 for int256;

    /// @notice Decodes asset ids
    function decodeAssetId(uint256 id)
        internal
        pure
        returns (
            uint16 currencyId,
            uint40 maturity,
            uint8 assetType
        )
    {
        currencyId = uint16(uint256(bytes32(id) >> 48));
        maturity = uint40(uint256(bytes32(id) >> 8));
        assetType = uint8(uint256(bytes32(id)));
    }

    /// @notice Encodes asset ids
    function encodeAssetId(
        uint256 currencyId,
        uint256 maturity,
        uint256 assetType
    ) internal pure returns (uint256) {
        return
            uint256(
                (bytes32(uint256(uint16(currencyId))) << 48) |
                    (bytes32(uint256(uint40(maturity))) << 8) |
                    bytes32(uint256(uint8(assetType)))
            );
    }

    /// @dev Used to flip the sign of assets to decrement the `from` account that is sending assets
    function invertNotionalAmountsInPlace(PortfolioAsset[] memory assets) internal pure {
        for (uint256 i; i < assets.length; i++) {
            assets[i].notional = assets[i].notional.neg();
        }
    }

    /// @dev Useful method for hiding the logic of updating an account. WARNING: the account
    /// context returned from this method may not be the same memory location as the account
    /// context provided if the account is settled.
    function placeAssetsInAccount(
        address account,
        AccountContext memory accountContext,
        PortfolioAsset[] memory assets
    ) internal returns (AccountContext memory) {
        if (accountContext.bitmapCurrencyId == 0) {
            return _addAssetsToPortfolio(account, accountContext, assets);
        } else {
            return _addAssetsToBitmap(account, accountContext, assets);
        }
    }

    function _addAssetsToPortfolio(
        address account,
        AccountContext memory accountContext,
        PortfolioAsset[] memory assets
    ) private returns (AccountContext memory) {
        PortfolioState memory portfolioState;
        if (accountContext.mustSettleAssets()) {
            // accountContext may change memory locations after this returns
            (accountContext, portfolioState) = SettleAssetsExternal.settleAssetsAndReturnPortfolio(
                account,
                accountContext
            );
        } else {
            portfolioState = PortfolioHandler.buildPortfolioState(
                account,
                accountContext.assetArrayLength,
                assets.length
            );
        }

        portfolioState.addMultipleAssets(assets);
        accountContext.storeAssetsAndUpdateContext(account, portfolioState, false);

        return accountContext;
    }

    function _addAssetsToBitmap(
        address account,
        AccountContext memory accountContext,
        PortfolioAsset[] memory assets
    ) private returns (AccountContext memory) {
        if (accountContext.mustSettleAssets()) {
            accountContext = SettleAssetsExternal.settleAssetsAndFinalize(account, accountContext);
        }

        BitmapAssetsHandler.addMultipleifCashAssets(account, accountContext, assets);

        return accountContext;
    }
}
