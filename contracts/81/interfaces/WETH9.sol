// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface WETH9 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}
