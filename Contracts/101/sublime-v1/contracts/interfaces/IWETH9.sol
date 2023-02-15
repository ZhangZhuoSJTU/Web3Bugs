// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IWETH9 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;

    function approve(address spender, uint256 amount) external returns (bool);

    function transfer(address dst, uint256 wad) external returns (bool);
}
