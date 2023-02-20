// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface ICurve {
    function add_liquidity(uint256[4] calldata, uint256) external;

    function balances(uint256 index) external view returns (uint256);
}