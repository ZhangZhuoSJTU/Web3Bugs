// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./libraries/IndexLibrary.sol";

import "./interfaces/IvToken.sol";
import "./interfaces/IOrderer.sol";
import "./interfaces/IvTokenFactory.sol";
import "./interfaces/IIndexRegistry.sol";
import "./interfaces/ITopNMarketCapCategories.sol";
import "./interfaces/ITopNMarketCapIndexFactory.sol";
import "./interfaces/ITopNMarketCapIndexReweightingLogic.sol";

import "./IndexLayout.sol";

/// @title TopNMarketCapIndex reweighing logic
/// @notice Contains reweighting logic
contract TopNMarketCapIndexReweightingLogic is IndexLayout, ITopNMarketCapIndexReweightingLogic, ERC165 {
    using FullMath for uint;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Asset role
    bytes32 internal constant ASSET_ROLE = keccak256("ASSET_ROLE");

    /// @inheritdoc ITopNMarketCapIndexReweightingLogic
    function reweight(
        uint _category,
        uint _snapshotId,
        uint _topN
    ) external override returns (uint) {
        IPhuturePriceOracle oracle = IPhuturePriceOracle(IIndexRegistry(registry).priceOracle());
        uint virtualEvaluationInBase;
        for (uint i; i < assets.length(); ++i) {
            uint priceAssetPerBaseInUQ = oracle.refreshedAssetPerBaseInUQ(assets.at(i));
            uint availableAssets = IvToken(IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(assets.at(i)))
                .assetBalanceOf(address(this));
            virtualEvaluationInBase += availableAssets.mulDiv(FixedPoint112.Q112, priceAssetPerBaseInUQ);
        }
        ITopNMarketCapCategories.DiffDetails memory diff = ITopNMarketCapCategories(
            ITopNMarketCapIndexFactory(factory).marketCapCategories()
        ).assetDiff(_category, _snapshotId, _topN);

        IOrderer orderer = IOrderer(IIndexRegistry(registry).orderer());
        uint orderId = orderer.placeOrder();

        uint8 _totalWeight;
        for (uint _i; _i < diff.assetCount; ++_i) {
            uint i = diff.assetCount - 1 - _i;
            address asset = diff.assets[i].asset;
            IvToken vToken = IvToken(IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(asset));
            if (diff.assets[i].isRemoved) {
                {
                    uint shares = vToken.balanceOf(address(this));
                    if (shares > 0) {
                        inactiveAssets.add(asset);
                    }
                    delete weightOf[asset];
                    assets.remove(asset);
                    emit UpdateAnatomy(asset, 0);
                }
            } else {
                // diff guarantees that updated assets go before the removed assets
                require(IAccessControl(registry).hasRole(ASSET_ROLE, asset), "TopNMarketCapIndex: INVALID_ASSET");
                {
                    uint8 weight;
                    if (i == 0) {
                        weight = IndexLibrary.MAX_WEIGHT - _totalWeight;
                    } else {
                        weight = uint8(
                            (diff.assets[i].capitalizationInBase * type(uint8).max) / diff.totalCapitalizationInBase
                        );
                    }
                    weightOf[asset] = weight;
                    _totalWeight += weight;
                    if (weight > 0) {
                        assets.add(asset);
                        inactiveAssets.remove(asset);
                    } else {
                        assets.remove(asset);
                        inactiveAssets.add(asset);
                    }
                    emit UpdateAnatomy(asset, weight);
                }
                {
                    uint amountInBase = (virtualEvaluationInBase * weightOf[asset]) / IndexLibrary.MAX_WEIGHT;
                    uint amountInAsset = amountInBase.mulDiv(
                        oracle.refreshedAssetPerBaseInUQ(asset),
                        FixedPoint112.Q112
                    );
                    (uint newShares, uint oldShares) = vToken.shareChange(address(this), amountInAsset);
                    if (newShares > oldShares) {
                        orderer.addOrderDetails(orderId, asset, newShares - oldShares, IOrderer.OrderSide.Buy);
                    } else if (oldShares > newShares) {
                        orderer.addOrderDetails(orderId, asset, oldShares - newShares, IOrderer.OrderSide.Sell);
                    }
                }
            }
        }
        address[] memory _inactiveAssets = inactiveAssets.values();
        for (uint i; i < _inactiveAssets.length; ++i) {
            uint shares = IvToken(IvTokenFactory(vTokenFactory).vTokenOf(_inactiveAssets[i])).balanceOf(address(this));
            if (shares > 0) {
                orderer.addOrderDetails(orderId, _inactiveAssets[i], shares, IOrderer.OrderSide.Sell);
            } else {
                inactiveAssets.remove(_inactiveAssets[i]);
            }
        }
        return diff.snapshotId;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return
            _interfaceId == type(ITopNMarketCapIndexReweightingLogic).interfaceId ||
            super.supportsInterface(_interfaceId);
    }
}
