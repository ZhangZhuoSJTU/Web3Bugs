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

contract PCLActiveStateCToken is IPooledCreditLineDeclarations, PCLParent {
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');
    }

    // Test 0: Test SetUp
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        uint256 _borrowCTokenExchangeRate = MockCToken(borrowCTokenAddress).exchangeRateCurrent();
        uint256 _collateralCTokenExchangeRate = MockCToken(collateralCTokenAddress).exchangeRateCurrent();

        // Checking out what are the exchange rates
        log_named_int('Borrow CToken Exchange Rate', int256(_borrowCTokenExchangeRate));
        log_named_int('Collateral CToken Exchange Rate', int256(_collateralCTokenExchangeRate));

        // Check the exchange rates of the borrow and collateral CTokens are non-zero
        assertGt(_borrowCTokenExchangeRate, 0);
        assertGt(_collateralCTokenExchangeRate, 0);
    }

    // Test 1: An active PCL cannot be started even with exchange rate fluctuations
    function test_pclCannotBeStarted() public {
        helper_exchangeRateChanges();

        try borrower.start(requestId) {
            revert('Cannot start an Active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S1');
        }
    }

    // Test 2: Collateral can be deposited
    function test_collateralCanBeDeposited() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        helper_exchangeRateChanges();
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        assertGt(pcl.depositedCollateralInShares(requestId), 0);
    }

    // Test 3: Withdrawable collateral increases if collateral CToken exchange rate increases steeply
    function test_withdrawableCollateralIncreasesIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertLt(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.1: Withdrawable collateral decreases if collateral CToken exchange rate increases very slowly
    // increase slowly wrt to interest rate of the pcl
    function test_withdrawableCollateralDecreasesIfCollateralCTokenExchangeRateIncreasesSlowly() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseExchangeRateSlowly(collateralCTokenAddress);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertGt(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.2: Withdrawable collateral remains unchanged if borrow CToken exchange rate decreases to zero
    function test_withdrawableCollateralRemainsSameIfBorrowCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertEq(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.3: Withdrawable collateral reverts if collateral CToken exchange rate decreases to zero
    function test_withdrawableCollateralRevertsIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try pcl.withdrawableCollateral(requestId) {
            revert('Withdrawable collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 4: Withdraw collateral works if collateral CToken exchange rate increases steeply
    function test_withdrawCollateralWorksIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        borrower.withdrawCollateral(requestId, _withdrawableCollateral, false);
    }

    // Test 4.1: Withdraw collateral works if borrow CToken exchange rate increases steeply
    function test_withdrawCollateralWorksIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 _interestAccrued = pcl.calculateInterestAccrued(requestId);
        uint256 _additionalDebtCollateral = _interestAccrued.mul(request.collateralRatio).div(_ratioOfPrices).mul(10**_decimals).div(1e18);

        borrower.withdrawCollateral(requestId, _withdrawableCollateral - _additionalDebtCollateral, false);
    }

    // Test 4.2: Withdraw collateral works if borrow CToken exchange rate decreases to zero
    function test_withdrawCollateralWorksIfBorrowCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        borrower.withdrawCollateral(requestId, _withdrawableCollateral, false);
    }

    // Test 4.3: Withdraw collateral reverts if collateral CToken exchange rate decreases to zero
    function test_withdrawCollateralRevertsIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try borrower.withdrawCollateral(requestId, _withdrawableCollateral, false) {
            revert('Withdrawable collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 5: Withdraw all collateral works if collateral CToken exchange rate increases steeply
    function test_withdrawAllCollateralWorksIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        borrower.withdrawAllCollateral(requestId, false);
    }

    // Test 5.1: Withdraw all collateral works if borrow CToken exchange rate increases steeply
    function test_withdrawAllCollateralWorksIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_increaseExchangeRateSteeply(borrowCTokenAddress);
        borrower.withdrawAllCollateral(requestId, false);
    }

    // Test 5.2: Withdraw all collateral works if borrow CToken exchange rate decreases to zero
    function test_withdrawAllCollateralWorksIfBorrowCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        borrower.withdrawAllCollateral(requestId, false);
    }

    // Test 5.3: Withdraw all collateral reverts if collateral CToken exchange rate decreases to zero
    function test_withdrawAllCollateralRevertsIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try borrower.withdrawAllCollateral(requestId, false) {
            revert('Withdrawable collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 6: An active PCL (with principal == 0) can be closed even with exchange rate fluctuations
    function test_pclCanBeClosedIfPrincipalIsZero() public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        helper_exchangeRateChanges();
        borrower.close(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED, '!Closed');
    }

    // Test 6.1: An active PCL (with principal != 0) cannot be closed even with exchange rate fluctuations
    function test_pclCannotBeClosedPrincipalIsNonZero() public {
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
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

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

        // Exchange rate fluctuations take place
        helper_exchangeRateChanges();

        try borrower.close(requestId) {
            revert('Cannot close PCL when principal != 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:C2');
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

    // Test 8: Collateral tokens increases if collateral CToken exchange rate increases steeply
    function test_totalCollateralTokensIncreasesIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralTokens = pcl.calculateTotalCollateralTokens(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        uint256 _collateralTokensNew = pcl.calculateTotalCollateralTokens(requestId);

        assertLt(_collateralTokens, _collateralTokensNew);
    }

    // Test 8.1: Collateral tokens reverts if collateral CToken exchange rate decreases to zero
    function test_totalCollateralTokensRevertsIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralTokens = pcl.calculateTotalCollateralTokens(requestId);
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try pcl.calculateTotalCollateralTokens(requestId) {
            revert('Total collateral tokens should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 9: Collateral ratio increases if collateral CToken exchange rate increases steeply
    function test_collateralRatioIncreasesIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertLt(_collateralRatio, _collateralRatioNew);
    }

    // Test 9.1: Collateral ratio increases if borrow CToken exchange rate increases steeply
    function test_collateralRatioIncreasesIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        uint256 _currentDebt = pcl.calculateCurrentDebt(requestId);
        helper_increaseExchangeRateSteeply(borrowCTokenAddress);

        uint256 _interestAccrued = pcl.calculateInterestAccrued(requestId);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertLt(_collateralRatio, (_collateralRatioNew * (_currentDebt + _interestAccrued)) / _currentDebt);
    }

    // Test 9.2: Collateral ratio remains same if borrow CToken exchange rate decreases to zero
    function test_collateralRatioRemaisSameIfBorrowCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertEq(_collateralRatio, _collateralRatioNew);
    }

    // Test 9.3: Collateral ratio reverts if collateral CToken exchange rate decreases to zero
    function test_collateralRatioRevertsIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try pcl.calculateCurrentCollateralRatio(requestId) {
            revert('Collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 9.4: Collateral ratio decreases if collateral CToken exchange rate increases very slowly
    function test_collateralRatioDecreasesIfCollateralCTokenExchangeRateIncreasesSlowly() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_increaseExchangeRateSlowly(collateralCTokenAddress);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertGt(_collateralRatio, _collateralRatioNew);
    }

    // Test 10: An active PCL cannot be cancelled if principal == 0
    function test_borrowerCannotCancelActivePCLPrincipalIsZero() public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        helper_exchangeRateChanges();

        try borrower.cancelRequest(requestId) {
            revert('Cannot cancel an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    // Test 10.1: An active PCL cannot be cancelled if principal != 0
    function test_borrowerCannotCancelActivePCLPrincipalIsNonZero() public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        // Let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

            // We want to deposit collateral now
            borrower.depositCollateral(requestId, collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount / 2);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        (, _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

        helper_exchangeRateChanges();

        try borrower.cancelRequest(requestId) {
            revert('Cannot cancel an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    // Test 11: Admin should be able to terminate an ACTIVE PCL with principal == 0
    function test_adminCanTerminatePCLPrincipalIsZero() public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        helper_exchangeRateChanges();

        uint256 _adminBorrowTokenBalancePreTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePreTerminate = collateralAsset.balanceOf(address(admin));

        // Admin terminates the PCL
        admin.terminate(requestId);

        uint256 _adminBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(admin));

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED);
        assertTrue((_adminCollateralTokenBalancePostTerminate - _adminCollateralTokenBalancePreTerminate) == 0); // Since no collateral was ever deposited
        assertGt((_adminBorrowTokenBalancePostTerminate - _adminBorrowTokenBalancePreTerminate), 0);
    }

    // Test 11.1: Admin should be able to terminate an ACTIVE PCL with principal != 0
    function test_adminCanTerminatePCLPrincipalIsNonZero() public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        // Let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

            // We want to deposit collateral now
            borrower.depositCollateral(requestId, collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount / 2);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        (, _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

        helper_exchangeRateChanges();

        uint256 _adminBorrowTokenBalancePreTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePreTerminate = collateralAsset.balanceOf(address(admin));

        // Admin terminates the PCL
        admin.terminate(requestId);

        uint256 _adminBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(admin));
        uint256 _adminCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(admin));

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED);
        assertGt((_adminCollateralTokenBalancePostTerminate - _adminCollateralTokenBalancePreTerminate), 0); // Since collateral was also extracted
        assertGt((_adminBorrowTokenBalancePostTerminate - _adminBorrowTokenBalancePreTerminate), 0); // Since the lent amount (which was still in the PCL/LP contracts) were extracted
    }

    // Test 12: Borrowable amount increases if collateral CToken exchange rate increases steeply
    function test_borrowableAmountIncreasesIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertLt(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 12.1: Borrowable amount increases if borrow CToken exchange rate increases steeply
    function test_borrowableAmountIncreasesIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_increaseExchangeRateSteeply(collateralCTokenAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 _interestAccrued = pcl.calculateInterestAccrued(requestId);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertLt(_borrowableAmount, _borrowableAmountNew + _interestAccrued);
    }

    // Test 12.2: Borrowable amount remains same if borrow CToken exchange rate decreases to zero
    function test_borrowableAmountRemainsSameIfBorrowCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertEq(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 12.3: Borrowable amount reverts if collateral CToken exchange rate decreases to zero
    function test_borrowableAmountRevertsIfCollateralCTokenExchangeRateDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try pcl.calculateBorrowableAmount(requestId) {
            revert('Borrowable amount should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 12.4: Borrowable amount decreases if collateral CToken exchange rate increases very slowly
    function test_borrowableAmountDecreasesIfCollateralCTokenExchangeRateIncreasesSlowly() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_increaseExchangeRateSlowly(collateralCTokenAddress);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertGt(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 13: Borrower can repay
    function test_borrowerCanRepay() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_exchangeRateChanges();
        admin.transferToken(address(borrowAsset), address(borrower), 1);
        borrower.setAllowance(address(pcl), address(borrowAsset), type(uint256).max);
        borrower.repay(requestId, 1);
    }

    // Test 14: An active PCL cannot be liquidated if principal == 0
    function test_lendersCannotLiquidateIfPrincipalIsZero(bool _withdraw) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_exchangeRateChanges();

        // _lender0 tries to liquidate the PCL
        try _lender0.liquidate(requestId, _withdraw) {
            revert('Cannot liquidate an Active PCL with principal == 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    // Test 14.1: An active PCL cannot be liquidated if collateral CToken exchange rate increases steeply
    function test_lendersCannotLiquidateIfCollateralCTokenExchangeRateIncreasesSteeply() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_increaseExchangeRateSteeply(collateralCTokenAddress);
        try _lender0.liquidate(requestId, false) {
            revert('Cannot liquidate an Active PCL with CR >= ICR');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    // Test 14.2: An active PCL cannot be liquidated if borrow CToken exchange rate increases steeply
    function test_lendersCannotLiquidateIfBorrowCTokenExchangeRateIncreasesSteeply() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_increaseExchangeRateSteeply(borrowCTokenAddress);
        try _lender0.liquidate(requestId, false) {
            revert('Cannot liquidate an Active PCL with CR >= ICR');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    // Test 14.3: An active PCL cannot be liquidated if borrow CToken exchange rate decreases to zero
    function test_lendersCannotLiquidateIfBorrowCTokenExchangeRateDecreasesToZero() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_decreaseExchangeRateToZero(borrowCTokenAddress);
        try _lender0.liquidate(requestId, false) {
            revert('Cannot liquidate an Active PCL with CR >= ICR');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    // Test 14.4: An active PCL cannot be liquidated if collateral CToken exchange rate decreases to zero
    function test_lendersCannotLiquidateIfCollateralCTokenExchangeRateDecreasesToZero() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        helper_decreaseExchangeRateToZero(collateralCTokenAddress);
        try _lender0.liquidate(requestId, false) {
            revert('Cannot liquidate an Active PCL with CR >= ICR');
        } catch Error(string memory reason) {
            assertEq(reason, 'CY:GTFS1');
        }
    }

    // Test 14.5: An active PCL can be liquidated if collateral CToken exchange rate increases very slowly
    function test_lendersCanLiquidateIfCollateralCTokenExchangeRateIncreasesVerySlowly() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, pcl.calculateBorrowableAmount(requestId));

        helper_increaseExchangeRateSlowly(collateralCTokenAddress);
        _lender0.liquidate(requestId, false);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
    }

    // Test 15: Lenders cannot withdraw liquidation from an ACTIVE pcl
    function test_lendersCannotWithdrawLiquidation() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_exchangeRateChanges();

        try _lender0.withdrawTokensAfterLiquidation(requestId) {
            revert('Cannot withdraw liquidation from an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    // Test 16: Lenders cannot withdraw liquidity from an ACTIVE pcl
    function test_lendersCannotWithdrawLiquidity() public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_exchangeRateChanges();

        try _lender0.withdrawLiquidity(requestId) {
            revert('Cannot withdraw liquidity from an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWL3');
        }
    }

    // Test 17: Pool token transfers should be possible in an Active PCL
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

    // Test 17.1: Pool token transfers should be possible in an Active PCL
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

    // Test 17.2: Pool token transfers should be possible in an Active PCL and principal != 0
    function test_poolTokenTransfersShouldBePossiblePartialBalancePrincipalIsNonZero() public {
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

        // Let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

            // We want to deposit collateral now
            borrower.depositCollateral(requestId, collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount / 2);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

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
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 _collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), _collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

            // We want to deposit collateral now
            borrower.depositCollateral(requestId, _collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        // Borrower makes their first repayment (Entire pending interest + part of principal)
        vm.warp(block.timestamp + 1000);
        {
            borrower.setAllowance(address(pcl), address(borrowAsset), uint256(-1));
            uint256 interestAccrued = borrower.calculateInterestAccrued(requestId);
            admin.transferToken(address(borrowAsset), address(borrower), interestAccrued * 10);
            borrower.repay(requestId, interestAccrued + 10);
        }

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
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 _collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), _collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

            // We want to deposit collateral now
            borrower.depositCollateral(requestId, _collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        vm.warp(block.timestamp + 1000);
        // Borrower makes their first repayment (Entire pending interest + part of principal)
        {
            borrower.setAllowance(address(pcl), address(borrowAsset), uint256(-1));
            uint256 interestAccrued = borrower.calculateInterestAccrued(requestId);
            admin.transferToken(address(borrowAsset), address(borrower), interestAccrued * 10);
            borrower.repay(requestId, interestAccrued + 10);
        }

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

    function assert_helperFunctionalitiesInActiveStateZeroPrincipal(uint256 _id) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 1. calculateCurrentCollateralRatio
        _currentCR1 = _borrower.calculateCurrentCollateralRatio(_id);
        assertEq(_currentCR1, uint256(-1)); // Since borrower has not yet borrowed anything

        helper_exchangeRateChanges();

        // 2. calculatePrincipalWithdrawable
        _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
        assertEq(_principalWithdrawable, 0); // Since the lenders cannot withdraw their liquidity from an active PCL

        helper_exchangeRateChanges();

        // 3. withdrawableCollateral
        _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertEq(_withdrawableCollateral, 0); // Since no collateral was deposited in the first place

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
        _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
        assertEq(_totalCollateral, 0); // Since no collateral was deposited

        helper_exchangeRateChanges();

        // 7. collateralTokensToLiquidate
        _equivalentCollateral = _borrower.collateralTokensToLiquidate(_id, lp.totalSupply(_id));
        assertGt(_equivalentCollateral, 0);

        helper_exchangeRateChanges();

        // 8. calculateInterestAccrued
        _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertEq(_interestAccrued, 0); // Since borrower did not borrow anything

        helper_exchangeRateChanges();
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);
    }

    function assertHelperFunctionalitiesInActiveStateNonZeroPrincipal(uint256 _id) public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);
        (, _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        // Let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            collateralToDeposit = minimumCollateralRequired.mul(2);
            admin.transferToken(address(collateralAsset), address(borrower), collateralToDeposit);
            borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

            // We want to deposit collateral now
            borrower.depositCollateral(requestId, collateralToDeposit, false);
        }

        // Borrower borrows from the PCL
        uint256 borrowableAmount;
        {
            borrowableAmount = borrower.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, borrowableAmount / 2);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        (, _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);

        // 1. calculateCurrentCollateralRatio
        _currentCR2 = _borrower.calculateCurrentCollateralRatio(_id);
        assertLt(_currentCR2, uint256(-1));
        assertGt(_currentCR2, request.collateralRatio);

        helper_increaseExchangeRateSteeply(collateralCTokenAddress);

        _currentCR3 = _borrower.calculateCurrentCollateralRatio(_id);
        assertGt(_currentCR3, _currentCR2);

        helper_exchangeRateChanges();

        // 2. calculatePrincipalWithdrawable
        _principalWithdrawable = _borrower.calculatePrincipalWithdrawable(_id, address(_lender));
        assertEq(_principalWithdrawable, 0); // Since lenders cannot withdraw funds from an active PCL

        helper_exchangeRateChanges();

        // 3. withdrawableCollateral
        _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertGe(_withdrawableCollateral, 0); // Since we had deposited twice the reqired collateral

        helper_exchangeRateChanges();

        // 4. calculateCurrentDebt
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        assertGt(_currentDebt, 0);

        helper_exchangeRateChanges();

        // 5. calculateBorrowableAmount
        _borrowable = _borrower.calculateBorrowableAmount(_id);
        assertGe(_borrowable, 0);

        helper_exchangeRateChanges();

        // 6. calculateTotalCollateralTokens
        _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
        assertGt(_totalCollateral, 0);

        // 7. collateralTokensToLiquidate
        _equivalentCollateral = _borrower.collateralTokensToLiquidate(_id, lp.totalSupply(_id));
        assertGt(_equivalentCollateral, 0);

        helper_exchangeRateChanges();

        // 8. calculateInterestAccrued
        _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertGt(_interestAccrued, 0); // Since borrower did borrow

        helper_exchangeRateChanges();
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);
    }

    function test_helperFunctionsInActiveState() public {
        assert_helperFunctionalitiesInActiveStateZeroPrincipal(requestId);
    }

    function test_helperFunctionsInActiveStateNonZeroPrincipal() public {
        assertHelperFunctionalitiesInActiveStateNonZeroPrincipal(requestId);
    }
}
