// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

interface ISwapper {
    function swap(
        address fromToken,
        address toToken,
        uint256 swapAmount,
        uint256 minAmount
    ) external returns (uint256);

    function getRate(address fromToken, address toToken) external view returns (uint256);
}
