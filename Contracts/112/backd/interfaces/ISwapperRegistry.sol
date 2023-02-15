// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

interface ISwapperRegistry {
    function getSwapper(address fromToken, address toToken) external view returns (address);

    function swapperExists(address fromToken, address toToken) external view returns (bool);

    function getAllSwappableTokens(address token) external view returns (address[] memory);
}
