// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./libraries/FullMath.sol";
import "./libraries/FixedPoint112.sol";

import "./interfaces/IUniswapV2PriceOracle.sol";
import "./interfaces/IUniswapV2PathPriceOracle.sol";

/// @title Uniswap path price oracle
/// @notice Contains logic for price calculation of asset which doesn't have a pair with a base asset
contract UniswapV2PathPriceOracle is IUniswapV2PathPriceOracle, ERC165 {
    using FullMath for uint;

    /// @notice List of assets to compose exchange pairs, where first element is input asset
    address[] private path;
    /// @notice List of corresponding price oracles for provided path
    address[] private oracles;

    constructor(address[] memory _path, address[] memory _oracles) {
        require(_path.length >= 2, "UniswapV2PathPriceOracle: PATH");
        require(_oracles.length == _path.length - 1, "UniswapV2PathPriceOracle: ORACLES");

        path = _path;
        oracles = _oracles;
    }

    /// @inheritdoc IPriceOracle
    function refreshedAssetPerBaseInUQ(address _asset) external override returns (uint currentAssetPerBaseInUQ) {
        currentAssetPerBaseInUQ = FixedPoint112.Q112;
        for (uint i = 0; i < path.length - 1; i++) {
            address asset = path[i + 1];
            currentAssetPerBaseInUQ = currentAssetPerBaseInUQ.mulDiv(
                IUniswapV2PriceOracle(oracles[i]).refreshedAssetPerBaseInUQ(asset),
                FixedPoint112.Q112
            );
            if (_asset == asset) {
                break;
            }
        }
    }

    /// @inheritdoc IPriceOracle
    function lastAssetPerBaseInUQ(address _asset) external view override returns (uint currentAssetPerBaseInUQ) {
        currentAssetPerBaseInUQ = FixedPoint112.Q112;
        for (uint i = 0; i < path.length - 1; i++) {
            address asset = path[i + 1];
            currentAssetPerBaseInUQ = currentAssetPerBaseInUQ.mulDiv(
                IUniswapV2PriceOracle(oracles[i]).lastAssetPerBaseInUQ(asset),
                FixedPoint112.Q112
            );
            if (_asset == asset) {
                break;
            }
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return
            _interfaceId == type(IUniswapV2PathPriceOracle).interfaceId ||
            _interfaceId == type(IPriceOracle).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    /// @inheritdoc IUniswapV2PathPriceOracle
    function anatomy() public view virtual override returns (address[] memory _path, address[] memory _oracles) {
        _path = path;
        _oracles = oracles;
    }
}
