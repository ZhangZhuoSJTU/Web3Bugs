// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IUSDV {
    /* ========== ENUMS ========== */

    enum LockTypes {
        USDV,
        VADER
    }

    /* ========== STRUCTS ========== */

    struct Lock {
        LockTypes token;
        uint256 amount;
        uint256 release;
    }

    /* ========== FUNCTIONS ========== */
    /* ========== EVENTS ========== */

    event ExchangeFeeChanged(uint256 previousExchangeFee, uint256 exchangeFee);
    event DailyLimitChanged(uint256 previousDailyLimit, uint256 dailyLimit);
    event LockClaimed(
        address user,
        LockTypes lockType,
        uint256 lockAmount,
        uint256 lockRelease
    );
    event LockCreated(
        address user,
        LockTypes lockType,
        uint256 lockAmount,
        uint256 lockRelease
    );
}
