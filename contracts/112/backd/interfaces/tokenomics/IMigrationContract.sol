// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

interface IMigrationContract {
    function migrate(
        address user,
        uint256 balance,
        uint256 boost
    ) external;
}
