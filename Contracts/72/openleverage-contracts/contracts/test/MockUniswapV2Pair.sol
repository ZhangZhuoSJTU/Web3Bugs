// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./MockERC20.sol";
import "../dex/eth/UniV2Dex.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

library UQ112x112 {
    uint224 constant Q112 = 2 ** 112;

    // encode a uint112 as a UQ112x112
    function encode(uint112 y) internal pure returns (uint224 z) {
        z = uint224(y) * Q112;
        // never overflows
    }

    // divide a UQ112x112 by a uint112, returning a UQ112x112
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224 z) {
        z = x / uint224(y);
    }
}

contract MockUniswapV2Pair {
    using SafeMath for uint256;
    using UQ112x112 for uint224;

    uint public _price0CumulativeLast;
    uint public _price1CumulativeLast;

    address internal _token0;
    address internal _token1;
    uint112 public _reserve0;
    uint112 public _reserve1;
    uint32 public _blockTimestampLast;

    constructor(address tokenA,
        address tokenB,
        uint112 reserve0,
        uint112 reserve1)
    {
        require(tokenA != tokenB);
        require(reserve0 != 0);
        require(reserve1 != 0);
        (_token0, _token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

//        _token0 = tokenA;
//        _token1 = tokenB;
        _reserve0 = reserve0;
        _reserve1 = reserve1;

        MockERC20(_token0).mint(address(this), _reserve0);
        MockERC20(_token1).mint(address(this), _reserve1);
        _blockTimestampLast = uint32(block.timestamp.mod(2 ** 32));
        _price0CumulativeLast = uint(_reserve0 * _blockTimestampLast);
        _price1CumulativeLast = uint(_reserve1 * _blockTimestampLast);
    }

    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external {
        if (amount0Out > 0) {
            MockERC20(_token0).transfer(to, amount0Out);
        }
        if (amount1Out > 0) {
            MockERC20(_token1).transfer(to, amount1Out);
        }
        if (data.length > 0) {
            IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
        }
        _update(MockERC20(_token0).balanceOf(address(this)), MockERC20(_token1).balanceOf(address(this)), _reserve0, _reserve1);
        _reserve0 = uint112(MockERC20(_token0).balanceOf(address(this)));
        _reserve1 = uint112(MockERC20(_token1).balanceOf(address(this)));
    }


    function setPrice(address tokenA, address tokenB, uint price) external {
        _update(MockERC20(_token0).balanceOf(address(this)), MockERC20(_token1).balanceOf(address(this)), _reserve0, _reserve1);
        tokenB;
        if (_token0 == tokenA) {
            _reserve0 = 1000000 * 1e18 * 1;
            _reserve1 = 1000000 * 1e18 * uint112(price) / 100;
        }
        if (_token1 == tokenA) {
            _reserve1 = 1000000 * 1e18 * 1;
            _reserve0 = 1000000 * 1e18 * uint112(price) / 100;
        }
        if (MockERC20(_token0).balanceOf(address(this)) > _reserve0) {
            MockERC20(_token0).transfer(_token0, MockERC20(_token0).balanceOf(address(this)) - _reserve0);
        } else {
            MockERC20(_token0).mint(address(this), _reserve0 - MockERC20(_token0).balanceOf(address(this)));
        }
        if (MockERC20(_token1).balanceOf(address(this)) > _reserve1) {
            MockERC20(_token1).transfer(_token1, MockERC20(_token1).balanceOf(address(this)) - _reserve1);
        } else {
            MockERC20(_token1).mint(address(this), _reserve1 - MockERC20(_token1).balanceOf(address(this)));
        }
    }

    function setPriceUpdateAfter(address tokenA, address tokenB, uint price) external {
        tokenB;
        if (_token0 == tokenA) {
            _reserve0 = 1000000 * 1e18 * 1;
            _reserve1 = 1000000 * 1e18 * uint112(price) / 100;
        }
        if (_token1 == tokenA) {
            _reserve1 = 1000000 * 1e18 * 1;
            _reserve0 = 1000000 * 1e18 * uint112(price) / 100;
        }
        if (MockERC20(_token0).balanceOf(address(this)) > _reserve0) {
            MockERC20(_token0).transfer(_token0, MockERC20(_token0).balanceOf(address(this)) - _reserve0);
        } else {
            MockERC20(_token0).mint(address(this), _reserve0 - MockERC20(_token0).balanceOf(address(this)));
        }
        if (MockERC20(_token1).balanceOf(address(this)) > _reserve1) {
            MockERC20(_token1).transfer(_token1, MockERC20(_token1).balanceOf(address(this)) - _reserve1);
        } else {
            MockERC20(_token1).mint(address(this), _reserve1 - MockERC20(_token1).balanceOf(address(this)));
        }
        
        _update(MockERC20(_token0).balanceOf(address(this)), MockERC20(_token1).balanceOf(address(this)), _reserve0, _reserve1);
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balance0, uint balance1, uint112 _reserve00, uint112 _reserve11) private {
        require(balance0 <= uint112(- 1) && balance1 <= uint112(- 1), 'UniswapV2: OVERFLOW');
        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed = blockTimestamp - _blockTimestampLast;
        // overflow is desired
        if (timeElapsed > 0 && _reserve00 != 0 && _reserve11 != 0) {
            // * never overflows, and + overflow is desired
            _price0CumulativeLast += uint(UQ112x112.encode(_reserve11).uqdiv(_reserve00)) * timeElapsed;
            _price1CumulativeLast += uint(UQ112x112.encode(_reserve00).uqdiv(_reserve11)) * timeElapsed;
        }
        _reserve0 = uint112(balance0);
        _reserve1 = uint112(balance1);
        _blockTimestampLast = blockTimestamp;
    }

    function getReserves() external view
    returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast){
        return (_reserve0, _reserve1, _blockTimestampLast);
    }

    function price0CumulativeLast() external view returns (uint){
        return _price0CumulativeLast;
    }

    function price1CumulativeLast() external view returns (uint){
        return _price1CumulativeLast;
    }

    function token0() external view returns (address){
        return _token0;
    }

    function token1() external view returns (address){
        return _token1;
    }

    function setPrice0CumulativeLast(uint _price) external {
        _price0CumulativeLast = _price;
    }

    function setPrice1CumulativeLast(uint _price) external {
        _price1CumulativeLast = _price;
    }
    // force reserves to match balances
    function sync() external {
        _update(_reserve0, _reserve1, _reserve0, _reserve1);
    }
}
