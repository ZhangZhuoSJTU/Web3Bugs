// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

interface IUniswapPair {
  function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
  function token0() external view returns (address);
  function token1() external view returns (address);
}