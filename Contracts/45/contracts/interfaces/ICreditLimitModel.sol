//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title CreditLimitModel Interface
 *  @dev Calculate the user's credit line based on the trust he receives from the vouchees.
 */
interface ICreditLimitModel {
    struct LockedInfo {
        address staker;
        uint256 vouchingAmount;
        uint256 lockedAmount;
        uint256 availableStakingAmount;
    }

    function isCreditLimitModel() external pure returns (bool);

    function effectiveNumber() external returns (uint256);

    /**
     * @notice Calculates the staker locked amount
     * @return Member credit limit
     */
    function getLockedAmount(
        LockedInfo[] calldata vouchAmountList,
        address staker,
        uint256 amount,
        bool isIncrease
    ) external pure returns (uint256);

    /**
     * @notice Calculates the member credit limit by vouchs
     * @return Member credit limit
     */
    function getCreditLimit(uint256[] calldata vouchs) external view returns (uint256);
}
