// SPDX-License-Identifier: MIT

pragma solidity 0.7.5;
pragma abicoder v2;

import 'uniswap/uniswap-v3-core@1.0.0/contracts/libraries/TickMath.sol';
import 'uniswap/uniswap-v3-core@1.0.0/contracts/libraries/FixedPoint128.sol';
import 'uniswap/uniswap-v3-core@1.0.0/contracts/libraries/FullMath.sol';
import 'uniswap/uniswap-v3-core@1.0.0/contracts/libraries/SqrtPriceMath.sol';

import './external/PositionKey.sol';
import './external/PoolAddress.sol';
import './external/SafeERC20.sol';
import './external/ERC721Receivable.sol';

import 'uniswap/uniswap-v3-core@1.0.0/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IERC20.sol';
import './interfaces/univ3/INonfungiblePositionManager.sol';

contract UniswapV3Helper is ERC721Receivable {

  using SafeERC20 for IERC20;

  INonfungiblePositionManager internal constant positionManager = INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

  function removeLiquidity(
    uint _tokenId,
    uint _minOutput0,
    uint _minOutput1
  ) external returns (uint, uint) {

    positionManager.safeTransferFrom(msg.sender, address(this), _tokenId);
    uint128 liquidity = uint128(positionLiquidity(_tokenId));

    INonfungiblePositionManager.DecreaseLiquidityParams memory params =
      INonfungiblePositionManager.DecreaseLiquidityParams({
        tokenId:    _tokenId,
        liquidity:  liquidity,
        amount0Min: _minOutput0,
        amount1Min: _minOutput1,
        deadline:   block.timestamp
      });

    positionManager.decreaseLiquidity(params);
    (uint amount0, uint amount1) = _collectFees(_tokenId);
    _safeTransferAmounts(_tokenId, amount0, amount1);
    positionManager.burn(_tokenId);

    return (amount0, amount1);
  }

  function collectFees(uint _tokenId) external returns (uint, uint) {

    positionManager.safeTransferFrom(msg.sender, address(this), _tokenId);

    (uint amount0, uint amount1) = _collectFees(_tokenId);

    _safeTransferAmounts(_tokenId, amount0, amount1);
    positionManager.safeTransferFrom(address(this), msg.sender, _tokenId);

    return (amount0, amount1);
  }

  // This function answer the question:
  // If the current token prices were as follows (_price0, _price1),
  // what would be token amounts of this position look like?
  // This function is used to determine USD value of the position inside of the lending pair
  // Price inputs are token TWAP prices
  function positionAmounts(
    uint _tokenId,
    uint _price0,
    uint _price1
  ) external view returns(uint, uint) {
    uint160 sqrtPriceX96 = uint160(getSqrtPriceX96(_price0, _price1));
    int24 tick = getTickAtSqrtRatio(sqrtPriceX96);
    return getUserTokenAmount(_tokenId, tick);
  }

  function getSqrtRatioAtTick(int24 _tick) public pure returns (uint160) {
    return TickMath.getSqrtRatioAtTick(_tick);
  }

  function getTickAtSqrtRatio(uint160 _sqrtPriceX96) public pure returns (int24) {
    return TickMath.getTickAtSqrtRatio(_sqrtPriceX96);
  }

  function positionTokens(uint _tokenId) public view returns(address, address) {
    (, , address tokenA, address tokenB, , , , , , , ,) = positionManager.positions(_tokenId);
    return (tokenA, tokenB);
  }

  function positionLiquidity(uint _tokenId) public view returns(uint) {
    (, , , , , , , uint liquidity, , , ,) = positionManager.positions(_tokenId);
    return liquidity;
  }

  function getUserTokenAmount(
    uint  _tokenId,
    int24 _tick
  ) public view returns (uint amount0, uint amount1) {
    (
      ,
      ,
      address token0,
      address token1,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper,
      uint128 liquidity,
      ,
      ,
      ,

    ) = positionManager.positions(_tokenId);

    IUniswapV3Pool pool =
      IUniswapV3Pool(
        PoolAddress.computeAddress(
          positionManager.factory(),
          PoolAddress.PoolKey({
            token0: token0,
            token1: token1,
            fee: fee
          })
        )
      );

    // (, int24 currentTick, , , , , ) = pool.slot0();

    if (_tick < tickLower) {
      amount0 = uint(SqrtPriceMath.getAmount0Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        (int128)(liquidity)
      ));
    } else if (_tick < tickUpper) {
      amount0 = uint(SqrtPriceMath.getAmount0Delta(
        TickMath.getSqrtRatioAtTick(_tick),
        TickMath.getSqrtRatioAtTick(tickUpper),
        (int128)(liquidity)
      ));
      amount1 = uint(SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(_tick),
        (int128)(liquidity)
      ));
    } else {
      amount1 = uint(SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        (int128)(liquidity)
      ));
    }
  }

  function getSqrtPriceX96(uint _amount0, uint _amount1) public view returns(uint) {
    uint ratioX192 = (_amount0 << 192) / _amount1;
    return _sqrt(ratioX192);
  }

  function _collectFees(uint _tokenId) internal returns (uint, uint) {

    INonfungiblePositionManager.CollectParams memory params =
      INonfungiblePositionManager.CollectParams({
      tokenId: _tokenId,
      recipient: address(this),
      amount0Max: type(uint128).max,
      amount1Max: type(uint128).max
      });

    return positionManager.collect(params);
  }

  function _safeTransferAmounts(uint _tokenId, uint _amount0, uint _amount1) internal {
    (address token0, address token1) = positionTokens(_tokenId);
    _safeTransfer(token0, msg.sender, _amount0);
    _safeTransfer(token1, msg.sender, _amount1);
  }

  // Can't use TransferHelper due since it's on another version of Solidity
  function _safeTransfer(address _token, address _recipient, uint _amount) internal {
    require(_amount > 0, "UniswapV3Helper: amount must be > 0");
    IERC20(_token).safeTransfer(_recipient, _amount);
  }

  function _sqrt(uint _x) internal view returns (uint y) {
    uint z = (_x + 1) / 2;
    y = _x;
    while (z < y) {
      y = z;
      z = (_x / z + z) / 2;
    }
  }
}
