// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IUniswapV3Oracle {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function pricePoints(uint256) external view returns (uint256, uint256, uint256);
    function pricePointsLength() external view returns (uint256);
}
