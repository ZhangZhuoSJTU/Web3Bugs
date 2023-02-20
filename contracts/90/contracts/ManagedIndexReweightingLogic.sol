// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./libraries/IndexLibrary.sol";

import "./interfaces/IvToken.sol";
import "./interfaces/IOrderer.sol";
import "./interfaces/IvTokenFactory.sol";
import "./interfaces/IIndexRegistry.sol";
import "./interfaces/IManagedIndexReweightingLogic.sol";

import "./IndexLayout.sol";

/// @title ManagedIndex reweighting logic
/// @notice Contains reweighting logic
contract ManagedIndexReweightingLogic is IndexLayout, IManagedIndexReweightingLogic, ERC165 {
    using FullMath for uint;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Asset role
    bytes32 internal constant ASSET_ROLE = keccak256("ASSET_ROLE");

    /// @inheritdoc IManagedIndexReweightingLogic
    function reweight(address[] calldata _updatedAssets, uint8[] calldata _updatedWeights) external override {
        require(
            _updatedAssets.length > 1 &&
                _updatedWeights.length == _updatedAssets.length &&
                _updatedAssets.length <= IIndexRegistry(registry).maxComponents(),
            "ManagedIndex: INVALID"
        );

        uint virtualEvaluationInBase;
        IPhuturePriceOracle oracle = IPhuturePriceOracle(IIndexRegistry(registry).priceOracle());
        for (uint i; i < assets.length(); ++i) {
            uint priceAssetPerBaseInUQ = oracle.refreshedAssetPerBaseInUQ(assets.at(i));
            uint availableAssets = IvToken(IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(assets.at(i)))
                .assetBalanceOf(address(this));
            virtualEvaluationInBase += availableAssets.mulDiv(FixedPoint112.Q112, priceAssetPerBaseInUQ);
        }

        IOrderer orderer = IOrderer(IIndexRegistry(registry).orderer());
        uint orderId = orderer.placeOrder();

        uint _totalWeight = IndexLibrary.MAX_WEIGHT;

        for (uint i; i < _updatedAssets.length; ++i) {
            address asset = _updatedAssets[i];
            require(asset != address(0), "ManagedIndex: ZERO");

            uint8 newWeight = _updatedWeights[i];

            if (i > 0) {
                // makes sure that there are no duplicate assets
                require(_updatedAssets[i - 1] < asset, "ManagedIndex: SORT");
            }

            if (newWeight > 0) {
                require(IAccessControl(registry).hasRole(ASSET_ROLE, asset), "ManagedIndex: INVALID_ASSET");
                assets.add(asset);
                inactiveAssets.remove(asset);

                uint8 prevWeight = weightOf[asset];
                if (prevWeight != newWeight) {
                    emit UpdateAnatomy(asset, newWeight);
                }

                _totalWeight = _totalWeight + newWeight - prevWeight;
                weightOf[asset] = newWeight;

                uint amountInBase = (virtualEvaluationInBase * weightOf[asset]) / IndexLibrary.MAX_WEIGHT;
                uint amountInAsset = amountInBase.mulDiv(oracle.refreshedAssetPerBaseInUQ(asset), FixedPoint112.Q112);
                (uint newShares, uint oldShares) = IvToken(IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(asset))
                    .shareChange(address(this), amountInAsset);

                if (newShares > oldShares) {
                    orderer.addOrderDetails(orderId, asset, newShares - oldShares, IOrderer.OrderSide.Buy);
                } else if (oldShares > newShares) {
                    orderer.addOrderDetails(orderId, asset, oldShares - newShares, IOrderer.OrderSide.Sell);
                }
            } else {
                require(assets.remove(asset), "ManagedIndex: INVALID");
                inactiveAssets.add(asset);

                _totalWeight -= weightOf[asset];

                delete weightOf[asset];

                emit UpdateAnatomy(asset, 0);
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
        require(_totalWeight == IndexLibrary.MAX_WEIGHT, "ManagedIndex: MAX");
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(IManagedIndexReweightingLogic).interfaceId || super.supportsInterface(_interfaceId);
    }
}
