// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface ICurveCryptoSwap {
    function exchange_underlying(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
}
