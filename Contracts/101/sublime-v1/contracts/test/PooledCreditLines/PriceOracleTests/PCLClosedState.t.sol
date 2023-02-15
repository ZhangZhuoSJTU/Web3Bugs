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

contract PCLClosedStatePriceOracle is IPooledCreditLineDeclarations, PCLParent {
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

    function setUp() public virtual override {
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
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        //The below function will create the PCL request and then lenders lend the entire requested amount
        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);
        lender_0 = lenders[0].lenderAddress;

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
        // and borrows the borrowable amount
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

    // Test 0: Test SetUp
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED, '!Closed');

        (, int256 _borrowAssetPrice, , , ) = MockV3Aggregator(borrowAssetAggregatorAddress).latestRoundData();
        (, int256 _collateralAssetPrice, , , ) = MockV3Aggregator(collateralAssetAggregatorAddress).latestRoundData();

        // Checking out what are the prices
        log_named_int('Borrow Asset Price', _borrowAssetPrice);
        log_named_int('Collateral Asset Price', _collateralAssetPrice);

        // Check the prices of the borrowAsset and collateralAsset are non-zero
        assertGt(_borrowAssetPrice, 0);
        assertGt(_collateralAssetPrice, 0);
    }

    // Test 1: A Closed PCL cannot be started even with price fluctuations
    function test_pclCannotBeStarted(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.start(requestId) {
            revert('Cannot start a PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S1');
        }
    }

    // Test 2: Collateral cannot be deposited
    function test_collateralCannotBeDeposited(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        try borrower.depositCollateral(requestId, _minimumCollateralRequired, false) {
            revert('Collateral cannot be deposited');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    // Test 3: Withdrawable collateral remains zero
    function test_withdrawableCollateralIsZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);

        assertApproxEqAbs(_withdrawableCollateral, 0, 2);
    }

    // Test 3.1: Collateral can or cannot be withdrawn
    function test_collateralCanOrCannotBeWithdrawn(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        uint256 _tokens = (pcl.depositedCollateralInShares(requestId) * ICToken(collateralCTokenAddress).exchangeRateCurrent()) / 1e18;
        if (_tokens > 0) {
            uint256 _borrowerBalanceBefore = collateralAsset.balanceOf(address(borrower));
            borrower.withdrawCollateral(requestId, 1, false);
            uint256 _borrowerBalanceAfter = collateralAsset.balanceOf(address(borrower));
            assertGe(_borrowerBalanceAfter, _borrowerBalanceBefore);
        } else {
            try borrower.withdrawCollateral(requestId, 1, false) {
                revert('Collateral cannot be withdrawn');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:WC1');
            }
        }
    }

    // Test 3.2: All collateral can or cannot be withdrawn
    function test_allCollateralCanOrCannotBeWithdrawn(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        uint256 _tokens = (pcl.depositedCollateralInShares(requestId) * ICToken(collateralCTokenAddress).exchangeRateCurrent()) / 1e18;
        if (_tokens > 0) {
            uint256 _borrowerBalanceBefore = collateralAsset.balanceOf(address(borrower));
            borrower.withdrawAllCollateral(requestId, false);
            uint256 _borrowerBalanceAfter = collateralAsset.balanceOf(address(borrower));
            assertGe(_borrowerBalanceAfter, _borrowerBalanceBefore);
        } else {
            try borrower.withdrawAllCollateral(requestId, false) {
                revert('All collateral cannot be withdrawn');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:WAC1');
            }
        }
    }

    // Test 4: Required collateral decreases if collateral asset price increases
    function test_requiredCollateralDecreasesIfCollateralAssetPriceIncreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertGt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 4.1: Required collateral increases if borrow asset price increases
    function test_requiredCollateralIncreasesIfBorrowAssetPriceIncreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertLt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 4.2: Required collateral increases if collateral asset price decreases
    function test_requiredCollateralIncreasesIfCollateralAssetPriceDecreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertLt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 4.3: Required collateral decreases if borrow asset price decreases
    function test_requiredCollateralDecreasesIfBorrowAssetPriceDecreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertGt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 4.4: Required collateral reverts if borrow asset price decreases to 0
    function test_requiredCollateralRevertsIfBorrowAssetPriceDecreasesToZero(uint256 _seed) public {
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try pcl.getRequiredCollateral(requestId, request.borrowLimit / 2) {
            revert('Required collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 4.5: Required collateral reverts if collateral asset price decreases to 0
    function test_requiredCollateralRevertsIfCollateralAssetPriceDecreasesToZero(uint256 _seed) public {
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try pcl.getRequiredCollateral(requestId, request.borrowLimit / 2) {
            revert('Required collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 5: Borrowable amount remains zero
    function test_borrowableAmountIsZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        assertEq(_borrowableAmount, 0);
    }

    // Test 6: A Closed PCL cannot be closed
    function test_pclCannotBeClosed(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        try borrower.close(requestId) {
            revert('PCL cannot be closed');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:C1');
        }
    }

    // Test 7: Collateral ratio remains infinite
    function test_collateralRatioIsInfinite(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);

        assertEq(_collateralRatio, type(uint256).max);
    }

    // Test 7.1: Collateral ratio reverts if borrow asset price decreases to 0
    function test_collateralRatioRevertsIfBorrowAssetPriceDecreasesToZero() public {
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try pcl.calculateCurrentCollateralRatio(requestId) {
            revert('Collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 7.2: Collateral ratio reverts if collateral asset price decreases to 0
    function test_collateralRatioRevertsIfCollateralAssetPriceDecreasesToZero() public {
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try pcl.calculateCurrentCollateralRatio(requestId) {
            revert('Collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 8: Lenders cannot withdraw liquidation
    function test_lendersCannotWithdrawLiquidation(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try PCLUser(lender_0).withdrawLiquidation(requestId) {
            revert('Lender cannot withdraw liquidation tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    // Test 9: Lenders can withdraw liquidity
    function test_lendersCanWithdrawLiquidity(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        uint256 _userPoolTokenBalance = lp.balanceOf(lender_0, requestId);
        uint256 _lenderInterestOwed = lp.getLenderInterestWithdrawable(requestId, lender_0);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        uint256 _userBorrowTokenBalanceBefore = IERC20(request.borrowAsset).balanceOf(lender_0);
        PCLUser(lender_0).withdrawLiquidity(requestId);
        uint256 _userBorrowTokenBalanceAfter = IERC20(request.borrowAsset).balanceOf(lender_0);
        assertApproxEqRel(_userPoolTokenBalance + _lenderInterestOwed, _userBorrowTokenBalanceAfter - _userBorrowTokenBalanceBefore, 1e16);

        _userPoolTokenBalance = lp.balanceOf(lender_0, requestId);
        _lenderInterestOwed = lp.getLenderInterestWithdrawable(requestId, lender_0);
        assertEq(_userPoolTokenBalance, 0);
        assertEq(_lenderInterestOwed, 0);
    }

    // Test 10: A Closed PCL cannot be liquidated
    function test_lendersCannotLiquidate(
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed,
        bool _withdraw
    ) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // lender_0 tries to liquidate the PCL
        try PCLUser(lender_0).liquidate(requestId, _withdraw) {
            revert('Cannot liquidate a Closed PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    // Test 11: Admin can terminate pcl
    function test_adminCanTerminatePCL(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        uint256 _adminBorrowTokenBalancePreTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePreTerminate = collateralAsset.balanceOf(address(admin));

        admin.terminate(requestId);
        uint256 _adminBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(admin));

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED);
        assertGe((_adminCollateralTokenBalancePostTerminate - _adminCollateralTokenBalancePreTerminate), 0);
        assertGt(_adminBorrowTokenBalancePostTerminate - _adminBorrowTokenBalancePreTerminate, 0);
    }

    // Test 12: Pool token transfers should be possible
    function test_poolTokenTransfersShouldBePossibleEntireBalance(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
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
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // Lender2 transfers pool tokens to lender3
        lender2.transferLPTokens(address(lender3), requestId, lender2PoolTokenBalance);

        uint256 lender2PoolTokenBalanceFinal = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalanceFinal = lp.balanceOf(address(lender3), requestId);

        // Checking whether the transfer took place or not
        assertTrue(lender2PoolTokenBalanceFinal == 0);
        assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance + lender3PoolTokenBalance));
    }

    // Test 12.1: Pool token transfers should be possible
    function test_poolTokenTransfersShouldBePossiblePartialBalance(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed)
        public
    {
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
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // Lender2 transfers pool tokens to lender3
        lender2.transferLPTokens(address(lender3), requestId, lender2PoolTokenBalance / 4);

        uint256 lender2PoolTokenBalanceFinal = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalanceFinal = lp.balanceOf(address(lender3), requestId);

        // Checking whether the transfer took place or not
        assertTrue(lender2PoolTokenBalanceFinal == lender2PoolTokenBalance - lender2PoolTokenBalance / 4);
        assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance / 4 + lender3PoolTokenBalance));
    }

    // Test 13: Interest can be withdrawn amidst price fluctuations
    function test_lendersCanWithdrawInterest(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
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

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        lender1.withdrawInterest(requestId);
        uint256 lender1BalanceAfter = borrowAsset.balanceOf(address(lender1));
        assertEq(lender1BalanceAfter, lender1Balance + lender1InterestOwed);
        assertEq(lp.getLenderInterestWithdrawable(requestId, address(lender1)), 0);
    }

    // Test 14: A Closed PCL cannot be cancelled
    function test_pclCannotBeCancelled(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        try borrower.cancelRequest(requestId) {
            revert('PCL cannot be cancelled');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    function assert_helperFunctionalitiesInClosedState(
        uint256 _id,
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed
    ) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CLOSED);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 1. calculateCurrentCollateralRatio
        {
            uint256 _currentCR1 = _borrower.calculateCurrentCollateralRatio(_id);
            assertEq(_currentCR1, uint256(-1));
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 2. calculatePrincipalWithdrawable
        {
            uint256 _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
            assertGt(_principalWithdrawable, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 3. withdrawableCollateral
        {
            uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
            assertApproxEqAbs(_withdrawableCollateral, 0, 2);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 4. calculateCurrentDebt
        {
            uint256 _currentDebt = _borrower.calculateCurrentDebt(_id);
            assertEq(_currentDebt, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 5. calculateBorrowableAmount
        {
            uint256 _borrowable = _borrower.calculateBorrowableAmount(_id);
            assertEq(_borrowable, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 6. calculateTotalCollateralTokens
        {
            uint256 _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
            assertApproxEqAbs(_totalCollateral, 0, 2);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 7. collateralTokensToLiquidate
        {
            uint256 _equivalentCollateral = _borrower.collateralTokensToLiquidate(_id, lp.totalSupply(_id));
            assertGt(_equivalentCollateral, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 8. calculateInterestAccrued
        {
            uint256 _interestAccrued = _borrower.calculateInterestAccrued(_id);
            assertGt(_interestAccrued, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CLOSED);
    }

    function test_helperFunctionsInClosedState(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        assert_helperFunctionalitiesInClosedState(requestId, _borrowAssetPriceSeed, _collateralAssetPriceSeed);
    }
}
