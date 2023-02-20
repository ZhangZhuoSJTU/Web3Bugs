// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IEthPool {
    function initialize(string calldata name_, address vault_) external returns (bool);
}
