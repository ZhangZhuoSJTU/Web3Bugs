// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IConversionPool {
    function deposit(uint256 _amount, uint256 _minAmountOut) external;

    function redeem(uint256 _amount, uint256 _minAmountOut) external;
}
