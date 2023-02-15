// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

abstract contract ComptrollerInterface {
    /// Assets You Are In
    function enterMarkets(address[] calldata cTokens) external virtual returns (uint[] memory);

    function exitMarket(address cToken) external virtual returns (uint);

    /// Policy Hooks

    function mintAllowed(
        address cToken,
        address minter,
        uint mintAmount
    ) external virtual returns (uint);
}
