// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {UniswapV2Library} from "@mochifi/library/contracts/UniswapV2Library.sol";
import "../interfaces/ICSSRAdapter.sol";
import "../interfaces/ICSSRRouter.sol";
import "../interfaces/IUniswapV2CSSR.sol";
contract UniswapV2LPAdapter is ICSSRAdapter {
    using Float for float;

    ICSSRRouter public immutable router;
    IUniswapV2CSSR public immutable cssr;
    address public immutable weth;
    address public immutable factory;
    //using uint256 since we don't need 224 for this
    uint256 public constant Q112 = 2**112;

    constructor(address _weth, address _factory, address _router, address _cssr) {
        weth = _weth;
        router = ICSSRRouter(_router);
        cssr = IUniswapV2CSSR(_cssr);
        factory = _factory;
    }

    function support(address _asset) external view override returns(bool) {
        address underlying = getUnderlyingAsset(IUniswapV2Pair(_asset));
        address calculatedAddress = UniswapV2Library.pairFor(factory, underlying, weth);
        return _asset == calculatedAddress;
    }

    function update(address _asset, bytes memory _proof) external override returns(float memory price) {
        address underlying = getUnderlyingAsset(IUniswapV2Pair(_asset));
        router.update(_asset, _proof);
        return _getPrice(IUniswapV2Pair(_asset), underlying);
    }

    function getUnderlyingAsset(IUniswapV2Pair _pair) public view returns(address underlyingAsset) {
        if (_pair.token0() == weth) {
            underlyingAsset = _pair.token1();
        } else if (_pair.token1() == weth) {
            underlyingAsset = _pair.token0();
        } else {
            revert("!eth paired");
        }
    }

    function getPrice(address _asset) external view override returns(float memory price){
        IUniswapV2Pair pair = IUniswapV2Pair(_asset);
        address underlying = getUnderlyingAsset(pair);
        return _getPrice(pair, underlying);
    }

    function _getPrice(IUniswapV2Pair _pair, address _underlying) internal view returns(float memory price) {
        uint256 eAvg = cssr.getExchangeRatio(_underlying, weth);
        (uint112 _reserve0, uint112 _reserve1,) = _pair.getReserves();
        uint256 aPool; // current asset pool
        uint256 ePool; // current weth pool
        if (_pair.token0() == _underlying) {
            aPool = uint(_reserve0);
            ePool = uint(_reserve1);
        } else {
            aPool = uint(_reserve1);
            ePool = uint(_reserve0);
        }

        uint256 eCurr = ePool * Q112 / aPool; // current price of 1 token in weth
        uint256 ePoolCalc; // calculated weth pool

        if (eCurr < eAvg) {
            // flashloan buying weth
            uint256 sqrtd = ePool * (
                (ePool * 9)
                +(aPool * 3988000 * eAvg / Q112)
            );
            uint256 eChange = (sqrt(sqrtd) - (ePool * 1997)) / 2000;
            ePoolCalc = ePool + eChange;
        } else {
            // flashloan selling weth
            uint256 a = aPool * eAvg;
            uint256 b = a * 9 / Q112;
            uint256 c = ePool * 3988000;
            uint256 sqRoot = sqrt( (a / Q112) * (b + c));
            uint256 d = a * 3 / Q112;
            uint256 eChange = ePool - ((d + sqRoot) / 2000);
            ePoolCalc = ePool - eChange;
        }

        uint256 num = ePoolCalc * 2;
        uint256 priceInEth;
        if (num > Q112) {
            priceInEth = (num / _pair.totalSupply()) * Q112;
        } else {
            priceInEth = num * Q112 / _pair.totalSupply();
        }

        return float({numerator:priceInEth, denominator: Q112}).mul(router.getPrice(weth));
    }

    function getLiquidity(address _asset) external view override returns(uint256) {
        address underlying = getUnderlyingAsset(IUniswapV2Pair(_asset));
        return router.getLiquidity(underlying);
    }

    function sqrt(uint x) internal pure returns (uint y) {
        if (x > 3) {
            uint z = x / 2 + 1;
            y = x;
            while (z < y) {
                y = z;
                z = (x / z + z) / 2;
            }
        } else if (x != 0) {
            y = 1;
        }
    }
}
