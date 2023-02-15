// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV2V3Interface.sol";

import "./libraries/FullMath.sol";
import "./libraries/FixedPoint112.sol";

import "./interfaces/IChainlinkPriceOracle.sol";

/// @title Chainlink price oracle
/// @notice Contains logic for getting asset's price from Chainlink data feed
/// @dev Oracle works through base asset which is set in initialize function
contract ChainlinkPriceOracle is IChainlinkPriceOracle, ERC165 {
    using FullMath for uint;

    struct AssetInfo {
        AggregatorV2V3Interface aggregator;
        uint8 answerDecimals;
        uint8 decimals;
        uint lastAssetPerBaseInUQ;
    }

    /// @notice Role allows configure asset related data/components
    bytes32 private constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");

    /// @notice Index registry address
    IAccessControl private immutable registry;

    /// @notice Chainlink aggregator for the base asset
    AggregatorV2V3Interface private immutable baseAggregator;

    /// @notice Number of decimals in base asset answer
    uint8 private immutable baseDecimals;

    /// @notice Number of decimals in base asset answer
    uint8 private immutable baseAnswerDecimals;

    /// @notice Infos of added assets
    mapping(address => AssetInfo) private assetInfoOf;

    constructor(
        address _registry,
        address _base,
        address _baseAggregator
    ) {
        require(_baseAggregator != address(0) && _base != address(0), "ChainlinkPriceOracle: ZERO");

        registry = IAccessControl(_registry);
        baseAnswerDecimals = AggregatorV2V3Interface(_baseAggregator).decimals();
        baseDecimals = IERC20Metadata(_base).decimals();
        baseAggregator = AggregatorV2V3Interface(_baseAggregator);
    }

    /// @inheritdoc IChainlinkPriceOracle
    function addAsset(address _asset, address _assetAggregator) external override {
        require(registry.hasRole(ASSET_MANAGER_ROLE, msg.sender), "ChainlinkPriceOracle: FORBIDDEN");
        require(_asset != address(0), "ChainlinkPriceOracle: ZERO");

        assetInfoOf[_asset] = AssetInfo({
            aggregator: AggregatorV2V3Interface(_assetAggregator),
            answerDecimals: AggregatorV2V3Interface(_assetAggregator).decimals(),
            decimals: IERC20Metadata(_asset).decimals(),
            lastAssetPerBaseInUQ: 0
        });

        refreshedAssetPerBaseInUQ(_asset);
    }

    /// @inheritdoc IPriceOracle
    function lastAssetPerBaseInUQ(address _asset) external view override returns (uint) {
        return assetInfoOf[_asset].lastAssetPerBaseInUQ;
    }

    /// @inheritdoc IPriceOracle
    function refreshedAssetPerBaseInUQ(address _asset) public override returns (uint) {
        AssetInfo storage assetInfo = assetInfoOf[_asset];

        (, int basePrice, , , ) = baseAggregator.latestRoundData();
        (, int quotePrice, , , ) = assetInfo.aggregator.latestRoundData();

        require(basePrice > 0 && quotePrice > 0, "ChainlinkPriceOracle: NEGATIVE");

        uint assetPerBaseInUQ = ((uint(basePrice) * 10**assetInfo.decimals).mulDiv(
            FixedPoint112.Q112,
            (uint(quotePrice) * 10**baseDecimals)
        ) * 10**assetInfo.answerDecimals) / 10**baseAnswerDecimals;
        assetInfo.lastAssetPerBaseInUQ = assetPerBaseInUQ;
        return assetPerBaseInUQ;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return
            _interfaceId == type(IChainlinkPriceOracle).interfaceId ||
            _interfaceId == type(IPriceOracle).interfaceId ||
            super.supportsInterface(_interfaceId);
    }
}
