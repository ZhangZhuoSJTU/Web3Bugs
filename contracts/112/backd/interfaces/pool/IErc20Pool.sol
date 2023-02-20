// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

interface IErc20Pool {
    function initialize(
        string memory name_,
        address underlying_,
        uint256 depositCap_,
        address vault_
    ) external returns (bool);
}
