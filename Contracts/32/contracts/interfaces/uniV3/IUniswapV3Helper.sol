// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IUniswapV3Helper {
  function removeLiquidity(uint _tokenId, uint _minOutput0, uint _minOutput1) external returns (uint, uint);
  function collectFees(uint _tokenId) external returns (uint amount0, uint amount1);
  function positionTokens(uint _tokenId) external view returns(address, address);
  function positionAmounts(uint _tokenId, uint _price0, uint _price1) external view returns(uint, uint);
}