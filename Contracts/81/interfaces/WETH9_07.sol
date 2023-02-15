// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

interface WETH9_07 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}
