// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IPooledCreditLineEnums {
    enum PooledCreditLineStatus {
        NOT_CREATED,
        REQUESTED,
        ACTIVE,
        CLOSED,
        EXPIRED,
        LIQUIDATED,
        CANCELLED
    }

    /*
     * @notice a PCL can be cancelled in 3 different cases denoted by the enums
     */
    enum CancellationStatus {
        BORROWER_BEFORE_START,
        LENDER_LOW_COLLECTION,
        LENDER_NOT_STARTED_AT_END
    }
}
