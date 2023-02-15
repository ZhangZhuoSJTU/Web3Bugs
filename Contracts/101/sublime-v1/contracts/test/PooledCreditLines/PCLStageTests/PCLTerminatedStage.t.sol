// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../../SublimeProxy.sol';
import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../PooledCreditLine/LenderPool.sol';
import '../../../PriceOracle.sol';
import '../../../SavingsAccount/SavingsAccount.sol';
import '../../../yield/StrategyRegistry.sol';
import '../../../yield/NoYield.sol';
import '../../../yield/CompoundYield.sol';
import '../../../mocks/MockWETH.sol';
import '../../../mocks/MockCToken.sol';
import '../../../mocks/MockVerification2.sol';
import '../../../mocks/MockV3Aggregator.sol';
import '../../../mocks/MockToken.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '../../../interfaces/ISavingsAccount.sol';

import '../Helpers/PCLParent.t.sol';
import './PCLNotCreatedStage.t.sol';

contract PCLTerminatedStage is PCLNotCreatedStage {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    function setUp() public virtual override {
        PCLParent.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

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
            borrower.depositCollateral(requestId, collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
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

    function test_lenderCannotLiquidateANotCreatedPCL() public override {
        assert_liquidate_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot liquidate a notCreated PCL',
            'PCL:L1'
        );
    }

    function test_lenderCannotWithdrawLiquidation_notcreatedState() public override {
        assert_withdraw_liquidation_in_notcreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot withdraw liquidation/liquidity from a notcreated PCL',
            'LP:IWLC1'
        );
    }

    function test_lenderCannotWithdrawLiquidityFromANotCreatedPCL() public override {
        assert_withdraw_liquidity_functionality_in_NotCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.NOT_CREATED),
            false,
            'Lender cannot withdraw liquidity a PCL in NotCreated state',
            'LP:IWL3'
        );
    }
}
