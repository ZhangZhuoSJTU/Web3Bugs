// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IUniswapV3Factory {

  function getPool(
    address tokenA,
    address tokenB,
    uint24 fee
  ) external view returns (address pool);
}