// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../PCLClosedStage.t.sol';

contract PCLClosedStageCollateralNoYieldBorrowCompound is PCLClosedStage {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    function setUp() public override {
        PCLParent.setUp();

        request.borrowLimit = uint128(1_000_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * 1e18) / 1e2);
        request.collateralRatio = 1e18;
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * 1e18) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = compoundYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        // The below function will create the PCL request and then lenders lend the entire requested amount
        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        // Now we assert that we are in the ACTIVE state
        assertEq(uint256(pcl.getStatusAndUpdate(requestId)), 2);

        // Now the borrower finds out the collateral he is required to deposit
        uint256 _requiredCollateral = borrower.getRequiredCollateral(requestId, request.borrowLimit);
        // & deposits the required collateral (this involves getting the collateral from the admin and giving allowance to the PCL)
        admin.transferToken(request.collateralAsset, address(borrower), _requiredCollateral);
        borrower.setAllowance(address(pcl), request.collateralAsset, _requiredCollateral);
        borrower.depositCollateral(requestId, _requiredCollateral, false);

        // Now the borrower calculates the borrowable amount
        uint256 borrowableAmount = borrower.calculateBorrowableAmount(requestId);
        // And borrows the borrowable amount
        borrower.borrow(requestId, borrowableAmount);

        // Borrower decides to repay everything at mid-duration

        // Time travel to mid-duration
        vm.warp(block.timestamp + request.duration / 2);
        // Current Debt on the borrower
        uint256 currentDebt = borrower.calculateCurrentDebt(requestId);
        // Borrower decides to repay the entire debt
        admin.transferToken(address(borrowAsset), address(borrower), currentDebt);
        borrower.setAllowance(address(pooledCreditLineAddress), address(borrowAsset), currentDebt);
        borrower.repay(requestId, currentDebt);

        // Now the PCL should be in the CLOSED state
        borrower.close(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }
}
