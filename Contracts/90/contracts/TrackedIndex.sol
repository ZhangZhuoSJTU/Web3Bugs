// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "./interfaces/IIndexFactory.sol";
import "./interfaces/IReweightableIndex.sol";
import "./interfaces/ITrackedIndexReweightingLogic.sol";

import "./BaseIndex.sol";

/// @title Tracked index
/// @notice  Contains initialization and reweighting logic
contract TrackedIndex is IReweightableIndex, BaseIndex {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Orderer role
    bytes32 internal constant ORDERER_ROLE = keccak256("ORDERER_ROLE");

    constructor() BaseIndex(msg.sender) {}

    /// @notice Initializes index with provided set of parameters
    /// @param _assets Assets list
    /// @param _capitalizations List of corresponding assets capitalizations
    /// @param _totalCapitalization Total capitalization of assets
    function initialize(
        address[] calldata _assets,
        uint[] calldata _capitalizations,
        uint _totalCapitalization
    ) external {
        require(msg.sender == factory, "TrackedIndex: FORBIDDEN");

        uint8 totalWeight;
        uint maxCapitalization = _capitalizations[0];
        address maxCapitalizationAsset = _assets[0];
        for (uint i; i < _assets.length; ++i) {
            address asset = _assets[i];
            uint8 weight = uint8((_capitalizations[i] * type(uint8).max) / _totalCapitalization);
            if (_capitalizations[i] > maxCapitalization) {
                emit UpdateAnatomy(maxCapitalizationAsset, weightOf[maxCapitalizationAsset]);
                maxCapitalization = _capitalizations[i];
                maxCapitalizationAsset = asset;
            }
            weightOf[asset] = weight;
            totalWeight += weight;
            assets.add(asset);
            if (asset != maxCapitalizationAsset) {
                emit UpdateAnatomy(asset, weight);
            }
        }
        if (totalWeight < IndexLibrary.MAX_WEIGHT) {
            weightOf[maxCapitalizationAsset] += IndexLibrary.MAX_WEIGHT - totalWeight;
        }
        emit UpdateAnatomy(maxCapitalizationAsset, weightOf[maxCapitalizationAsset]);
    }

    /// @notice Reweighs index assets according to the latest market cap data
    function reweight() external override onlyRole(ORDERER_ROLE) {
        (bool success, bytes memory data) = IIndexFactory(factory).reweightingLogic().delegatecall(
            abi.encodeWithSelector(ITrackedIndexReweightingLogic.reweight.selector)
        );
        if (!success) {
            if (data.length == 0) {
                revert("TrackedIndex: REWEIGH_FAILED");
            } else {
                assembly {
                    revert(add(32, data), mload(data))
                }
            }
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(IReweightableIndex).interfaceId || super.supportsInterface(_interfaceId);
    }
}
