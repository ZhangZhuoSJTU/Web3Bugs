// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface IPoolMigrationZap {
    function migrateAll(address[] calldata oldPoolAddresses_) external;

    function migrate(address oldPoolAddress_) external;
}
