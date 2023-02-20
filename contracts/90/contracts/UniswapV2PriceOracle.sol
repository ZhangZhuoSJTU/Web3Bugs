// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol";

import "./interfaces/IUniswapV2PriceOracle.sol";

/// @title Uniswap V2 price oracle
/// @notice Contains logic for price calculation of asset using Uniswap V2 Pair
/// @dev Oracle works through base asset which is set in initialize function
contract UniswapV2PriceOracle is IUniswapV2PriceOracle, ERC165 {
    using UniswapV2OracleLibrary for address;

    /// @notice Minimum oracle update interval
    /// @dev If min update interval hasn't passed (24h) before update, previously cached value is returned
    uint private constant MIN_UPDATE_INTERVAL = 24 hours;

    IUniswapV2Pair immutable pair;
    /// @inheritdoc IUniswapV2PriceOracle
    address public immutable override asset0;
    /// @inheritdoc IUniswapV2PriceOracle
    address public immutable override asset1;

    uint private price0CumulativeLast;
    uint private price1CumulativeLast;
    uint32 private blockTimestampLast;
    uint private price0Average;
    uint private price1Average;

    constructor(
        address _factory,
        address _assetA,
        address _assetB
    ) {
        IUniswapV2Pair _pair = IUniswapV2Pair(IUniswapV2Factory(_factory).getPair(_assetA, _assetB));
        pair = _pair;
        asset0 = _pair.token0();
        asset1 = _pair.token1();

        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = _pair.getReserves();
        require(reserve0 != 0 && reserve1 != 0, "UniswapV2PriceOracle: RESERVES");

        uint _price0CumulativeLast = _pair.price0CumulativeLast();
        uint _price1CumulativeLast = _pair.price1CumulativeLast();
        (uint price0Cml, uint price1Cml, uint32 blockTimestamp) = address(_pair).currentCumulativePrices();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        price0CumulativeLast = _price0CumulativeLast;
        price1CumulativeLast = _price1CumulativeLast;
        price0Average = (price0Cml - _price0CumulativeLast) / timeElapsed;
        price1Average = (price1Cml - _price1CumulativeLast) / timeElapsed;
    }

    /// @inheritdoc IPriceOracle
    /// @dev Updates and returns cumulative price value
    /// @dev If min update interval hasn't passed (24h), previously cached value is returned
    function refreshedAssetPerBaseInUQ(address _asset) external override returns (uint) {
        (uint price0Cumulative, uint price1Cumulative, uint32 blockTimestamp) = address(pair).currentCumulativePrices();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;

        if (timeElapsed >= MIN_UPDATE_INTERVAL) {
            price0Average = (price0Cumulative - price0CumulativeLast) / timeElapsed;
            price1Average = (price1Cumulative - price1CumulativeLast) / timeElapsed;

            price0CumulativeLast = price0Cumulative;
            price1CumulativeLast = price1Cumulative;
            blockTimestampLast = blockTimestamp;
        }

        return lastAssetPerBaseInUQ(_asset);
    }

    /// @inheritdoc IPriceOracle
    /// @dev Returns cumulative price value cached during last refresh call
    function lastAssetPerBaseInUQ(address _asset) public view override returns (uint) {
        if (_asset == asset0) {
            return price1Average;
        } else {
            require(_asset == asset1, "UniswapV2PriceOracle: UNKNOWN");
            return price0Average;
        }
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return
            _interfaceId == type(IUniswapV2PriceOracle).interfaceId ||
            _interfaceId == type(IPriceOracle).interfaceId ||
            super.supportsInterface(_interfaceId);
    }
}
