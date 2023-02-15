//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title InterestRateModel Interface
 *  @dev Calculate the borrowers' interest rate.
 */
interface IInterestRateModel {
    /**
     * @dev Check to see if it is a valid interest rate model
     * @return Return true for a valid interest rate model
     */
    function isInterestRateModel() external pure returns (bool);

    /**
     * @dev Calculates the current borrow interest rate per block
     * @return The borrow rate per block (as a percentage, and scaled by 1e18)
     */
    function getBorrowRate() external view returns (uint256);

    /**
     * @dev Calculates the current suppier interest rate per block
     * @return The supply rate per block (as a percentage, and scaled by 1e18)
     */
    function getSupplyRate(uint256 reserveFactorMantissa) external view returns (uint256);

    /**
     * @dev Set the borrow interest rate per block
     */
    function setInterestRate(uint256 interestRatePerBlock_) external;
}
