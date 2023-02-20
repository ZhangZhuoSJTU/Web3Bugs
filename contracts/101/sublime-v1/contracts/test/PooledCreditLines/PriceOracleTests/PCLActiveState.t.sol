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

contract PCLActiveStatePriceOracle is IPooledCreditLineDeclarations, PCLParent {
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

        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');
    }

    // Test 0: Test SetUp
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        (, int256 _borrowAssetPrice, , , ) = MockV3Aggregator(borrowAssetAggregatorAddress).latestRoundData();
        (, int256 _collateralAssetPrice, , , ) = MockV3Aggregator(collateralAssetAggregatorAddress).latestRoundData();

        // Checking out what are the prices
        log_named_int('Borrow Asset Price', _borrowAssetPrice);
        log_named_int('Collateral Asset Price', _collateralAssetPrice);

        // Check the prices of the borrowAsset and collateralAsset are non-zero
        assertGt(_borrowAssetPrice, 0);
        assertGt(_collateralAssetPrice, 0);
    }

    // Test 1: An active PCL cannot be started even with price fluctuations
    function test_pclCannotBeStarted(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.start(requestId) {
            revert('Cannot start an Active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S1');
        }
    }

    // Test 2: Collateral can be deposited
    function test_collateralCanBeDeposited(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        assertGt(pcl.depositedCollateralInShares(requestId), 0);
    }

    // Test 3: Withdrawable collateral decreases if collateral asset price decreases
    function test_withdrawableCollateralDecreasesIfCollateralAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertGt(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.1: Withdrawable collateral decreases if borrow asset price increases
    function test_withdrawableCollateralDecreasesIfBorrowAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertGt(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.2: Withdrawable collateral increases if collateral asset price increases
    function test_withdrawableCollateralIncreasesIfCollateralAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertLt(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.3: Withdrawable collateral increases if borrow asset price decreases
    function test_withdrawableCollateralIncreasesIfBorrowAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _withdrawableCollateralNew = pcl.withdrawableCollateral(requestId);

        assertLt(_withdrawableCollateral, _withdrawableCollateralNew);
    }

    // Test 3.4: Withdrawable collateral reverts if borrow asset price decreases to 0
    function test_withdrawableCollateralRevertsIfBorrowAssetPriceDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try pcl.withdrawableCollateral(requestId) {
            revert('Withdrawable collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 3.5: Withdrawable collateral reverts if collateral asset price decreases to 0
    function test_withdrawableCollateralRevertsIfCollateralAssetPriceDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try pcl.withdrawableCollateral(requestId) {
            revert('Withdrawable collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 4: Withdraw collateral reverts if collateral asset price decreases
    function test_withdrawCollateralRevertsIfCollateralAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        try borrower.withdrawCollateral(requestId, _withdrawableCollateral, false) {
            revert('Should not be able to withdraw');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WC1');
        }
    }

    // Test 4.1: Withdraw collateral reverts if borrow asset price increases
    function test_withdrawCollateralRevertsIfBorrowAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        try borrower.withdrawCollateral(requestId, _withdrawableCollateral, false) {
            revert('Should not be able to withdraw');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WC1');
        }
    }

    // Test 4.2: Withdraw collateral works if collateral asset price increases
    function test_withdrawCollateralWorksIfCollateralAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_increaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        borrower.withdrawCollateral(requestId, _withdrawableCollateral, false);
    }

    // Test 4.3: Withdraw collateral works if borrow asset price decreases
    function test_withdrawCollateralWorksIfBorrowAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        borrower.withdrawCollateral(requestId, _withdrawableCollateral, false);
    }

    // Test 4.4: Withdraw collateral reverts if borrow asset price decreases to 0
    function test_withdrawCollateralRevertsIfBorrowAssetPriceDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try borrower.withdrawCollateral(requestId, _withdrawableCollateral, false) {
            revert('Should not be able to withdraw');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 4.5: Withdraw collateral reverts if collateral asset price decreases to 0
    function test_withdrawCollateralRevertsIfCollateralAssetPriceDecreasesToZero() public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try borrower.withdrawCollateral(requestId, _withdrawableCollateral, false) {
            revert('Should not be able to withdraw');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 5: An active PCL (with principal == 0) can be closed even with price fluctuations
    function test_pclCanBeClosedIfPrincipalIsZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        borrower.close(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED, '!Closed');
    }

    // Test 5.1: An active PCL (with principal != 0) cannot be closed even with price fluctuations
    function test_pclCannotBeClosedPrincipalIsNonZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
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

        // Price fluctuations take place
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.close(requestId) {
            revert('Cannot close PCL when principal != 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:C2');
        }
    }

    // Test 6: Required collateral decreases if collateral asset price increases
    function test_requiredCollateralDecreasesIfCollateralAssetPriceIncreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertGt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 6.1: Required collateral increases if borrow asset price increases
    function test_requiredCollateralIncreasesIfBorrowAssetPriceIncreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertLt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 6.2: Required collateral increases if collateral asset price decreases
    function test_requiredCollateralIncreasesIfCollateralAssetPriceDecreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertLt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 6.3: Required collateral decreases if borrow asset price decreases
    function test_requiredCollateralDecreasesIfBorrowAssetPriceDecreases(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _requiredCollateralNew = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);

        assertGt(_requiredCollateral, _requiredCollateralNew);
    }

    // Test 6.4: Required collateral reverts if borrow asset price decreases to 0
    function test_requiredCollateralRevertsIfBorrowAssetPriceDecreasesToZero(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try pcl.getRequiredCollateral(requestId, request.borrowLimit / 2) {
            revert('Required collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 6.5: Required collateral reverts if collateral asset price decreases to 0
    function test_requiredCollateralRevertsIfCollateralAssetPriceDecreasesToZero(uint256 _seed) public {
        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit / 2);
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try pcl.getRequiredCollateral(requestId, request.borrowLimit / 2) {
            revert('Required collateral should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 7: Collateral ratio decreases if collateral asset price decreases
    function test_collateralRatioDecreasesIfCollateralAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertGt(_collateralRatio, _collateralRatioNew);
    }

    // Test 7.1: Collateral ratio decreases if borrow asset price increases
    function test_collateralRatioDecreasesIfBorrowAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertGt(_collateralRatio, _collateralRatioNew);
    }

    // Test 7.2: Collateral ratio increases if collateral asset price increases
    function test_collateralRatioIncreasesIfCollateralAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_increaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertLt(_collateralRatio, _collateralRatioNew);
    }

    // Test 7.3: Collateral ratio increases if borrow asset price decreases
    function test_collateralRatioIncreasesIfBorrowAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_decreaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _collateralRatioNew = pcl.calculateCurrentCollateralRatio(requestId);

        assertLt(_collateralRatio, _collateralRatioNew);
    }

    // Test 7.4: Collateral ratio reverts if borrow asset price decreases to 0
    function test_collateralRatioRevertsIfBorrowAssetPriceDecreasesToZero(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try pcl.calculateCurrentCollateralRatio(requestId) {
            revert('Collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 7.5: Collateral ratio reverts if collateral asset price decreases to 0
    function test_collateralRatioRevertsIfCollateralAssetPriceDecreasesToZero(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try pcl.calculateCurrentCollateralRatio(requestId) {
            revert('Collateral ratio should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 8: Lenders cannot withdraw liquidation from an ACTIVE pcl
    function test_lendersCannotWithdrawLiquidation(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try _lender0.withdrawLiquidation(requestId) {
            revert('Cannot withdraw liquidation from an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    // Test 9: Lenders cannot withdraw liquidity from an ACTIVE pcl
    function test_lendersCannotWithdrawLiquidity(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try _lender0.withdrawLiquidity(requestId) {
            revert('Cannot withdraw liquidity from an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWL3');
        }
    }

    // Test 10: An active PCL cannot be liquidated if principal == 0
    function test_lendersCannotLiquidateIfPrincipalIsZero(
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed,
        bool _withdraw
    ) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // _lender0 tries to liquidate the PCL
        try _lender0.liquidate(requestId, _withdraw) {
            revert('Cannot liquidate an Active PCL with principal == 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    // Test 10.1: An active PCL with principal != 0 can or cannot be liquidated
    function test_lendersCanOrCannotLiquidate(
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed,
        bool _withdraw
    ) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

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
            borrower.borrow(requestId, borrowableAmount);
            uint256 currentCollateralRatio = borrower.calculateCurrentCollateralRatio(requestId);
            assertGt(currentCollateralRatio, request.collateralRatio);
        }

        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

        // Relative price fluctuations
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 _currentDebt = pcl.calculateCurrentDebt(requestId);
        uint256 _currentCollateralRatio = pcl.calculateTotalCollateralTokens(requestId).mul(_ratioOfPrices).div(_currentDebt).mul(1e18).div(
            10**_decimals
        );

        if (_currentCollateralRatio < request.collateralRatio) {
            // assert liquidated
            _lender0.liquidate(requestId, false);
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
        } else {
            // asset not liquidated
            try _lender0.liquidate(requestId, _withdraw) {
                revert('Cannot liquidate an Active PCL with CR >= ICR');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:L3');
            }
        }
    }

    // Test 10.2: An active PCL can be liquidated if principal != 0 and CR < ICR
    function test_lendersCanLiquidateIfCollateralAssetPriceDecreases(uint256 _seed) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        // Let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 collateralToDeposit = minimumCollateralRequired.mul(1);
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
        }

        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        _lender0.liquidate(requestId, false);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
    }

    // Test 10.3: An active PCL can be liquidated if principal != 0 and CR < ICR
    function test_lendersCanLiquidateIfBorrowAssetPriceIncreases(uint256 _seed) public {
        PCLUser _lender0 = PCLUser(lenders[0].lenderAddress);

        // Let's make the principal non-zero
        // Borrower deposits collateral into the PCL
        {
            // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
            uint256 minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

            // Transferring collateral tokens to the borrower
            uint256 collateralToDeposit = minimumCollateralRequired.mul(1);
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
        }

        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal != 0, 'Principal == 0');

        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        _lender0.liquidate(requestId, false);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
    }

    // Test 11.1: Admin should be able to terminate an ACTIVE PCL with principal == 0
    function test_adminCanTerminatePCLPrincipalIsZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

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

    // Test 11.2: Admin should be able to terminate an ACTIVE PCL with principal != 0
    function test_adminCanTerminatePCLPrincipalIsNonZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
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

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

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

    // Test 12.1: Pool token transfers should be possible in an Active PCL
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

    // Test 12.2: Pool token transfers should be possible in an Active PCL
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

        assertEq(lender0PoolTokenBalanceFinal, lender0PoolTokenBalance / 2);
        assertTrue(lender1PoolTokenBalanceFinal == (lender0PoolTokenBalance / 2 + lender1PoolTokenBalance));

        // Price fluctuations take place
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // Lender2 transfers pool tokens to lender3
        lender2.transferLPTokens(address(lender3), requestId, lender2PoolTokenBalance / 4);

        uint256 lender2PoolTokenBalanceFinal = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalanceFinal = lp.balanceOf(address(lender3), requestId);

        // Checking whether the transfer took place or not
        assertTrue(lender2PoolTokenBalanceFinal == (3 * lender2PoolTokenBalance) / 4);
        assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance / 4 + lender3PoolTokenBalance));
    }

    // Test 12.3: Pool token transfers should be possible in an Active PCL and principal != 0
    function test_poolTokenTransfersShouldBePossiblePartialBalancePrincipalIsNonZero(
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed
    ) public {
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

        assertEq(lender0PoolTokenBalanceFinal, lender0PoolTokenBalance / 2);
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
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // Lender2 transfers pool tokens to lender3
        lender2.transferLPTokens(address(lender3), requestId, lender2PoolTokenBalance / 4);

        uint256 lender2PoolTokenBalanceFinal = lp.balanceOf(address(lender2), requestId);
        uint256 lender3PoolTokenBalanceFinal = lp.balanceOf(address(lender3), requestId);

        // Checking whether the transfer took place or not
        assertTrue(lender2PoolTokenBalanceFinal == (3 * lender2PoolTokenBalance) / 4);
        assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance / 4 + lender3PoolTokenBalance));
    }

    // Test 13: Interest can be withdrawn amidst price fluctuations
    function test_lendersCanWithdrawInterest(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
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

        vm.warp(block.timestamp + request.duration / 2);

        // Borrower makes their first repayment (Entire pending interest + part of principal)
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
        uint256 lender0InterestOwed = lender0.getLenderInterest(requestId, address(lender0));
        uint256 lender1InterestOwed = lender1.getLenderInterest(requestId, address(lender1));

        lender0.withdrawInterest(requestId);

        uint256 lender0BalanceFinal = borrowAsset.balanceOf(address(lender0));
        assertEq((lender0BalanceFinal - lender0Balance), lender0InterestOwed);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        lender1.withdrawInterest(requestId);

        uint256 lender1BalanceFinal = borrowAsset.balanceOf(address(lender1));
        assertEq((lender1BalanceFinal - lender1Balance), lender1InterestOwed);
    }

    // Test 14: An active PCL cannot be cancelled if principal == 0
    function test_borrowerCannotCancelActivePCLPrincipalIsZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        (, uint256 _principal, , , ) = pcl.pooledCreditLineVariables(requestId);

        assertTrue(_principal == 0, 'Principal != 0');
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.cancelRequest(requestId) {
            revert('Cannot cancel an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    // Test 15.1: An active PCL cannot be cancelled if principal != 0
    function test_borrowerCannotCancelActivePCLPrincipalIsNonZero(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
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

        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        try borrower.cancelRequest(requestId) {
            revert('Cannot cancel an active PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    // Test 16: Borrowable amount decreases if collateral asset price decreases
    function test_borrowableAmountDecreasesIfCollateralAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertGt(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 16.1: Borrowable amount decreases if borrow asset price increases
    function test_borrowableAmountDecreasesIfBorrowAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_increaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertGt(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 16.2: Borrowable amount increases if collateral asset price increases
    function test_borrowableAmountIncreasesIfCollateralAssetPriceIncreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_increaseAssetPrice(collateralAssetAggregatorAddress, _seed);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertLt(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 16.3: Borrowable amount increases if borrow asset price decreases
    function test_borrowableAmountIncreasesIfBorrowAssetPriceDecreases(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_decreaseAssetPrice(borrowAssetAggregatorAddress, _seed);
        uint256 _borrowableAmountNew = pcl.calculateBorrowableAmount(requestId);

        assertLt(_borrowableAmount, _borrowableAmountNew);
    }

    // Test 16.4: Borrowable amount reverts if borrow asset price decreases to 0
    function test_borrowableAmountRevertsIfBorrowAssetPriceDecreasesToZero(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_decreaseAssetPriceToZero(borrowAssetAggregatorAddress);
        try pcl.calculateBorrowableAmount(requestId) {
            revert('Borrowable amount should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 16.5: Borrowable amount reverts if collateral asset price decreases to 0
    function test_borrowableAmountRevertsIfCollateralAssetPriceDecreasesToZero(uint256 _seed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        helper_decreaseAssetPriceToZero(collateralAssetAggregatorAddress);
        try pcl.calculateBorrowableAmount(requestId) {
            revert('Borrowable amount should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    // Test 17: Borrower can repay
    function test_borrowerCanRepay(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        uint256 _minimumCollateralRequired = borrower.getRequiredCollateral(requestId, request.borrowLimit);

        // Transferring collateral tokens to the borrower
        admin.transferToken(address(collateralAsset), address(borrower), _minimumCollateralRequired);
        borrower.setAllowance(address(pcl), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral and borrow now
        borrower.depositCollateral(requestId, _minimumCollateralRequired, false);
        borrower.borrow(requestId, request.borrowLimit / 2);

        vm.warp(block.timestamp + 10 days);
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        admin.transferToken(address(borrowAsset), address(borrower), 1);
        borrower.setAllowance(address(pcl), address(borrowAsset), type(uint256).max);
        borrower.repay(requestId, 1);
    }

    function assert_helperFunctionalitiesInActiveStateZeroPrincipal(
        uint256 _id,
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed
    ) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);

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
            assertEq(_principalWithdrawable, 0); // Since the lenders cannot withdraw their liquidity from an active PCL
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
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);
    }

    function assertHelperFunctionalitiesInActiveStateNonZeroPrincipal(
        uint256 _id,
        uint256 _borrowAssetPriceSeed,
        uint256 _collateralAssetPriceSeed
    ) public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);
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
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);

        vm.warp(block.timestamp + 12 days);

        // 1. calculateCurrentCollateralRatio
        {
            uint256 _currentCR2 = _borrower.calculateCurrentCollateralRatio(_id);
            assertLt(_currentCR2, uint256(-1));
            assertGt(_currentCR2, request.collateralRatio);

            helper_decreaseAssetPrice(collateralAssetAggregatorAddress, _collateralAssetPriceSeed);

            uint256 _currentCR3 = _borrower.calculateCurrentCollateralRatio(_id);
            assertLt(_currentCR3, _currentCR2);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 2. calculatePrincipalWithdrawable
        {
            uint256 _principalWithdrawable = _borrower.calculatePrincipalWithdrawable(_id, address(_lender));
            assertEq(_principalWithdrawable, 0); // Since lenders cannot withdraw funds from an active PCL
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 3. withdrawableCollateral
        {
            uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
            assertGe(_withdrawableCollateral, 0); // Since we had deposited twice the reqired collateral
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 4. calculateCurrentDebt
        {
            uint256 _currentDebt = _borrower.calculateCurrentDebt(_id);
            assertGt(_currentDebt, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 5. calculateBorrowableAmount
        {
            uint256 _borrowable = _borrower.calculateBorrowableAmount(_id);
            assertGe(_borrowable, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 6. calculateTotalCollateralTokens
        {
            uint256 _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
            assertGt(_totalCollateral, 0);
        }
        // 7. collateralTokensToLiquidate
        {
            uint256 _equivalentCollateral = _borrower.collateralTokensToLiquidate(_id, lp.totalSupply(_id));
            assertGt(_equivalentCollateral, 0);
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);

        // 8. calculateInterestAccrued
        {
            uint256 _interestAccrued = _borrower.calculateInterestAccrued(_id);
            assertGt(_interestAccrued, 0); // Since borrower did borrow
        }
        helper_priceChanges(_borrowAssetPriceSeed, _collateralAssetPriceSeed);
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);
    }

    function test_helperFunctionsInActiveState(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        assert_helperFunctionalitiesInActiveStateZeroPrincipal(requestId, _borrowAssetPriceSeed, _collateralAssetPriceSeed);
    }

    function test_helperFunctionsInActiveStateNonZeroPrincipal(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public {
        assertHelperFunctionalitiesInActiveStateNonZeroPrincipal(requestId, _borrowAssetPriceSeed, _collateralAssetPriceSeed);
    }
}
