// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMigrator {
    struct MigrateDelegatorParams {
        // Address that is migrating from L1
        address l1Addr;
        // Address to use on L2
        // If null, l1Addr is used on L2
        address l2Addr;
        // Stake of l1Addr on L1
        uint256 stake;
        // Delegated stake of l1Addr on L1
        uint256 delegatedStake;
        // Fees of l1Addr on L1
        uint256 fees;
        // Delegate of l1Addr on L1
        address delegate;
    }

    struct MigrateUnbondingLocksParams {
        // Address that is migrating from L1
        address l1Addr;
        // Address to use on L2
        // If null, l1Addr is used on L2
        address l2Addr;
        // Total tokens in unbonding locks
        uint256 total;
        // IDs of unbonding locks being migrated
        uint256[] unbondingLockIds;
        // Delegate of l1Addr on L1
        address delegate;
    }

    struct MigrateSenderParams {
        // Address that is migrating from L1
        address l1Addr;
        // Address to use on L2
        // If null, l1Addr is used on L2
        address l2Addr;
        // Deposit of l1Addr on L1
        uint256 deposit;
        // Reserve of l1Addr on L1
        uint256 reserve;
    }
}
