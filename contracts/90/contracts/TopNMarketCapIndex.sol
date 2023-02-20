// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "./interfaces/IIndexFactory.sol";
import "./interfaces/IReweightableIndex.sol";
import "./interfaces/ITopNMarketCapIndexReweightingLogic.sol";

import "./BaseIndex.sol";

/// @title Top N market capitalization index
/// @notice Contains initialization and reweighting logic
/// @dev This index reweighs according to the latest data from the TopNMarketCapCategories contract
contract TopNMarketCapIndex is IReweightableIndex, BaseIndex {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Orderer role
    bytes32 internal constant ORDERER_ROLE = keccak256("ORDERER_ROLE");

    /// @notice Number of assets used in the index
    uint8 public topN;
    /// @notice Category identifier used for the given index
    uint public category;

    /// @notice Latest category snapshot to track diff
    uint private snapshot;

    constructor() BaseIndex(msg.sender) {}

    /// @notice Initializes index with provided set of parameters
    /// @param _topN Number of assets used in the index
    /// @param _category Category identifier used for the given index
    /// @param _snapshot Initial snapshot from the category
    /// @param _assets Assets list
    /// @param _capitalizations List of corresponding assets capitalizations
    /// @param _totalCapitalization Total capitalization of assets
    function initialize(
        uint8 _topN,
        uint _category,
        uint _snapshot,
        address[] calldata _assets,
        uint[] calldata _capitalizations,
        uint _totalCapitalization
    ) external {
        require(msg.sender == factory, "TopNMarketCapIndex: FORBIDDEN");

        uint8 _totalWeight;
        for (uint i; i < _assets.length; ++i) {
            uint _i = _assets.length - 1 - i;
            address asset = _assets[_i];
            uint8 weight = _i == 0
                ? IndexLibrary.MAX_WEIGHT - _totalWeight
                : uint8((_capitalizations[_i] * type(uint8).max) / _totalCapitalization);
            weightOf[asset] = weight;
            require(asset != address(0), "TopNMarketCapIndex: ZERO");
            if (weight > 0) {
                assets.add(asset);
                _totalWeight += weight;
                emit UpdateAnatomy(asset, weight);
            }
        }
        snapshot = _snapshot;
        category = _category;
        topN = _topN;
    }

    /// @notice Reweighs index assets according to the latest market cap data for specified category
    function reweight() external override onlyRole(ORDERER_ROLE) {
        (bool success, bytes memory data) = IIndexFactory(factory).reweightingLogic().delegatecall(
            abi.encodeWithSelector(ITopNMarketCapIndexReweightingLogic.reweight.selector, category, snapshot, topN)
        );
        if (!success) {
            if (data.length == 0) {
                revert("TopNMarketCapIndex: REWEIGH_FAILED");
            } else {
                assembly {
                    revert(add(32, data), mload(data))
                }
            }
        }
        snapshot = abi.decode(data, (uint));
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return _interfaceId == type(IReweightableIndex).interfaceId || super.supportsInterface(_interfaceId);
    }
}
