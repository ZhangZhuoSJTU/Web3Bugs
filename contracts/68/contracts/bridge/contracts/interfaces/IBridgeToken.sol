//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface IBridgeToken {
    function withdraw(uint256 amount) external;

    function withdrawTo(uint256 amount, address reciver) external;

    function deposit(address user, bytes calldata depositData) external;

    function mint(address reciver, uint256 amount) external;
}
