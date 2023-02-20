// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../PCLStageTests/PCLTerminatedStage.t.sol';

contract PCLTerminatedStageZeroCollateral is PCLTerminatedStage {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    function setUp() public override {
        PCLParent.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * pcl.SCALING_FACTOR()) / 1e2);
        request.collateralRatio = 0;
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * pcl.SCALING_FACTOR()) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * (10**ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');

        // Now let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), collateralToDeposit);

            // We want to deposit collateral now
            if (request.collateralRatio != 0) {
                borrower.depositCollateral(requestId, collateralToDeposit, false);
            }
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
        }

        (, _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

        helper_timeWarp(block.timestamp + request.duration / 2);

        // Borrower makes their first repayment (Entire pending interest + part of principal)
        {
            uint256 interestAccrued = borrower.calculateInterestAccrued(requestId);
            admin.transferToken(address(borrowAsset), address(borrower), interestAccrued * 10);
            borrower.setAllowance(address(pcl), address(borrowAsset), interestAccrued + 10);
            borrower.repay(requestId, interestAccrued + 10);
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        admin.terminate(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED, '!Terminated');
        notCreatedRequestId = requestId;
    }
}
