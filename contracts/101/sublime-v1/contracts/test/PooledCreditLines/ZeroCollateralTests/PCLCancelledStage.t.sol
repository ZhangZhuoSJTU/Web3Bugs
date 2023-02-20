// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../PCLStageTests/PCLCancelledStage.t.sol';

contract PCLCancelledStageZeroCollateral is PCLCancelledStage {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    function setUp() public override {
        PCLParent.setUp();

        request.borrowLimit = uint128(1_000_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * 1e18) / 1e2);
        request.collateralRatio = 0;
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * 1e18) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        assertEq(uint256(pcl.getStatusAndUpdate(requestId)), uint256(1));

        // Lend any amount lesser than the borrowLimit
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);

        lender_0 = lenders[0].lenderAddress;

        // Let's travel a few days, but stay within the collection period
        vm.warp(block.timestamp + request.collectionPeriod / 2);

        // Borrower tries to cancel the PCL
        borrower.cancelRequest(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED, '!CANCELLED');
    }
}
