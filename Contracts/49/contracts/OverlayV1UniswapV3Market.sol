// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./libraries/FixedPoint.sol";
import "./libraries/UniswapV3OracleLibrary/UniswapV3OracleLibraryV2.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./market/OverlayV1Market.sol";
import "./libraries/UniswapV3OracleLibrary/TickMath.sol";

contract OverlayV1UniswapV3Market is OverlayV1Market {

    using FixedPoint for uint256;

    uint256 internal X96 = 0x1000000000000000000000000;

    uint256 public immutable macroWindow; // window size for main TWAP
    uint256 public immutable microWindow; // window size for bid/ask TWAP

    address public immutable marketFeed;
    address public immutable ovlFeed;
    address public immutable base;
    address public immutable quote;
    uint128 internal immutable baseAmount;

    address internal immutable eth;
    bool internal immutable ethIs0;

    constructor(
        address _mothership,
        address _ovlFeed,
        address _marketFeed,
        address _quote,
        address _eth,
        uint128 _baseAmount,
        uint256 _macroWindow,
        uint256 _microWindow,
        uint256 _priceFrameCap
    ) OverlayV1Market (
        _mothership
    ) OverlayV1Comptroller (
        _microWindow
    ) OverlayV1OI (
        _microWindow
    ) OverlayV1PricePoint (
        _priceFrameCap
    ) {

        // immutables
        eth = _eth;
        ethIs0 = IUniswapV3Pool(_ovlFeed).token0() == _eth;
        ovlFeed = _ovlFeed;
        marketFeed = _marketFeed;
        baseAmount = _baseAmount;
        macroWindow = _macroWindow;
        microWindow = _microWindow;

        address _token0 = IUniswapV3Pool(_marketFeed).token0();
        address _token1 = IUniswapV3Pool(_marketFeed).token1();

        base = _token0 != _quote ? _token0 : _token1;
        quote = _token0 == _quote ? _token0 : _token1;

        int24 _tick = OracleLibraryV2.consult(
            _marketFeed,
            uint32(_macroWindow),
            uint32(0)
        );

        _pricePoints.push(PricePoint(
            _tick, 
            _tick, 
            0
        ));

        uint _price = OracleLibraryV2.getQuoteAtTick(
            _tick,
            uint128(_baseAmount),
            _token0 != _quote ? _token0 : _token1,
            _token0 == _quote ? _token0 : _token1
        );

        emit NewPricePoint(_price, _price, 0);

    }


    /// @notice Reads the current price and depth information
    /// @dev Reads price and depth of market feed
    /// @return price_ Price point
    function fetchPricePoint () public view override returns (
        PricePoint memory price_
    ) {

        int56[] memory _ticks;
        uint160[] memory _liqs;

        uint _ovlPrice;
        uint _marketLiquidity;

        int24 _microTick;
        int24 _macroTick;

        {

            uint32[] memory _secondsAgo = new uint32[](3);
            _secondsAgo[2] = uint32(macroWindow);
            _secondsAgo[1] = uint32(microWindow);

            ( _ticks, _liqs ) = IUniswapV3Pool(marketFeed).observe(_secondsAgo);

            _macroTick = int24(( _ticks[0] - _ticks[2]) / int56(int32(int(macroWindow))));

            _microTick = int24((_ticks[0] - _ticks[1]) / int56(int32(int(microWindow))));

            uint _sqrtPrice = TickMath.getSqrtRatioAtTick(_microTick);

            uint _liquidity = (uint160(microWindow) << 128) / ( _liqs[0] - _liqs[1] );

            _marketLiquidity = ethIs0
                ? ( uint256(_liquidity) << 96 ) / _sqrtPrice
                : FullMath.mulDiv(uint256(_liquidity), _sqrtPrice, X96);

        }


        {

            uint32[] memory _secondsAgo = new uint32[](2);

            _secondsAgo[1] = uint32(macroWindow);

            ( _ticks, ) = IUniswapV3Pool(ovlFeed).observe(_secondsAgo);

            _ovlPrice = OracleLibraryV2.getQuoteAtTick(
                int24((_ticks[0] - _ticks[1]) / int56(int32(int(macroWindow)))),
                1e18,
                ovl,
                eth
            );

        }

        price_ = PricePoint(
            _microTick, 
            _macroTick, 
            computeDepth(_marketLiquidity, _ovlPrice)
        );

    }


    /// @notice Arithmetic to get depth
    /// @dev Derived from cnstant product formula X*Y=K and tailored 
    /// to Uniswap V3 selective liquidity provision.
    /// @param _marketLiquidity Amount of liquidity in market in ETH terms.
    /// @param _ovlPrice Price of OVL against ETH.
    /// @return depth_ Depth criteria for market in OVL terms.
    function computeDepth (
        uint _marketLiquidity,
        uint _ovlPrice
    ) public override view returns (
        uint depth_
    ) {

        depth_ = ((_marketLiquidity * 1e18) / _ovlPrice)
            .mulUp(lmbda)    
            .divDown(2e18);

    }

    function _tickToPrice (
        int24 _tick
    ) public override view returns (
        uint quote_
    ) {

        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(_tick);

        // better precision if no overflow when squared
        if (sqrtRatioX96 <= type(uint128).max) {

            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;

            quote_ = base < quote
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);

        } else {

            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);

            quote_ = base < quote
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);

        }

    }

}
