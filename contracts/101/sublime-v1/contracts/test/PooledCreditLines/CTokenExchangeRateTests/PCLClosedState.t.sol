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

contract PCLClosedStateCToken is IPooledCreditLineDeclarations, PCLParent {
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
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = compoundYieldAddress;
        request.collateralAssetStrategy = compoundYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        assertEq(uint256(pcl.getStatusAndUpdate(requestId)), uint256(1));

        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);
        lender_0 = lenders[0].lenderAddress;

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        // Now the borrower finds out the collateral he is required to deposit
        uint256 _requiredCollateral = borrower.getRequiredCollateral(requestId, request.borrowLimit);
        // & deposits the required collateral (this involves getting the collateral from the admin and giving allowance to the PCL)
        admin.transferToken(request.collateralAsset, address(borrower), _requiredCollateral);
        borrower.setAllowance(address(pcl), request.collateralAsset, _requiredCollateral);
        borrower.depositCollateral(requestId, _requiredCollateral, false);

        // Now the borrower calculates the borrowable amount
        uint256 borrowableAmount = borrower.calculateBorrowableAmount(requestId);
        // and borrows the borrowable amount
        borrower.borrow(requestId, borrowableAmount);

        // Borrower decides to repay everything at mid-duration

        // Time travel to mid-duration
        vm.warp(block.timestamp + request.duration / 10);
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

    // Test 0: Test SetUp
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED, '!Closed');

        uint256 _borrowCTokenExchangeRate = MockCToken(borrowCTokenAddress).exchangeRateCurrent();
        uint256 _collateralCTokenExchangeRate = MockCToken(collateralCTokenAddress).exchangeRateCurrent();

        // Checking out what are the exchange rates
        log_named_int('Borrow CToken Exchange Rate', int256(_borrowCTokenExchangeRate));
        log_named_int('Collateral CToken Exchange Rate', int256(_collateralCTokenExchangeRate));

        // Check the exchange rates of the borrow and collateral CTokens are non-zero
        assertGt(_borrowCTokenExchangeRate, 0);
        assertGt(_collateralCTokenExchangeRate, 0);
    }

    // Test 1: A closed PCL cannot be started even with exchange rate fluctuations
    function test_pclCannotBeStarted() public {
        helper_exchangeRateChanges();

        try borrower.start(requestId) {
            revert('Cannot start a closed PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S1');
        }
    }

    // Test 2: Collateral cannot be deposited
    function test_collateralCannotBeDeposited() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        helper_exchangeRateChanges();
        try borrower.depositCollateral(requestId, _minimumCollateralRequired, false) {
            revert('Collateral cannot be deposited');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    // Test 3: Withdrawable collateral remains zero
    function test_withdrawableCollateralIsZero() public {
        helper_exchangeRateChanges();
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);

        assertApproxEqAbs(_withdrawableCollateral, 0, 2);
    }

    // Test 4: Balance remains same after withdrawing collateral
    function test_balanceRemainsSameAfterWithdrawCollateral() public {
        helper_exchangeRateChanges();
        uint256 _borrowerBalanceBefore = collateralAsset.balanceOf(address(borrower));
        uint256 _tokens = (pcl.depositedCollateralInShares(requestId) * ICToken(collateralCTokenAddress).exchangeRateCurrent()) / 1e18;
        if (_tokens > 0) {
            borrower.withdrawCollateral(requestId, 1, false);
        } else {
            try borrower.withdrawCollateral(requestId, 1, false) {
                revert('Collateral cannot be withdrawn');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:WC1');
            }
        }
        uint256 _borrowerBalanceAfter = collateralAsset.balanceOf(address(borrower));
        assertApproxEqAbs(_borrowerBalanceAfter, _borrowerBalanceBefore, 2);
    }

    // Test 5: Balance remains same after withdrawing all collateral
    function test_balanceRemainsSameAfterWithdrawAllCollateral() public {
        helper_exchangeRateChanges();
        uint256 _borrowerBalanceBefore = collateralAsset.balanceOf(address(borrower));
        uint256 _tokens = (pcl.depositedCollateralInShares(requestId) * ICToken(collateralCTokenAddress).exchangeRateCurrent()) / 1e18;
        if (_tokens > 0) {
            borrower.withdrawAllCollateral(requestId, false);
        } else {
            try borrower.withdrawAllCollateral(requestId, false) {
                revert('All Collateral cannot be withdrawn');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:WAC1');
            }
        }
        uint256 _borrowerBalanceAfter = collateralAsset.balanceOf(address(borrower));
        assertApproxEqAbs(_borrowerBalanceAfter, _borrowerBalanceBefore, 2);
    }

    // Test 6: A closed PCL cannot be closed
    function test_pclCannotBeClosed() public {
        helper_exchangeRateChanges();

        try borrower.close(requestId) {
            revert('PCL cannot be closed');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:C1');
        }
    }

    // Test 7: Required collateral remains same if collateral CToken exchange rate increases steeply
    function test_requiredCollateralRemainsSameIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertEq(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 7.1: Required collateral remains same if borrow CToken exchange rate increases steeply
    function test_requiredCollateralRemainsSameIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseExchangeRateSteeply(borrowCTokenAddress);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertEq(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 7.2: Required collateral remains same if borrow CToken exchange rate decreases to zero
    function test_requiredCollateralRemainSameIfBorrowCTokenExchangeRateDecreasesToZero() public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertEq(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 7.3: Required collateral remains same if collateral CToken exchange rate decreases to zero
    function test_requiredCollateralRemainsSameIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertEq(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 7.4: Required collateral remains same if collateral CToken exchange rate increases very slowly
    function test_requiredCollateralRemainsSameIfCollateralCTokenExchangeRateIncreasesSlowly() public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseExchangeRateSlowly(collateralCTokenAddress);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertEq(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 8: Collateral tokens remains zero if collateral CToken exchange rate increases steeply
    function test_totalCollateralTokensRemainsZeroIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        uint256 _collateralTokens = pcl.calculateTotalCollateralTokens(requestId);
        assertApproxEqAbs(_collateralTokens, 0, 2);
    }

    // Test 8.1: Collateral tokens may revert if collateral CToken exchange rate decreases to zero
    function test_totalCollateralTokensMayRevertIfCollateralCTokenExchangeRateDecreasesToZero() public {
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);

        uint256 _shares = pcl.depositedCollateralInShares(requestId);
        if (_shares > 0) {
            try pcl.calculateTotalCollateralTokens(requestId) {
                revert('Total collateral tokens should revert');
            } catch Error(string memory reason) {
                assertEq(reason, 'CY:GTFS1');
            }
        } else {
            uint256 _collateralTokens = pcl.calculateTotalCollateralTokens(requestId);
            assertEq(_collateralTokens, 0);
        }
    }

    // Test 9: Collateral ratio remains infinite
    function test_collateralRatioIsInfinite() public {
        helper_exchangeRateChanges();
        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);

        assertEq(_collateralRatio, type(uint256).max);
    }

    // Test 10: A Closed PCL cannot be cancelled
    function test_pclCannotBeCancelled() public {
        helper_exchangeRateChanges();

        try borrower.cancelRequest(requestId) {
            revert('PCL cannot be cancelled');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    // Test 11: Admin can terminate pcl
    function test_adminCanTerminatePCL() public {
        helper_exchangeRateChanges();

        uint256 _adminBorrowTokenBalancePreTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePreTerminate = collateralAsset.balanceOf(address(admin));

        admin.terminate(requestId);
        uint256 _adminBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(admin));

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED);
        assertGe((_adminCollateralTokenBalancePostTerminate - _adminCollateralTokenBalancePreTerminate), 0);
        assertGt(_adminBorrowTokenBalancePostTerminate - _adminBorrowTokenBalancePreTerminate, 0);
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

    // Test 14: A requested PCL cannot be liquidated
    function test_lendersCannotLiquidate(bool _withdraw) public {
        helper_exchangeRateChanges();

        // lender_0 tries to liquidate the PCL
        try PCLUser(lender_0).liquidate(requestId, _withdraw) {
            revert('Cannot liquidate a closed PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    // Test 15: Lenders cannot withdraw liquidated collateral tokens
    function test_lendersCannotWithdrawLiquidation() public {
        helper_exchangeRateChanges();

        // lender_0 tries to withdraw the liquidated collateral tokens
        try PCLUser(lender_0).withdrawTokensAfterLiquidation(requestId) {
            revert('Cannot withdraw liquidation from a closed PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    // Test 16: Lenders can withdraw liquidity
    function test_lendersCanWithdrawLiquidity() public {
        helper_exchangeRateChanges();

        uint256 _userPoolTokenBalance = lp.balanceOf(lender_0, requestId);
        uint256 _userInterestOwed = lp.getLenderInterestWithdrawable(requestId, lender_0);

        uint256 _userBorrowTokenBalanceBefore = IERC20(request.borrowAsset).balanceOf(lender_0);
        PCLUser(lender_0).withdrawLiquidity(requestId);
        uint256 _userBorrowTokenBalanceAfter = IERC20(request.borrowAsset).balanceOf(lender_0);
        assertApproxEqRel(
            _userPoolTokenBalance + _userInterestOwed,
            _userBorrowTokenBalanceAfter - _userBorrowTokenBalanceBefore,
            0.0001e18
        );

        _userPoolTokenBalance = lp.balanceOf(lender_0, requestId);
        _userInterestOwed = lp.getLenderInterestWithdrawable(requestId, lender_0);
        assertEq(_userPoolTokenBalance, 0);
        assertEq(_userInterestOwed, 0);
    }

    // Test 17: Pool token transfers should be possible in a closed PCL
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

        // Checking the transfer took place or not
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

    // Test 17.1: Pool token transfers should be possible in a closed PCL
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

    // Test 18: Interest can be withdrawn amidst price fluctuations
    function test_lendersCanWithdrawInterest() public {
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

        lender0.withdrawInterest(requestId);

        uint256 lender0BalanceFinal = borrowAsset.balanceOf(address(lender0));
        assertEq((lender0BalanceFinal - lender0Balance), lender0InterestOwed);

        helper_exchangeRateChanges();

        lender1.withdrawInterest(requestId);

        uint256 lender1BalanceFinal = borrowAsset.balanceOf(address(lender1));
        assertGt((lender1BalanceFinal - lender1Balance), lender1InterestOwed);
    }

    // Test 18.1: Interest that can be withdrawn increases
    function test_lenderInterestIncreasesIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        PCLUser lender0 = PCLUser(lenders[0].lenderAddress);

        // Fetching the interest owed to lenders
        uint256 lender0InterestOwed = lp.getLenderInterestWithdrawable(requestId, address(lender0));
        helper_increaseExchangeRateSteeply(borrowCTokenAddress);

        uint256 lender0InterestOwedNew = lp.getLenderInterestWithdrawable(requestId, address(lender0));
        assertLt(lender0InterestOwed, lender0InterestOwedNew);
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

    function assert_helperFunctionalitiesInClosedState(uint256 _id) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CLOSED);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 1. calculateCurrentCollateralRatio
        _currentCR1 = _borrower.calculateCurrentCollateralRatio(_id);
        assertEq(_currentCR1, uint256(-1));

        helper_exchangeRateChanges();

        // 2. calculatePrincipalWithdrawable
        _principalWithdrawable = lp.calculatePrincipalWithdrawable(_id, address(_lender));
        assertEq(_principalWithdrawable, lp.balanceOf(address(_lender), requestId));

        helper_exchangeRateChanges();

        // 3. withdrawableCollateral
        _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertApproxEqAbs(_withdrawableCollateral, 0, 2);

        helper_exchangeRateChanges();

        // 4. calculateCurrentDebt
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        assertEq(_currentDebt, 0);

        helper_exchangeRateChanges();

        // 5. calculateBorrowableAmount
        _borrowable = _borrower.calculateBorrowableAmount(_id);
        assertEq(_borrowable, 0);

        helper_exchangeRateChanges();

        // 6. calculateTotalCollateralTokens
        _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
        assertApproxEqAbs(_totalCollateral, 0, 2);

        helper_exchangeRateChanges();

        // 7. collateralTokensToLiquidate
        _equivalentCollateral = _borrower.collateralTokensToLiquidate(_id, lp.totalSupply(_id));
        assertGt(_equivalentCollateral, 0);

        helper_exchangeRateChanges();

        // 8. calculateInterestAccrued
        _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertGt(_interestAccrued, 0);

        helper_exchangeRateChanges();
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CLOSED);
    }

    function test_helperFunctionsInClosedState() public {
        assert_helperFunctionalitiesInClosedState(requestId);
    }
}
