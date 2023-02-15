// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface Uni {
    function swapExactTokensForTokens(uint, uint, address[] calldata, address, uint) external;
}
