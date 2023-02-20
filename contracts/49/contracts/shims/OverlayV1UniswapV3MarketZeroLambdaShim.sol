// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../OverlayV1UniswapV3Market.sol";
import "../libraries/FixedPoint.sol";

contract OverlayV1UniswapV3MarketZeroLambdaShim is OverlayV1UniswapV3Market {

    using FixedPoint for uint256;

    constructor(
        address _mothership,
        address _ovlFeed,
        address _marketFeed,
        address _quote,
        address _eth,
        uint128 _amountIn,
        uint256 _macroWindow,
        uint256 _microWindow,
        uint256 _priceFrameCap
    ) OverlayV1UniswapV3Market (
        _mothership,
        _ovlFeed,
        _marketFeed,
        _quote,
        _eth,
        _amountIn,
        _macroWindow,
        _microWindow,
        _priceFrameCap
    ) { }


    function update () public virtual override returns (uint cap_) {

        cap_ = super.update();
        cap_ = lmbda == 0 ? staticCap : cap_;

    }

    function oiCap () public override view returns ( 
        uint cap_ 
    ) {

        cap_ = super.oiCap();
        cap_ = lmbda == 0 ? staticCap : cap_;

    }



}