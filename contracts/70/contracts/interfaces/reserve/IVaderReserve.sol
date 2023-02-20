// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IVaderReserve {
    /* ========== STRUCTS ========== */
    /* ========== FUNCTIONS ========== */

    function reimburseImpermanentLoss(address recipient, uint256 amount)
        external;

    function grant(address recipient, uint256 amount) external;

    function reserve() external view returns (uint256);

    /* ========== EVENTS ========== */

    event GrantDistributed(address recipient, uint256 amount);
    event LossCovered(address recipient, uint256 amount, uint256 actualAmount);
}
