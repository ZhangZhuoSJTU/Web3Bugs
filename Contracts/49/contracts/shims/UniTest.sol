// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../market/OverlayV1Comptroller.sol";
import "../interfaces/IUniswapV3Pool.sol";
import "../libraries/UniswapV3OracleLibrary/TickMath.sol";
import "../libraries/UniswapV3OracleLibrary/FullMath.sol";
import "../libraries/UniswapV3OracleLibrary/UniswapV3OracleLibraryV2.sol";

contract UniTest {

    address base0;
    address quote0;
    IUniswapV3Pool feed0;

    address base1;
    address quote1;
    IUniswapV3Pool feed1;

    constructor (
        address _base0,
        address _quote0,
        address _feed0,
        address _base1,
        address _quote1,
        address _feed1
    ) { 
        base0 = _base0;
        quote0 = _quote0;
        feed0 = IUniswapV3Pool(_feed0);
        base1 = _base1;
        quote1 = _quote1;
        feed1 = IUniswapV3Pool(_feed1);
    }

    function testUniLiq (
        uint32 _ago
    ) public view returns (
        uint x_,
        uint y_,
        uint z_
    ) {

        uint32[] memory _secondsAgo = new uint32[](2);
        _secondsAgo[0] = _ago;
        _secondsAgo[1] = 0;

        address f0t0 = feed0.token0();
        address f0t1 = feed0.token1();

        address f1t0 = feed1.token0();
        address f1t1 = feed1.token1();


        ( int56[] memory _ticks, uint160[] memory _invLiqs ) = feed0.observe(_secondsAgo);

        uint256 _sqrtPrice = TickMath.getSqrtRatioAtTick(
            int24((_ticks[1] - _ticks[0]) / int56(int32(_ago)))
        ); 

        // liquidity of USDC/ETH
        uint256 _liquidity = ( uint160(_ago) << 128 ) / ( _invLiqs[1] - _invLiqs[0] );

        uint _ethAmount = f0t0 == base0 
            ? ( uint256(_liquidity) << 96 ) / _sqrtPrice
            : FullMath.mulDiv(uint256(_liquidity), _sqrtPrice, 0x1000000000000000000000000);

        ( _ticks, ) = feed1.observe(_secondsAgo);

        uint _price = OracleLibraryV2.getQuoteAtTick(
            int24((_ticks[1] - _ticks[0]) / int56(int32(_ago))),
            1e18,
            base1,
            quote1
        );

        x_ = _price;
        y_ = ( _ethAmount * 1e18 ) / _price;
        z_ = _ethAmount;

    }

    function thing () public view returns (int) {

        int _staticCap = 10;
        int _brrrrd = 3;
        int _brrrr = 5;

        _brrrrd = _staticCap < ( _brrrrd += _brrrr ) 
            ? _brrrrd
            : _staticCap;

        return _brrrrd;

    }

}