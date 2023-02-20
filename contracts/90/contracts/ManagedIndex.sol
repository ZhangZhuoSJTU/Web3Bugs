// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "./interfaces/IManagedIndex.sol";
import "./interfaces/IIndexFactory.sol";
import "./interfaces/IManagedIndexReweightingLogic.sol";

import "./BaseIndex.sol";

/// @title Managed index
/// @notice Contains initialization and reweighting logic
contract ManagedIndex is IManagedIndex, BaseIndex {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Role for index reweighting
    bytes32 private REWEIGHT_INDEX_ROLE;

    constructor() BaseIndex(msg.sender) {
        REWEIGHT_INDEX_ROLE = keccak256(abi.encodePacked("REWEIGHT_PERMISSION", address(this)));
    }

    /// @notice Index initialization with assets and their weights
    /// @dev Method is called by factory
    /// @param _assets Assets list for the index
    /// @param _weights List of assets corresponding weights
    function initialize(address[] calldata _assets, uint8[] calldata _weights) external {
        require(msg.sender == factory, "ManagedIndex: FORBIDDEN");

        for (uint i; i < _assets.length; ++i) {
            address asset = _assets[i];
            uint8 weight = _weights[i];

            weightOf[asset] = weight;
            assets.add(asset);

            emit UpdateAnatomy(asset, weight);
        }
    }

    /// @inheritdoc IManagedIndex
    /// @dev Assets total weight should be equal to 255
    function reweight(address[] calldata _updatedAssets, uint8[] calldata _updatedWeights) external override {
        require(
            IAccessControl(registry).hasRole(INDEX_MANAGER_ROLE, msg.sender) ||
                IAccessControl(registry).hasRole(REWEIGHT_INDEX_ROLE, msg.sender),
            "ManagedIndex: FORBIDDEN"
        );
        (bool success, bytes memory data) = IIndexFactory(factory).reweightingLogic().delegatecall(
            abi.encodeWithSelector(IManagedIndexReweightingLogic.reweight.selector, _updatedAssets, _updatedWeights)
        );
        if (!success) {
            if (data.length == 0) {
                revert("ManagedIndex: REWEIGH_FAILED");
            } else {
                assembly {
                    revert(add(32, data), mload(data))
                }
            }
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(IManagedIndex).interfaceId || super.supportsInterface(_interfaceId);
    }
}
