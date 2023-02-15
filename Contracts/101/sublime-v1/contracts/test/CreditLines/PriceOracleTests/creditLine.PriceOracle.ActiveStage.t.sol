pragma solidity 0.7.6;
pragma abicoder v2;

import '../Helpers/CLParent.sol';
import '../../../SavingsAccount/SavingsAccount.sol';
import '../../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_PriceOracle_ActiveStageTests is CLParent {
    using SafeMath for uint256;

    uint256 creditLineId;
    uint256 protocolFee;
    uint256 constant SCALING_FACTOR = 1e18;
    address borrowAssetStrategy;
    address collateralStrategy;

    CreditLine creditLine;
    SavingsAccount savingsAccount;
    PriceOracle priceOracle;

    // Token deployment variables
    MockToken public testAsset;
    MockV3Aggregator public testAssetMockAggregator;
    address public testCTokenAddress;

    function setUp() public {
        CLSetUp();

        // setting up test asset for price fluctuation tests
        testAsset = new MockToken('TestAsset', 'MT2', 8, 1e40, address(admin));
        testAssetMockAggregator = new MockV3Aggregator(8, 295040576);
        testCTokenAddress = admin.deployMockCToken(address(testAsset), compoundYieldAddress, noYieldAddress);
        admin.transferOwnership(address(testAsset), testCTokenAddress);
        admin.setChainlinkFeedAddress(
            priceOracleAddress,
            address(testAsset),
            address(testAssetMockAggregator),
            Constants.CHAINLINK_HEARTBEAT
        );

        creditLine = CreditLine(creditLineAddress);
        savingsAccount = SavingsAccount(savingsAccountAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e18;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = CLConstants.maxCollteralRatio / 1e12;
        requestData.borrowAsset = address(borrowAsset);
        requestData.borrowAssetStrategy = noYieldAddress;
        requestData.collateralAsset = address(collateralAsset);
        requestData.collateralStrategy = noYieldAddress;
        requestData.requestAsLender = false;

        creditLineId = goToActiveStage();

        // Setting global parameters
        protocolFee = creditLine.protocolFeeFraction();
        borrowAssetStrategy = requestData.borrowAssetStrategy;
        collateralStrategy = requestData.collateralStrategy;
    }

    //----------------------- Price oracle variations on Deposit collateral function -----------------------//

    //----------------------- passing tests -----------------------//

    // Zero asset prices should not affect deposit collateral function
    function test_depositCollateral_POZero1(uint256 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Zero asset prices should not affect deposit collateral function
    function test_depositCollateral_POZero2(uint256 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Zero asset prices should not affect deposit collateral function
    function test_depositCollateral_POZero3(uint256 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Any change in price should not affect the depositCollateral funtion
    function test_depositCollateral_fuzzPrices(
        uint128 borrowAssetPrice,
        uint128 collateralAssetPrice,
        uint256 _amount
    ) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        // Altering price oracle results
        setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Any change in ratio of prices should not affect the depositCollateral funtion
    function test_depositCollateral_POFluctuations1(uint256 _amount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = scaleToRange256(_amount, 1, testAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        // switching asset prices
        // ratio of prices becomes inverse of original
        setAggregatorPrice(295040576, 195040576);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);
    }

    // Prices going down to half should not affect the depositCollateral funtion
    function test_depositCollateral_POFluctuations2(uint256 _amount) public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Ratio_of_prices = 1, should not affect the depositCollateral funtion
    function test_depositCollateral_POFluctuations3(uint256 _amount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = scaleToRange256(_amount, 1, testAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);
    }

    //----------------------- Price oracle variations on Borrow function -----------------------//

    //----------------------- failing tests -----------------------//

    // Borrow should fail when both asset prices go to zero
    function test_borrow_POZero1(uint256 _borrowAmount) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertEq(borrowable, 0); // Borrowable amount goes to zero

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, ERC20(address(borrowAsset)).totalSupply());

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        try borrower.borrow(address(creditLine), creditLineId, borrowAmount) {
            revert('Both asset prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:B2');
        }
    }

    // Borrow should fail when either asset prices go to zero
    function test_borrow_POZero2(uint256 _borrowAmount) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertEq(borrowable, 0); // Borrowable amount goes to zero

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, ERC20(address(borrowAsset)).totalSupply());

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        try borrower.borrow(address(creditLine), creditLineId, borrowAmount) {
            revert('Collateral asset prie is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:B2');
        }
    }

    // Borrow should fail when either asset prices go to zero
    function test_borrow_POZero3(uint256 _borrowAmount) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertEq(borrowable, 0); // Borrowable amount goes to zero

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, ERC20(address(borrowAsset)).totalSupply());

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        try borrower.borrow(address(creditLine), creditLineId, borrowAmount) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:B2');
        }
    }

    //----------------------- passing tests -----------------------//

    // Any change in price should not affect the borrow funtion, except zero values
    function test_borrow_fuzzPrices(
        uint128 _borrowAssetPrice,
        uint128 _collateralAssetPrice,
        uint256 _borrowAmount
    ) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 borrowAssetPrice = scaleToRange256(_borrowAssetPrice, 1, type(uint128).max);
        uint256 collateralAssetPrice = scaleToRange256(_collateralAssetPrice, 1, type(uint128).max);

        // RatioOfPrice will not go beyond 1e30 in practical scenarios
        // Limiting RatioOfPrice.mul(1e18) <= 1e30
        if (collateralAssetPrice.div(borrowAssetPrice) <= 1e12) {
            // Adding tokens to borrower and setting allowance for creditline contract
            admin.transferToken(address(collateralAsset), address(borrower), amount);
            borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

            borrower.addCollateral(address(creditLine), creditLineId, amount, false);
            assert_creditLineDeposit(creditLineId, amount);

            // Altering price oracle results
            setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

            uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
            if (borrowable > 0) {
                uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

                // Adding tokens to lender and depositing to lender's savings Account
                savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

                borrower.borrow(address(creditLine), creditLineId, borrowAmount);
                assert_creditLineBorrow(creditLineId, borrowAmount);
            }
        }
    }

    // Ratio_of_prices = 0, should not affect the borrow function
    function test_borrow_POFluctuations1(uint256 _borrowAmount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), cLId, borrowAmount);
        assert_creditLineBorrow(cLId, borrowAmount);
    }

    // Ratio_of_prices = 1, should not affect the borrow funtion
    function test_borrow_POFluctuations2(uint256 _borrowAmount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), cLId, borrowAmount);
        assert_creditLineBorrow(cLId, borrowAmount);
    }

    // Prices going down to half should not affect the depositCollateral funtion
    function test_borrow_POFluctuations3(uint256 _borrowAmount) public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);
        assert_creditLineBorrow(creditLineId, borrowAmount);
    }

    //----------------------- Price oracle variations on calculate borrowable Amount function -----------------------//

    // Inverted Ratio_of_prices should not affect the calculate borrowable Amount function
    function test_calculateBorrowableAmount_POFluctuations1(uint256 _amount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = scaleToRange256(_amount, 1, requestData.borrowLimit - 1);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        uint256 totalCollateral = creditLine.calculateTotalCollateralTokens(cLId);
        assertEq(totalCollateral, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);
        uint256 calculatedBorrowable = amount.mul(195040576).div(295040576);
        assertApproxEqRel(borrowable, calculatedBorrowable, 1e14);
    }

    // Ratio_of_prices = 1, should not affect the calculate borrowable Amount funtion
    function test_calculateBorrowableAmount_POFluctuations2(uint256 _amount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = scaleToRange256(_amount, 1, requestData.borrowLimit - 1);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 totalCollateral = creditLine.calculateTotalCollateralTokens(cLId);
        assertEq(totalCollateral, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);
        assertEq(borrowable, amount);
    }

    //----------------------- Price oracle variations on Withdrawing collateral function -----------------------//

    //----------------------- failing tests -----------------------//

    // withdraw collateral should fail when both asset prices become zero
    function test_withdrawCollateral_POZero1() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('Both asset prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // withdraw collateral should fail when either asset prices becomes zero
    function test_withdrawCollateral_POZero2() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('Collateral asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // withdraw collateral should fail when either asset prices becomes zero
    function test_withdrawCollateral_POZero3() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    //----------------------- passing tests -----------------------//

    // Any change in price should not affect the withdraw Collateral funtion
    function test_withdrawCollateral_fuzzPrices(
        uint128 borrowAssetPrice,
        uint128 collateralAssetPrice,
        uint256 _withdrawAmount
    ) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 withdrawAmount = scaleToRange256(_withdrawAmount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        if (borrowable > 0) {
            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

            borrower.borrow(address(creditLine), creditLineId, borrowable);
            assert_creditLineBorrow(creditLineId, borrowable);

            // Altering price oracle results
            setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

            uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
            try borrower.withdrawCollateral(creditLineAddress, creditLineId, withdrawAmount, false) {
                uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));
                assertEq(withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
            } catch Error(string memory reason) {
                if (compareStrings(reason, 'SafeMath: division by zero')) {
                    emit log_string('Zero Price Oracle');
                } else if (compareStrings(reason, 'CL:WC3')) {
                    emit log_string('amount > WithdrawableCollateral');
                } else {
                    revert(reason);
                }
            }
        }
    }

    // ratio_of_price = inverse, should not affect withdraw collateral function
    function test_withdrawCollateral_POFluctuations1(uint256 _withdrawAmount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        uint256 withdrawable = creditLine.withdrawableCollateral(cLId);
        if (withdrawable > 0) {
            uint256 wthdrawAmount = scaleToRange256(_withdrawAmount, 1, withdrawable);

            uint256 balanceBorrower = testAsset.balanceOf(address(borrower));
            borrower.withdrawCollateral(creditLineAddress, cLId, wthdrawAmount, false);
            uint256 balanceBorrowerAfter = testAsset.balanceOf(address(borrower));
            assertEq(wthdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
        }
    }

    // Prices going down to half should not affect the withdraw Collateral funtion
    function test_withdrawCollateral_POFluctuations2(uint256 _withdrawAmount) public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        uint256 withdrawable = creditLine.withdrawableCollateral(creditLineId);
        if (withdrawable > 0) {
            uint256 wthdrawAmount = scaleToRange256(_withdrawAmount, 1, withdrawable);

            uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
            borrower.withdrawCollateral(creditLineAddress, creditLineId, wthdrawAmount, false);
            uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));
            assertEq(wthdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
        }
    }

    // Ratio_of_prices = 1, should not affect the withdraw Collateral funtion
    function test_withdrawCollateral_POFluctuations3(uint256 _withdrawAmount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 withdrawable = creditLine.withdrawableCollateral(cLId);
        if (withdrawable > 0) {
            uint256 wthdrawAmount = scaleToRange256(_withdrawAmount, 1, withdrawable);

            uint256 balanceBorrower = testAsset.balanceOf(address(borrower));
            borrower.withdrawCollateral(creditLineAddress, cLId, wthdrawAmount, false);
            uint256 balanceBorrowerAfter = testAsset.balanceOf(address(borrower));
            assertEq(wthdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
        }
    }

    //----------------------- Price oracle variations on Withdrawable collateral function -----------------------//

    // ratio_of_price = inverse, should  not affect withdraw collateral function
    function test_withdrawableCollateral_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        uint256 withdrawable = creditLine.withdrawableCollateral(cLId);
        uint256 collateralNeeded = borrowable.mul(295040576).div(195040576);

        if (amount > collateralNeeded) {
            assertEq(withdrawable, amount.sub(collateralNeeded));
        } else {
            assertEq(withdrawable, 0);
        }
    }

    // Ratio_of_prices = 1, should not affect the withdraw Collateral funtion
    function test_withdrawableCollateral_POFluctuations2() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 withdrawable = creditLine.withdrawableCollateral(cLId);

        if (amount > borrowable) {
            assertEq(withdrawable, amount.sub(borrowable));
        } else {
            assertEq(withdrawable, 0);
        }
    }

    //----------------------- Price oracle variations on Withdrawing All collateral function -----------------------//

    //----------------------- failing tests -----------------------//

    // withdraw all collateral fails when both asset prices become zero
    function test_withdrawAllCollateral_POZero1() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('Both asset prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // withdraw all collateral fails when either asset prices becomes zero
    function test_withdrawAllCollateral_POZero2() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('Collateral asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // withdraw all collateral fails when either asset prices becomes zero
    function test_withdrawAllCollateral_POZero3() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    //----------------------- passing tests -----------------------//

    // Any change in price should not affect the withdraw all collateral funtion, except zero values
    function test_withdrawAllCollateral_fuzzPrices(uint128 borrowAssetPrice, uint128 collateralAssetPrice) public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 _withdrawAmount;

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        if (borrowable > 0) {
            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

            borrower.borrow(address(creditLine), creditLineId, borrowable);
            assert_creditLineBorrow(creditLineId, borrowable);

            // Altering price oracle results
            setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

            try creditLine.withdrawableCollateral(creditLineId) {
                _withdrawAmount = creditLine.withdrawableCollateral(creditLineId);
            } catch Error(string memory reason) {
                assertEq(reason, 'SafeMath: division by zero');
            }

            uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
            try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
                uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));
                assertEq(_withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
            } catch Error(string memory reason) {
                if (compareStrings(reason, 'SafeMath: division by zero')) {
                    emit log_string('Zero Price Oracle');
                } else if (compareStrings(reason, 'SA:WS1')) {
                    emit log_string('amount=0');
                } else {
                    revert(reason);
                }
            }
        }
    }

    // Inverting ratio of prices should not affect withdraw all collateral function
    function test_withdrawAllCollateral_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        uint256 withdrawAmount = creditLine.withdrawableCollateral(cLId);
        if (withdrawAmount > 0) {
            uint256 balanceBorrower = testAsset.balanceOf(address(borrower));
            borrower.withdrawAllCollateral(creditLineAddress, cLId, false);
            uint256 balanceBorrowerAfter = testAsset.balanceOf(address(borrower));
            assertEq(withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
        }
    }

    // Prices going down to half should not affect the withdraw all collateral funtion
    function test_withdrawAllCollateral_POFluctuations2() public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        uint256 _withdrawAmount = creditLine.withdrawableCollateral(creditLineId);
        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false);
        uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));
        assertEq(_withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
    }

    // Ratio_of_prices = 1, should not affect the withdraw all collateral funtion
    function test_withdrawAllCollateral_POFluctuations3() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 withdrawAmount = creditLine.withdrawableCollateral(cLId);
        if (withdrawAmount > 0) {
            uint256 balanceBorrower = testAsset.balanceOf(address(borrower));
            borrower.withdrawAllCollateral(creditLineAddress, cLId, false);
            uint256 balanceBorrowerAfter = testAsset.balanceOf(address(borrower));
            assertEq(withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower));
        }
    }

    //----------------------- Price oracle variations on liquidate function -----------------------//

    //----------------------- failing tests -----------------------//

    // liquidate function should fail when both asset prices become zero
    function test_liquidate_POZero1() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('Both asset prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // liquidate function should fail when either asset prices becomes zero
    function test_liquidate_POZero2() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('Collateral asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // liquidate function should fail when either asset prices becomes zero
    function test_liquidate_POZero3() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    //----------------------- passing tests -----------------------//

    // Any change in price should not affect the liquidate funtion, except zero values
    function test_liquidate_fuzzPrices(uint128 _borrowAssetPrice, uint128 _collateralAssetPrice) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 borrowAssetPrice = scaleToRange256(_borrowAssetPrice, 1, type(uint128).max);
        uint256 collateralAssetPrice = scaleToRange256(_collateralAssetPrice, 1, type(uint128).max);

        // RatioOfPrice will not go beyond 1e30 in practical scenarios
        // Limiting RatioOfPrice.mul(1e18) <= 1e30
        if (collateralAssetPrice.div(borrowAssetPrice) <= 1e12) {
            // Adding tokens to borrower and setting allowance for creditline contract
            admin.transferToken(address(collateralAsset), address(borrower), amount);
            borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

            borrower.addCollateral(address(creditLine), creditLineId, amount, false);
            assert_creditLineDeposit(creditLineId, amount);

            uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
            if (borrowable > 0) {
                // Adding tokens to lender and depositing to lender's savings Account
                savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

                borrower.borrow(address(creditLine), creditLineId, borrowable);
                assert_creditLineBorrow(creditLineId, borrowable);

                // Altering price oracle results
                setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

                uint256 lenderBalance = collateralAsset.balanceOf(address(lender));
                try lender.liquidate(creditLineAddress, creditLineId, false) {
                    uint256 lenderBalanceAfter = collateralAsset.balanceOf(address(lender));
                    assertEq(amount, lenderBalanceAfter.sub(lenderBalance));

                    uint256 status = uint256(creditLine.getCreditLineStatus(creditLineId));
                    assertEq(status, 0); // Credit line variables are deleted
                } catch Error(string memory reason) {
                    if (compareStrings(reason, 'SafeMath: division by zero')) {
                        emit log_string('Zero Price Oracle');
                    } else if (compareStrings(reason, 'CL:L3')) {
                        emit log_string('Collateral Ratio is not disturbed');
                    } else {
                        revert(reason);
                    }
                }
            }
        }
    }

    // Inverted ratio of prices should not affect the liquidate funtion
    function test_liquidate_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(295040576, 195040576);

        uint256 lenderBalance = testAsset.balanceOf(address(lender));
        try lender.liquidate(creditLineAddress, cLId, false) {
            uint256 lenderBalanceAfter = testAsset.balanceOf(address(lender));
            assertEq(amount, lenderBalanceAfter.sub(lenderBalance));

            uint256 status = uint256(creditLine.getCreditLineStatus(cLId));
            assertEq(status, 0); // Credit line variables are deleted
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L3');
        }
    }

    // Prices going down to half should not affect the liquidate funtion
    function test_liquidate_POFluctuations2() public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        try lender.liquidate(creditLineAddress, creditLineId, false) {
            uint256 status = uint256(creditLine.getCreditLineStatus(creditLineId));
            assertEq(status, 0); // Credit line variables are deleted
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L3');
        }
    }

    // Ratio_of_prices = 1, should not affect the liquidate funtion
    function test_liquidate_POFluctuations3() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 lenderBalance = testAsset.balanceOf(address(lender));
        try lender.liquidate(creditLineAddress, cLId, false) {
            uint256 lenderBalanceAfter = testAsset.balanceOf(address(lender));
            assertEq(amount, lenderBalanceAfter.sub(lenderBalance));

            uint256 status = uint256(creditLine.getCreditLineStatus(cLId));
            assertEq(status, 0); // Credit line variables are deleted
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L3');
        }
    }

    //----------------------- Price oracle variations on borrowTokensToLiquidate function -----------------------//

    function test_borrowTokensToLiquidate_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(295040576, 195040576);

        uint256 borrowTokensToLiquidate = creditLine.borrowTokensToLiquidate(cLId);
        uint256 equivalentCollateral = borrowable.mul(295040576).div(195040576);

        if (equivalentCollateral > amount) {
            uint256 tokensToLiquidate = amount
                .mul(uint256(SCALING_FACTOR).sub(CLConstants.liquidatorRewardFraction))
                .div(SCALING_FACTOR)
                .mul(195040576)
                .div(295040576);
            assertEq(borrowTokensToLiquidate, tokensToLiquidate);
        } else {
            uint256 tokensToLiquidate = equivalentCollateral
                .mul(uint256(SCALING_FACTOR).sub(CLConstants.liquidatorRewardFraction))
                .div(SCALING_FACTOR)
                .mul(195040576)
                .div(295040576);
            assertEq(borrowTokensToLiquidate, tokensToLiquidate);
        }
    }

    function test_borrowTokensToLiquidate_POFluctuations2() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 borrowTokensToLiquidate = creditLine.borrowTokensToLiquidate(cLId);
        if (borrowable > amount) {
            uint256 tokensToLiquidate = amount.mul(uint256(SCALING_FACTOR).sub(CLConstants.liquidatorRewardFraction)).div(SCALING_FACTOR);
            assertEq(borrowTokensToLiquidate, tokensToLiquidate);
        } else {
            uint256 tokensToLiquidate = borrowable.mul(uint256(SCALING_FACTOR).sub(CLConstants.liquidatorRewardFraction)).div(
                SCALING_FACTOR
            );
            assertEq(borrowTokensToLiquidate, tokensToLiquidate);
        }
    }

    //----------------------- Price oracle variations on currentCollateralRatio function -----------------------//

    function test_currentCollateralRatio_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(295040576, 195040576);

        (uint256 collateralRatio, uint256 totalCollateral) = creditLine.calculateCurrentCollateralRatio(cLId);
        uint256 calculatedCR = amount.mul(195040576).div(295040576).mul(1e18).div(borrowable);
        assertEq(totalCollateral, amount);
        assertEq(collateralRatio, calculatedCR);
    }

    function test_currentCollateralRatio_POFluctuations2() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        (uint256 collateralRatio, uint256 totalCollateral) = creditLine.calculateCurrentCollateralRatio(cLId);
        uint256 calculatedCR = amount.mul(1e18).div(borrowable);
        assertEq(totalCollateral, amount);
        assertEq(collateralRatio, calculatedCR);
    }

    //----------------------- Price oracle variations on repay function -----------------------//

    //----------------------- passing tests -----------------------//

    // Repay function should not fail if both asset prices become zero
    function test_repay_POZero1(uint256 _repayAmount) public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, repayAmount);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, repayAmount);
    }

    // Repay function should not fail if either asset prices becomes zero
    function test_repay_POZero2(uint256 _repayAmount) public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, repayAmount);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, repayAmount);
    }

    // Repay function should not fail if either asset prices becomes zero
    function test_repay_POZero3(uint256 _repayAmount) public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, repayAmount);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, repayAmount);
    }

    // Any change in price should not affect the repay funtion
    function test_repay_fuzzPrices(
        uint128 borrowAssetPrice,
        uint128 collateralAssetPrice,
        uint256 _repayAmount
    ) public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        if (borrowable > 0) {
            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

            borrower.borrow(address(creditLine), creditLineId, borrowable);
            assert_creditLineBorrow(creditLineId, borrowable);

            _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

            // Altering price oracle results
            setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

            uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
            uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

            // add balance to user
            admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
            borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

            // repay the credit line
            borrower.repay(address(creditLine), creditLineId, repayAmount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

            // assert: balance change for user should be equal to amount repaid
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            assertEq(balanceDiff, repayAmount);
        }
    }

    // Inverted ratio of prices should not affect the repay funtion
    function test_repay_POFluctuations1(uint256 _repayAmount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        // setting asset prices to same values
        setAggregatorPrice(295040576, 195040576);

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        if (debt > 0) {
            uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

            // add balance to user
            admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
            borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

            // repay the credit line
            borrower.repay(address(creditLine), cLId, repayAmount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

            // assert: balance change for user should be equal to amount repaid
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            assertEq(balanceDiff, repayAmount);
        }
    }

    // Prices going down to half should not affect the repay funtion
    function test_repay_POFluctuations2(uint256 _repayAmount) public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        if (debt > 0) {
            uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

            // add balance to user
            admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
            borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

            // repay the credit line
            borrower.repay(address(creditLine), creditLineId, repayAmount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

            // assert: balance change for user should be equal to amount repaid
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            assertEq(balanceDiff, repayAmount);
        }
    }

    // Ratio_of_prices = 1, should not affect the repay funtion
    function test_repay_POFluctuations3(uint256 _repayAmount) public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        // setting asset prices to same values
        setAggregatorPrice(195040576, 195040576);

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        if (debt > 0) {
            uint256 repayAmount = scaleToRange256(_repayAmount, 1, debt);

            // add balance to user
            admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
            borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

            // repay the credit line
            borrower.repay(address(creditLine), cLId, repayAmount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

            // assert: balance change for user should be equal to amount repaid
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            assertEq(balanceDiff, repayAmount);
        }
    }

    //----------------------- Price oracle variations on close function -----------------------//

    //----------------------- failing tests -----------------------//

    // Close function should fail if both asset prices become zero
    function test_close_POZero1() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), debt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, debt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, debt);

        // Altering price oracle results
        setAggregatorPrice(0, 0);

        try borrower.close(address(creditLine), creditLineId) {
            revert('Both prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // Close function should fail if either prices becomes zero
    function test_close_POZero2() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), debt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, debt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, debt);

        // Altering price oracle results
        setAggregatorPrice(195040576, 0);

        try borrower.close(address(creditLine), creditLineId) {
            revert('Collateral price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    // Close function should fail if either prices becomes zero
    function test_close_POZero3() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), debt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, debt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, debt);

        // Altering price oracle results
        setAggregatorPrice(0, 12876423400040030304304);

        try borrower.close(address(creditLine), creditLineId) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    //----------------------- passing tests -----------------------//

    // Any change in price should not affect the close funtion
    function test_close_fuzzPrices(uint128 borrowAssetPrice, uint128 collateralAssetPrice) public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        if (borrowable > 0) {
            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

            borrower.borrow(address(creditLine), creditLineId, borrowable);
            assert_creditLineBorrow(creditLineId, borrowable);

            _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

            uint256 debt = creditLine.calculateCurrentDebt(creditLineId);

            // add balance to user
            admin.transferToken(address(borrowAsset), address(borrower), debt);
            borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

            // repay the credit line
            borrower.repay(address(creditLine), creditLineId, debt);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

            // assert: balance change for user should be equal to amount repaid
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            assertEq(balanceDiff, debt);

            // Altering price oracle results
            setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

            try borrower.close(address(creditLine), creditLineId) {
                uint256 status = uint256(creditLine.getCreditLineStatus(creditLineId));
                assertEq(status, 0); // Credit Line variable are deleted
            } catch Error(string memory reason) {
                assertEq(reason, 'SafeMath: division by zero');
            }
        }
    }

    // Inverted ratio of prices should not affect the close funtion
    function test_close_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        uint256 debt = creditLine.calculateCurrentDebt(cLId);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), debt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), cLId, debt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, debt);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        borrower.close(address(creditLine), cLId);

        uint256 status = uint256(creditLine.getCreditLineStatus(cLId));
        assertEq(status, 0); // Credit Line variable are deleted
    }

    // Prices going down to half should not affect the depositCollateral funtion
    function test_close_POFluctuations2() public {
        // Initial prices //
        // collateral Asset: 12876423400040030304304 //
        // borrow Asset: 195040576 //

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);
        assert_creditLineBorrow(creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), debt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), creditLineId, debt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, debt);

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 12876423400040030304304 / 2);

        borrower.close(address(creditLine), creditLineId);

        uint256 status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Credit Line variable are deleted
    }

    // Ratio_of_prices = 1, should not affect the depositCollateral funtion
    function test_close_POFluctuations3() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //
        requestData.collateralAsset = address(testAsset);
        uint256 cLId = goToActiveStage();

        uint256 amount = 1_000 * 10**testAsset.decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(testAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(testAsset), amount);

        borrower.addCollateral(address(creditLine), cLId, amount, false);
        assert_creditLineDeposit(cLId, amount);

        uint256 borrowable = creditLine.calculateBorrowableAmount(cLId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), cLId, borrowable);
        assert_creditLineBorrow(cLId, borrowable);

        _increaseBlock(block.timestamp + 10 days); // time travel by 10 days

        uint256 debt = creditLine.calculateCurrentDebt(cLId);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), debt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), debt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(borrowAsset).balanceOf(address(borrower));

        // repay the credit line
        borrower.repay(address(creditLine), cLId, debt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(borrowAsset).balanceOf(address(borrower));

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, debt);

        // setting asset prices to invert Ratio of prices
        setAggregatorPrice(295040576, 195040576);

        borrower.close(address(creditLine), cLId);

        uint256 status = uint256(creditLine.getCreditLineStatus(cLId));
        assertEq(status, 0); // Credit Line variable are deleted
    }

    //----------------------- Assert/helper functions -----------------------//

    function assert_creditlineConstants(
        uint256 _creditLineId,
        address _requestBy,
        CLConstants.RequestParams memory requestData
    ) public {
        getCreditlineConstants(_creditLineId);

        if (requestData.requestAsLender) {
            assertEq(constantsCheck.lender, _requestBy);
            assertEq(constantsCheck.borrower, requestData.requestTo);
        } else {
            assertEq(constantsCheck.lender, requestData.requestTo);
            assertEq(constantsCheck.borrower, _requestBy);
        }

        assertEq(constantsCheck.borrowLimit, requestData.borrowLimit);
        assertEq(constantsCheck.idealCollateralRatio, requestData.collateralRatio);
        assertEq(constantsCheck.borrowRate, requestData.borrowRate);
        assertEq(constantsCheck.borrowAsset, requestData.borrowAsset);
        assertEq(constantsCheck.borrowAssetStrategy, requestData.borrowAssetStrategy);
        assertEq(constantsCheck.collateralAsset, requestData.collateralAsset);
        assertEq(constantsCheck.collateralStrategy, requestData.collateralStrategy);
    }

    function setAggregatorPrice(uint256 borrowAssetPrice, uint256 collateralPrice) public {
        if (borrowAssetPrice == 0 || collateralPrice == 0) {
            vm.mockCall(
                priceOracleAddress,
                abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(collateralAsset), address(borrowAsset)),
                abi.encode(0, 0) // price, decimals
            );
        } else {
            vm.mockCall(
                priceOracleAddress,
                abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(collateralAsset), address(borrowAsset)),
                abi.encode(collateralPrice.mul(1e18).div(borrowAssetPrice), 18) // price, decimals
            );

            vm.mockCall(
                priceOracleAddress,
                abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(testAsset), address(borrowAsset)),
                abi.encode(collateralPrice.mul(1e18).div(borrowAssetPrice), 18) // price, decimals
            );
        }
    }

    function assert_creditLineDeposit(uint256 _creditLineId, uint256 _amount) public {
        // assert the received shares and deposited amount equivalent shares are equal
        uint256 sharesReceived = creditLine.collateralShareInStrategy(_creditLineId);
        uint256 sharesOfAmount = IYield(collateralStrategy).getSharesForTokens(_amount, address(collateralAsset));

        assertEq(sharesReceived, sharesOfAmount);
    }

    function assert_creditLineBorrow(uint256 _creditLineId, uint256 _borrowAmount) public {
        // Checking balances
        uint256 protocolFeeAmount = _borrowAmount.mul(protocolFee).div(SCALING_FACTOR);
        uint256 expectedAmount = _borrowAmount.sub(protocolFeeAmount);

        uint256 borrowerBalance = borrowAsset.balanceOf(address(borrower));
        assertEq(expectedAmount, borrowerBalance);

        uint256 lenderBalance = borrowAsset.balanceOf(address(lender));
        assertEq(lenderBalance, 0);

        uint256 lenderBalanceSA = savingsAccount.balanceInShares(address(lender), address(borrowAsset), borrowAssetStrategy);
        assertEq(lenderBalanceSA, 0);

        uint256 feeCollectorBalance = borrowAsset.balanceOf(protocolFeeCollectorAddress);
        assertEq(feeCollectorBalance, protocolFeeAmount);

        // Variable updates
        (, uint256 principal, , uint256 lastPrincipalUpdateTime, ) = creditLine.creditLineVariables(_creditLineId);

        assertEq(principal, _borrowAmount);
        assertEq(lastPrincipalUpdateTime, block.timestamp);
    }
}
