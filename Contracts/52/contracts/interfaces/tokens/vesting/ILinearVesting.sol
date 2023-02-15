// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface ILinearVesting {
    /* ========== STRUCTS ========== */

    // Struct of a vesting member, tight-packed to 256-bits
    struct Vester {
        uint192 amount;
        uint64 lastClaim;
        uint128 start;
        uint128 end;
    }

    /* ========== FUNCTIONS ========== */

    function getClaim() external view returns (uint256 vestedAmount);

    function claim() external returns (uint256 vestedAmount);

    function claimConverted() external returns (uint256 vestedAmount);

    function begin() external;

    function vestFor(address user, uint256 amount) external;

    /* ========== EVENTS ========== */

    event VestingInitialized(uint256 duration);

    event Vested(address indexed from, uint256 amount);
}
