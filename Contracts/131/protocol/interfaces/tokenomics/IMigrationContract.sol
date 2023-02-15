// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IMigrationContract {
    function migrate(
        address user,
        uint256 balance,
        uint256 boost
    ) external;
}
