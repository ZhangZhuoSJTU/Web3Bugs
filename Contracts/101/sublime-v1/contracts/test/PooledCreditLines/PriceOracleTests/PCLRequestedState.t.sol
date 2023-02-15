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

contract PCLRequestedStatePriceOracle is IPooledCreditLineDeclarations, PCLParent {
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

        requestId = borrower.createRequest(request);
        assertEq(uint256(pcl.getStatusAndUpdate(requestId)), uint256(1));
    }

    // Test 0: Test SetUp
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED, '!Requested');

        (, int256 _borrowAssetPrice, , , ) = MockV3Aggregator(borrowAssetAggregatorAddress).latestRoundData();
        (, int256 _collateralAssetPrice, , , ) = MockV3Aggregator(collateralAssetAggregatorAddress).latestRoundData();

        // Checking out what are the prices
        log_named_int('Borrow Asset Price', _borrowAssetPrice);
        log_named_int('Collateral Asset Price', _collateralAssetPrice);

        // Check the prices of the borrowAsset and collateralAsset are non-zero
        assertGt(_borrowAssetPrice, 0);
        assertGt(_collateralAssetPrice, 0);
    }

    // Test 1: A requested PCL cannot be started even with price fluctuations
    function test_pclCannotBeStarted(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.start(requestId) {
            revert('Cannot start a PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S2');
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
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);

        assertEq(_withdrawableCollateral, 0);
    }

    // Test 3.1: Collateral cannot be withdrawn
    function test_collateralCannotBeWithdrawn(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.withdrawCollateral(requestId, 1, false) {
            revert('Collateral cannot be withdrawn');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WC1');
        }
    }

    // Test 3.2: All Collateral cannot be withdrawn
    function test_allCollateralCannotBeWithdrawn(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.withdrawAllCollateral(requestId, false) {
            revert('Collateral cannot be withdrawn');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WAC1');
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

    // Test 6: A requested PCL cannot be closed
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
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try _lender0.withdrawLiquidation(requestId) {
            revert('Cannot withdraw liquidation from a requested PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    // Test 9: Lenders can withdraw liquidity
    function test_lendersCanWithdrawLiquidity(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        vm.warp(block.timestamp + (request.collectionPeriod + 2 days));
        uint256 _userPoolTokenBalance = lp.balanceOf(address(_lender0), requestId);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        uint256 _userBorrowTokenBalanceBefore = IERC20(request.borrowAsset).balanceOf(address(_lender0));
        _lender0.withdrawLiquidity(requestId);
        uint256 _userBorrowTokenBalanceAfter = IERC20(request.borrowAsset).balanceOf(address(_lender0));
        assertEq(_userPoolTokenBalance, _userBorrowTokenBalanceAfter - _userBorrowTokenBalanceBefore);

        _userPoolTokenBalance = lp.balanceOf(address(_lender0), requestId);
        assertEq(_userPoolTokenBalance, 0);
    }

    // Test 10: A requested PCL cannot be liquidated
    function test_lendersCannotLiquidate(
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed,
        bool _withdraw
    ) public {
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // _lender0 tries to liquidate the PCL
        try _lender0.liquidate(requestId, _withdraw) {
            revert('Cannot liquidate a requested PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    // Test 11: Admin should be able to terminate
    function test_adminCanTerminatePCL(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        uint256 _adminBorrowTokenBalancePreTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePreTerminate = collateralAsset.balanceOf(address(admin));

        // Admin terminates the PCL
        admin.terminate(requestId);

        uint256 _adminBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(admin));

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED);
        assertTrue((_adminCollateralTokenBalancePostTerminate - _adminCollateralTokenBalancePreTerminate) == 0); // Since no collateral was ever deposited
        assertTrue((_adminBorrowTokenBalancePostTerminate - _adminBorrowTokenBalancePreTerminate) == 0);
    }

    // Test 12: Pool token transfers should be possible
    function test_poolTokenTransfersShouldBePossibleEntireBalance(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);
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
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 100), request.borrowAsset);
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

    // Test 13: Interest cannot be withdrawn amidst price fluctuations
    function test_lendersCannotWithdrawInterest(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);
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
        uint256 lender0InterestOwed = lender0.getLenderInterest(requestId, address(lender0));
        uint256 lender1InterestOwed = lender1.getLenderInterest(requestId, address(lender1));

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try lender1.withdrawInterest(requestId) {
            revert('Interest cannot be withdrawn');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:WI1');
        }
    }

    // Test 14: A requested PCL can be cancelled
    function test_pclCanBeCancelled(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        createMultipleLenders(requestId, 5, uint128(request.borrowLimit - 10), request.borrowAsset);
        vm.warp(block.timestamp + (request.collectionPeriod - 1 days));

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        borrower.cancelRequest(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function assert_helperFunctionalitiesInRequestedState(
        uint256 _id,
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed
    ) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);
        createMultipleLenders(requestId, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 1. calculateCurrentCollateralRatio
        {
            uint256 _currentCR1 = _borrower.calculateCurrentCollateralRatio(_id);
            assertEq(_currentCR1, uint256(-1)); // Since borrower has not yet borrowed anything
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 2. calculatePrincipalWithdrawable
        {
            uint256 _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
            assertEq(_principalWithdrawable, 0); // Since the lenders cannot withdraw their liquidity from a requested PCL before its collection period
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 3. withdrawableCollateral
        {
            uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
            assertEq(_withdrawableCollateral, 0); // Since no collateral was deposited in the first place
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 4. calculateCurrentDebt
        {
            uint256 _currentDebt = _borrower.calculateCurrentDebt(_id);
            assertEq(_currentDebt, 0); // Since nothing was borrowed
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 5. calculateBorrowableAmount
        {
            uint256 _borrowable = _borrower.calculateBorrowableAmount(_id);
            assertEq(_borrowable, 0); // Since collateral was not deposited
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 6. calculateTotalCollateralTokens
        {
            uint256 _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
            assertEq(_totalCollateral, 0); // Since no collateral was deposited
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
            assertEq(_interestAccrued, 0); // Since borrower did not borrow anything
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);
    }

    function test_helperFunctionsInRequestedState(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        assert_helperFunctionalitiesInRequestedState(requestId, _borrowAssetPriceSeed, _collateralAssetPriceSeed);
    }
}
