// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import './IPooledCreditLineEnums.sol';

interface IPooledCreditLineDeclarations is IPooledCreditLineEnums {
    /**
     * @notice Struct containing various parameters needed to initialize a pooled credit line
     * @param collateralRatio Ratio of collateral value to debt above which liquidations can happen
     * @param duration time for which pooled credit line will stay active
     * @param lenderVerifier verifier with which lender should be verified
     * @param defaultGracePeriod time given after duration of pooled credit line ends as grace period   
        only after which liquidations can happen
     * @param gracePenaltyRate Extra interest rate levied for repayments during grace period
     * @param collectionPeriod time for which lenders can lend to pooled credit line until borrow limit is reached
     * @param minBorrowAmount min amount of borrow tokens below which pooled credit line will be cancelled
     * @param borrowLimit Max amount of borrow tokens requested by borrower
     * @param borrowRate Interest rate at which tokens can be borrowed from pooled credit line
     * @param collateralAsset address of token which is used as collateral
     * @param borrowAssetStrategy address of strategy into which borrow tokens are deposited
     * @param collateralAssetStrategy address  of strategy into which collateral tokens are depositeds
     * @param borrowAsset address of token that is borrowed
     * @param borrowerVerifier verifier with which borrower needs to be verified
     * @param areTokensTransferable flag that represents if the pooled credit line tokens which represents 
        borrower share are transferable
     */
    struct Request {
        uint256 collateralRatio;
        uint256 duration;
        address lenderVerifier;
        uint256 defaultGracePeriod;
        uint256 gracePenaltyRate;
        uint256 collectionPeriod;
        uint256 minBorrowAmount;
        uint128 borrowLimit;
        uint128 borrowRate;
        address collateralAsset;
        address borrowAssetStrategy;
        address collateralAssetStrategy;
        address borrowAsset;
        address borrowerVerifier;
        bool areTokensTransferable;
    }

    /**
    * @notice Struct to store all the variables for a pooled credit line
    * @param status represents the status of pooled credit line
    * @param principal total principal borrowed in pooled credit line
    * @param totalInterestRepaid total interest repaid in the pooled credit line
    * @param lastPrincipalUpdateTime timestamp when principal was last updated. Principal is
             updated on borrow or repay
    * @param interestAccruedTillLastPrincipalUpdate interest accrued till last time
             principal was updated
     */
    struct PooledCreditLineVariables {
        PooledCreditLineStatus status;
        uint256 principal;
        uint256 totalInterestRepaid;
        uint256 lastPrincipalUpdateTime;
        uint256 interestAccruedTillLastPrincipalUpdate;
    }

    /**
    * @notice Struct to store all the constants for a pooled credit line
    * @param borrowLimit max amount of borrowAsset that can be borrowed in aggregate at any point
    * @param borrowRate Rate of interest (multiplied by SCALING_FACTOR) for eg 8.25% becomes 8.25 / 1e2 * 1e18
    * @param idealCollateralRatio ratio of collateral to debt below which collateral is
             liquidated (multiplied by SCALING_FACTOR)
    * @param borrower address of the borrower of credit line
    * @param borrowAsset address of asset borrowed in credit line
    * @param collateralAsset address of asset collateralized in credit line
    * @param startsAt timestamp at which pooled credit line starts
    * @param endsAt timestamp at which pooled credit line ends
    * @param defaultsAt timestamp at which pooled credit line defaults after grace period completes
    * @param borrowAssetStrategy strategy into which lent tokens are deposited
    * @param collateralAssetStrategy address of the strategy into which collateral is deposited
    * @param gracePenaltyRate rate at which penalty is levied during grace period (multiplied by SCALING_FACTOR)
     */
    struct PooledCreditLineConstants {
        uint128 borrowLimit;
        uint128 borrowRate;
        uint256 idealCollateralRatio;
        address borrower;
        address borrowAsset;
        address collateralAsset;
        uint256 startsAt;
        uint256 endsAt;
        uint256 defaultsAt;
        address borrowAssetStrategy;
        address collateralAssetStrategy;
        uint256 gracePenaltyRate;
    }
}
