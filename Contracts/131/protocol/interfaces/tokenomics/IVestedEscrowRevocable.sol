// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IVestedEscrowRevocable {
    function revoke(address _recipient) external returns (bool);
}
