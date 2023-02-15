// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

contract MockWalletChecker {
    mapping(address => bool) public wallets;

    function approveWallet(address wallet) external {
        wallets[wallet] = true;
    }

    function check(address wallet) external view returns (bool) {
        return wallets[wallet];
    }
}
