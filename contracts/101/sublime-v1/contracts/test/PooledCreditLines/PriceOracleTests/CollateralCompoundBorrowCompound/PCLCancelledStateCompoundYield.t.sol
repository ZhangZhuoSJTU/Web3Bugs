// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../PCLCancelledState.t.sol';
import '../../Helpers/PCLParent.t.sol';

contract PCLCancelledStatePriceOracleCompoundYield is PCLCancelledStatePriceOracle {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    function setUp() public override {
        PCLParent.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

        _borrowAssetDecimals = ERC20(address(borrowAsset)).decimals();
        _borrowAssetPriceMin = uint128((1 * (10**(_borrowAssetDecimals - 2))));
        _borrowAssetPriceMax = uint128((10000 * (10**_borrowAssetDecimals)));

        _collateralAssetDecimals = ERC20(address(collateralAsset)).decimals();
        _collateralAssetPriceMin = uint128((1 * (10**(_collateralAssetDecimals - 2))));
        _collateralAssetPriceMax = uint128((1000 * (10**_collateralAssetDecimals)));

        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * pcl.SCALING_FACTOR()) / 1e2);
        request.collateralRatio = pcl.SCALING_FACTOR();
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * pcl.SCALING_FACTOR()) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = compoundYieldAddress;
        request.collateralAssetStrategy = compoundYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        assertEq(uint256(pcl.getStatusAndUpdate(requestId)), uint256(1));

        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        lender_0 = lenders[0].lenderAddress;

        // Let's travel a few days, but stay within the collection period
        vm.warp(block.timestamp + request.collectionPeriod / 2);

        // Borrower tries to cancel the PCL
        borrower.cancelRequest(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED, '!Cancelled');
    }
}
