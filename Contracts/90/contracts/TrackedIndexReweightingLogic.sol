// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./libraries/IndexLibrary.sol";

import "./interfaces/IvToken.sol";
import "./interfaces/IOrderer.sol";
import "./interfaces/IvTokenFactory.sol";
import "./interfaces/IIndexRegistry.sol";
import "./interfaces/ITrackedIndexReweightingLogic.sol";

import "./IndexLayout.sol";

/// @title TrackedIndex reweighing logic
/// @notice  Contains reweighing logic
contract TrackedIndexReweightingLogic is IndexLayout, ITrackedIndexReweightingLogic, ERC165 {
    using FullMath for uint;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Asset role
    bytes32 internal constant ASSET_ROLE = keccak256("ASSET_ROLE");

    /// @inheritdoc ITrackedIndexReweightingLogic
    function reweight() external override {
        IPhuturePriceOracle oracle = IPhuturePriceOracle(IIndexRegistry(registry).priceOracle());
        (uint[] memory _capitalizations, uint _totalCapitalization) = IIndexRegistry(registry).marketCapsOf(
            assets.values()
        );
        uint virtualEvaluationInBase;
        uint8 totalWeight;
        uint maxCapitalization = _capitalizations[0];
        address maxCapitalizationAsset = assets.at(0);
        for (uint i; i < assets.length(); ++i) {
            require(IAccessControl(registry).hasRole(ASSET_ROLE, assets.at(i)), "TrackedIndex: INVALID_ASSET");

            uint priceAssetPerBaseInUQ = oracle.refreshedAssetPerBaseInUQ(assets.at(i));
            uint availableAssets = IvToken(IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(assets.at(i)))
                .assetBalanceOf(address(this));
            virtualEvaluationInBase += availableAssets.mulDiv(FixedPoint112.Q112, priceAssetPerBaseInUQ);
            address asset = assets.at(i);
            uint8 weight = uint8((_capitalizations[i] * type(uint8).max) / _totalCapitalization);
            if (_capitalizations[i] > maxCapitalization) {
                emit UpdateAnatomy(maxCapitalizationAsset, weightOf[maxCapitalizationAsset]);
                maxCapitalization = _capitalizations[i];
                maxCapitalizationAsset = asset;
            }
            weightOf[asset] = weight;
            totalWeight += weight;
            if (asset != maxCapitalizationAsset) {
                emit UpdateAnatomy(asset, weight);
            }
        }

        if (totalWeight < IndexLibrary.MAX_WEIGHT) {
            weightOf[maxCapitalizationAsset] += IndexLibrary.MAX_WEIGHT - totalWeight;
        }
        emit UpdateAnatomy(maxCapitalizationAsset, weightOf[maxCapitalizationAsset]);

        IOrderer orderer = IOrderer(IIndexRegistry(registry).orderer());
        uint orderId = orderer.placeOrder();

        for (uint i; i < assets.length(); ++i) {
            address asset = assets.at(i);
            uint amountInBase = (virtualEvaluationInBase * weightOf[asset]) / IndexLibrary.MAX_WEIGHT;
            uint amountInAsset = amountInBase.mulDiv(oracle.refreshedAssetPerBaseInUQ(asset), FixedPoint112.Q112);
            (uint newShares, uint oldShares) = IvToken(IvTokenFactory(vTokenFactory).vTokenOf(asset)).shareChange(
                address(this),
                amountInAsset
            );
            if (newShares > oldShares) {
                orderer.addOrderDetails(orderId, asset, newShares - oldShares, IOrderer.OrderSide.Buy);
            } else if (oldShares > newShares) {
                orderer.addOrderDetails(orderId, asset, oldShares - newShares, IOrderer.OrderSide.Sell);
            }
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(ITrackedIndexReweightingLogic).interfaceId || super.supportsInterface(_interfaceId);
    }
}
