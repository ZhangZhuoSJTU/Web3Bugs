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

contract PCLCancelledStateCToken is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    uint256 _borrowAssetDecimals;
    uint256 _collateralAssetDecimals;
    uint128 _collateralAssetPriceMin;
    uint128 _borrowAssetPriceMin;
    uint128 _collateralAssetPriceMax;
    uint128 _borrowAssetPriceMax;
    uint256 requestId;
    uint256 _fromUserPoolTokenSupply;
    uint256 _toUserPoolTokenSupply;
    uint256 _fromUserPoolTokenSupplyNew;
    uint256 _toUserPoolTokenSupplyNew;
    uint256 _calculatedCurrentDebt;
    uint256 _fetchedCurrentDebt;
    address lender_0;

    function setUp() public override {
        super.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

        _borrowAssetDecimals = ERC20(address(borrowAsset)).decimals();
        _borrowAssetPriceMin = uint128((1 * (10**(_borrowAssetDecimals - 2))));
        _borrowAssetPriceMax = uint128((10000 * (10**_borrowAssetDecimals)));

        _collateralAssetDecimals = ERC20(address(collateralAsset)).decimals();
        _collateralAssetPriceMin = uint128((1 * (10**(_collateralAssetDecimals - 2))));
        _collateralAssetPriceMax = uint128((1000 * (10**_collateralAssetDecimals)));

        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((1 * pcl.SCALING_FACTOR()) / 1e2);
        request.collateralRatio = pcl.SCALING_FACTOR();
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 5000 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * pcl.SCALING_FACTOR()) / 1e2;
        request.collectionPeriod = 5000 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = compoundYieldAddress;
        request.collateralAssetStrategy = compoundYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED, '!Requested');

        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        lender_0 = lenders[0].lenderAddress;

        // Borrower tries to cancel the PCL
        borrower.cancelRequest(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED, '!Cancelled');
    }

    // Test 0: Test SetUp
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED, '!Cancelled');

        uint256 _borrowCTokenExchangeRate = MockCToken(borrowCTokenAddress).exchangeRateCurrent();
        uint256 _collateralCTokenExchangeRate = MockCToken(collateralCTokenAddress).exchangeRateCurrent();

        // Checking out what are the exchange rates
        log_named_int('Borrow CToken Exchange Rate', int256(_borrowCTokenExchangeRate));
        log_named_int('Collateral CToken Exchange Rate', int256(_collateralCTokenExchangeRate));

        // Check the exchange rates of the borrow and collateral CTokens are non-zero
        assertGt(_borrowCTokenExchangeRate, 0);
        assertGt(_collateralCTokenExchangeRate, 0);
    }

    // Test 1: A cancelled PCL cannot be started even with exchange rate fluctuations
    function test_pclCannotBeStarted() public {
        helper_exchangeRateChanges();

        try borrower.start(requestId) {
            revert('Cannot start a cancelled PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S1');
        }
    }

    // Test 2: Collateral cannot be deposited
    function test_collateralCannotBeDeposited() public {
        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), 100);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        helper_exchangeRateChanges();
        try borrower.depositCollateral(requestId, 100, false) {
            revert('Collateral cannot be deposited');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    // Test 3: Withdrawable collateral remains zero
    function test_withdrawableCollateralIsZero() public {
        helper_exchangeRateChanges();
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);

        assertEq(_withdrawableCollateral, 0);
    }

    // Test 4: Collateral cannot be withdrawn
    function test_collateralCannotBeWithdrawn() public {
        helper_exchangeRateChanges();

        try borrower.withdrawCollateral(requestId, 1, false) {
            revert('Collateral cannot be withdrawn');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OCLB1');
        }
    }

    // Test 5: All Collateral cannot be withdrawn
    function test_allCollateralCannotBeWithdrawn() public {
        helper_exchangeRateChanges();

        try borrower.withdrawAllCollateral(requestId, false) {
            revert('All collateral cannot be withdrawn');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OCLB1');
        }
    }

    // Test 6: A cancelled PCL cannot be closed
    function test_pclCannotBeClosed() public {
        helper_exchangeRateChanges();

        try borrower.close(requestId) {
            revert('PCL cannot be closed');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OCLB1');
        }
    }

    // Test 7: Required collateral should not work
    function test_requiredCollateralReverts() public {
        helper_exchangeRateChanges();

        try pcl.getRequiredCollateral(requestId, request.borrowLimit / 2) {
            revert('Required collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }
    }

    // Test 8: Collateral tokens calculation should not work
    function test_totalCollateralTokensReverts() public {
        helper_exchangeRateChanges();

        try pcl.calculateTotalCollateralTokens(requestId) {
            revert('Total collateral tokens should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTCT1');
        }
    }

    // Test 9: Collateral ratio should not work
    function test_collateralRatioReverts() public {
        helper_exchangeRateChanges();

        try pcl.calculateCurrentCollateralRatio(requestId) {
            revert('Calculate collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }
    }

    // Test 10: A cancelled PCL cannnot be cancelled
    function test_pclCannotBeCancelled() public {
        helper_exchangeRateChanges();

        try borrower.cancelRequest(requestId) {
            revert('PCL cannot be cancelled');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OCLB1');
        }
    }

    // Test 11: Admin should not be able to terminate
    function test_adminCannotTerminatePCL() public {
        helper_exchangeRateChanges();

        // Admin terminates the PCL
        try admin.terminate(requestId) {
            revert('Admin cannot terminate a cancelled PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTCT1');
        }
    }

    // Test 12: Borrowable amount remains zero
    function test_borrowableAmountIsZero() public {
        helper_exchangeRateChanges();

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        assertEq(_borrowableAmount, 0);
    }

    // Test 13: Borrower cannot repay
    function test_borrowerCannotRepay() public {
        helper_exchangeRateChanges();

        admin.transferToken(address(borrowAsset), address(borrower), 1);
        borrower.setAllowance(address(pcl), address(borrowAsset), type(uint256).max);
        try borrower.repay(requestId, 1) {
            revert('Borrower cannot repay');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:REP2');
        }
    }

    // Test 14: A cancelled PCL cannot be liquidated
    function test_lendersCannotLiquidate(bool _withdraw) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_exchangeRateChanges();

        // _lender0 tries to liquidate the PCL
        try _lender0.liquidate(requestId, _withdraw) {
            revert('Cannot liquidate a cancelled PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    // Test 15: Lenders cannot withdraw liquidation
    function test_lendersCannotWithdrawLiquidation() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_exchangeRateChanges();

        try _lender0.withdrawTokensAfterLiquidation(requestId) {
            revert('Cannot withdraw liquidation from a cancelled PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    // Test 16: Lenders can withdraw liquidity
    function test_lendersCanWithdrawLiquidity() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        uint256 _userPoolTokenBalance = lp.balanceOf(address(_lender0), requestId);

        helper_exchangeRateChanges();

        uint256 _userBorrowTokenBalanceBefore = IERC20(request.borrowAsset).balanceOf(address(_lender0));
        _lender0.withdrawLiquidity(requestId);
        uint256 _userBorrowTokenBalanceAfter = IERC20(request.borrowAsset).balanceOf(address(_lender0));
        assertEq(_userPoolTokenBalance, _userBorrowTokenBalanceAfter - _userBorrowTokenBalanceBefore);

        _userPoolTokenBalance = lp.balanceOf(address(_lender0), requestId);
        assertEq(_userPoolTokenBalance, 0);
    }

    // Test 17: Pool token transfers should be possible
    function test_poolTokenTransfersShouldBePossibleEntireBalance() public {
        PCLUser lender0 = PCLUser(lenders[0].lenderAddress);
        PCLUser lender1 = PCLUser(lenders[1].lenderAddress);
        PCLUser lender2 = PCLUser(lenders[2].lenderAddress);
        PCLUser lender3 = PCLUser(lenders[3].lenderAddress);

        // Ensuring that these lenders indeed had lent something
        uint256 lender0PoolTokenBalance = lp.balanceOf(address(lender0), requestId);
        uint256 lender1PoolTokenBalance = lp.balanceOf(address(lender1), requestId);
        uint256 lender2PoolTokenBalance = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalance = lp.balanceOf(address(lender3), requestId);

        assertGt(lender0PoolTokenBalance, 0);
        assertGt(lender1PoolTokenBalance, 0);
        assertGt(lender2PoolTokenBalance, 0);
        assertGt(lender3PoolTokenBalance, 0);

        // Lender0 transfers pool tokens to lender1
        lender0.transferLPTokens(address(lender1), requestId, lender0PoolTokenBalance);

        //Checking the transfer took place or not
        uint256 lender0PoolTokenBalanceFinal = lp.balanceOf(address(lender0), requestId);
        uint256 lender1PoolTokenBalanceFinal = lp.balanceOf(address(lender1), requestId);

        assertEq(lender0PoolTokenBalanceFinal, 0);
        assertTrue(lender1PoolTokenBalanceFinal == (lender0PoolTokenBalance + lender1PoolTokenBalance));

        // Price fluctuations take place
        helper_exchangeRateChanges();

        // Lender2 transfers pool tokens to lender3
        lender2.transferLPTokens(address(lender3), requestId, lender2PoolTokenBalance);

        uint256 lender2PoolTokenBalanceFinal = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalanceFinal = lp.balanceOf(address(lender3), requestId);

        // Checking whether the transfer took place or not
        assertTrue(lender2PoolTokenBalanceFinal == 0);
        assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance + lender3PoolTokenBalance));
    }

    // Test 17.1: Pool token transfers should be possible
    function test_poolTokenTransfersShouldBePossiblePartialBalance() public {
        PCLUser lender0 = PCLUser(lenders[0].lenderAddress);
        PCLUser lender1 = PCLUser(lenders[1].lenderAddress);
        PCLUser lender2 = PCLUser(lenders[2].lenderAddress);
        PCLUser lender3 = PCLUser(lenders[3].lenderAddress);

        // Ensuring that these lenders indeed had lent something
        uint256 lender0PoolTokenBalance = lp.balanceOf(address(lender0), requestId);
        uint256 lender1PoolTokenBalance = lp.balanceOf(address(lender1), requestId);
        uint256 lender2PoolTokenBalance = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalance = lp.balanceOf(address(lender3), requestId);

        assertGt(lender0PoolTokenBalance, 0);
        assertGt(lender1PoolTokenBalance, 0);
        assertGt(lender2PoolTokenBalance, 0);
        assertGt(lender3PoolTokenBalance, 0);

        // Lender0 transfers pool tokens to lender1
        lender0.transferLPTokens(address(lender1), requestId, lender0PoolTokenBalance / 2);

        // Checking the transfer took place or not
        uint256 lender0PoolTokenBalanceFinal = lp.balanceOf(address(lender0), requestId);
        uint256 lender1PoolTokenBalanceFinal = lp.balanceOf(address(lender1), requestId);

        assertEq(lender0PoolTokenBalanceFinal, lender0PoolTokenBalance - lender0PoolTokenBalance / 2);
        assertTrue(lender1PoolTokenBalanceFinal == (lender0PoolTokenBalance / 2 + lender1PoolTokenBalance));

        // Price fluctuations take place
        helper_exchangeRateChanges();

        // Lender2 transfers pool tokens to lender3
        lender2.transferLPTokens(address(lender3), requestId, lender2PoolTokenBalance / 4);

        uint256 lender2PoolTokenBalanceFinal = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalanceFinal = lp.balanceOf(address(lender3), requestId);

        // Checking whether the transfer took place or not
        assertTrue(lender2PoolTokenBalanceFinal == lender2PoolTokenBalance - lender2PoolTokenBalance / 4);
        assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance / 4 + lender3PoolTokenBalance));
    }

    // Test 18: Interest cannot be withdrawn amidst exchange rate fluctuations
    function test_lendersCannotWithdrawInterest() public {
        PCLUser lender0 = PCLUser(lenders[0].lenderAddress);
        PCLUser lender1 = PCLUser(lenders[1].lenderAddress);

        // Ensuring that these lenders indeed had lent something
        uint256 lender0PoolTokenBalance = lp.balanceOf(address(lender0), requestId);
        uint256 lender0Balance = borrowAsset.balanceOf(address(lender0));

        uint256 lender1PoolTokenBalance = lp.balanceOf(address(lender1), requestId);
        uint256 lender1Balance = borrowAsset.balanceOf(address(lender1));

        assertGt(lender0PoolTokenBalance, 0);
        assertGt(lender1PoolTokenBalance, 0);

        // Fetching the interest owed to lenders
        uint256 lender0InterestOwed = lp.getLenderInterestWithdrawable(requestId, address(lender0));
        uint256 lender1InterestOwed = lp.getLenderInterestWithdrawable(requestId, address(lender1));

        helper_exchangeRateChanges();

        try lender1.withdrawInterest(requestId) {
            revert('Interest cannot be withdrawn');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:WI1');
        }
    }

    uint256 _principal;
    uint256 _currentCR1;
    uint256 _currentCR2;
    uint256 _currentCR3;
    uint256 _principalWithdrawable;
    uint256 _withdrawableCollateral;
    uint256 _currentDebt;
    uint256 _borrowable;
    uint256 _totalCollateral;
    uint256 _equivalentCollateral;
    uint256 _interestAccrued;

    uint256 collateralToDeposit;

    function assert_helperFunctionalities(uint256 _id) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CANCELLED);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 1. calculateCurrentCollateralRatio
        try _borrower.calculateCurrentCollateralRatio(_id) {
            revert('Collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }

        helper_exchangeRateChanges();

        // 2. calculatePrincipalWithdrawable
        _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
        assertEq(_principalWithdrawable, lp.balanceOf(address(_lender), requestId));

        helper_exchangeRateChanges();

        // 3. withdrawableCollateral
        _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertEq(_withdrawableCollateral, 0);

        helper_exchangeRateChanges();

        // 4. calculateCurrentDebt
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        assertEq(_currentDebt, 0); // Since nothing was borrowed

        helper_exchangeRateChanges();

        // 5. calculateBorrowableAmount
        _borrowable = _borrower.calculateBorrowableAmount(_id);
        assertEq(_borrowable, 0); // Since collateral was not deposited

        helper_exchangeRateChanges();

        // 6. calculateTotalCollateralTokens
        try _borrower.calculateTotalCollateralTokens(_id) {
            revert('Total collateral tokens should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTCT1');
        }

        helper_exchangeRateChanges();

        // 7. collateralTokensToLiquidate
        try _borrower.collateralTokensToLiquidate(_id, lp.totalSupply(_id)) {
            revert('Collateral tokens to liquidate should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTTL1');
        }

        helper_exchangeRateChanges();

        // 8. calculateInterestAccrued
        _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertEq(_interestAccrued, 0); // Since borrower did not borrow anything

        helper_exchangeRateChanges();
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CANCELLED);
    }

    function test_helperFunctions() public {
        assert_helperFunctionalities(requestId);
    }
}
