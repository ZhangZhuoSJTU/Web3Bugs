// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../PCLStageTests/PCLRequestedStage.t.sol';

contract PCLRequestedStageZeroCollateral is PCLRequestedStage {
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
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED, '!REQUESTED');
    }
}
