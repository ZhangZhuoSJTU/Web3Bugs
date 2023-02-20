// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

interface ILimitsManager {
    /*
     * @notice Used to define limits for the pooled credit line parameters
     * @param min the minimum threshold for the parameter
     * @param max the maximum threshold for the parameter
     */
    struct Limits {
        uint256 min;
        uint256 max;
    }

    function isWithinLimits(uint256 _value, Limits calldata _limits) external pure virtual returns (bool);

    function limitBorrowedInUSDC(
        address _borrowAsset,
        uint256 _borrowLimit,
        uint256 _minBorrowAmount
    ) external view virtual;

    function getIdealCollateralRatioLimits() external view virtual returns (Limits memory);

    function getBorrowRateLimits() external view virtual returns (Limits memory);

    function getCollectionPeriodLimits() external view virtual returns (Limits memory);

    function getDurationLimits() external view virtual returns (Limits memory);

    function getDefaultGracePeriodLimits() external view virtual returns (Limits memory);

    function getGracePenaltyRateLimits() external view virtual returns (Limits memory);
}
