// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import '../Dependencies/SafeMath.sol';

import '../Dependencies/HomoraMath.sol';
import '../Interfaces/IBaseOracle.sol';
import '../Interfaces/IPriceFeed.sol';
import '../Interfaces/IUniswapV2Pair.sol';
import "../Dependencies/Ownable.sol";

contract UniswapV2LPTokenPriceFeed is IPriceFeed, Ownable {
  using SafeMath for uint;
  using HomoraMath for uint;

  IBaseOracle base;
  address pair;

  function setParam(IBaseOracle _base, address _pair) external onlyOwner {
    base = _base;
    pair = _pair;
  }

  /// @dev Return the value of the given input as ETH per unit, multiplied by 2**112.
  function fetchPrice_v() external view override returns (uint) {
    address token0 = IUniswapV2Pair(pair).token0();
    address token1 = IUniswapV2Pair(pair).token1();
    uint totalSupply = IUniswapV2Pair(pair).totalSupply();
    (uint r0, uint r1, ) = IUniswapV2Pair(pair).getReserves();
    uint sqrtK = HomoraMath.sqrt(r0.mul(r1)).fdiv(totalSupply); // in 2**112
    uint px0 = base.getPrice(token0); // in 2**112
    uint px1 = base.getPrice(token1); // in 2**112
    // fair token0 amt: sqrtK * sqrt(px1/px0)
    // fair token1 amt: sqrtK * sqrt(px0/px1)
    // fair lp price = 2 * sqrt(px0 * px1)
    // split into 2 sqrts multiplication to prevent uint overflow (note the 2**112)
    return sqrtK.mul(2).mul(HomoraMath.sqrt(px0)).div(2**56).mul(HomoraMath.sqrt(px1)).div(2**56);
  }


}