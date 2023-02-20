pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_HelperFunctionTests is CLParent {
    using SafeMath for uint256;

    CreditLine creditLine;
    PriceOracle priceOracle;

    uint256 constant YEAR_IN_SECONDS = 365 days;
    uint256 constant SCALING_FACTOR = 1e18;

    uint256 public creditLineId;
    address public borrowAssetStrategy;
    address public collateralStrategy;
    uint256 _ratioOfPrices;
    uint256 _decimals;
    uint256 calculatedInterest;
    uint256 calculatedCollateralRatio;
    uint256 borrowRate;
    uint256 principal;
    uint256 totalInterestRepaid;
    uint256 collateralRatio;
    uint256 collateralTokens;

    function setUp() public virtual {
        CLSetUp();

        creditLine = CreditLine(creditLineAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (_ratioOfPrices, _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e18;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = CLConstants.maxCollteralRatio / 1e18;
        requestData.borrowAsset = address(borrowAsset);
        requestData.borrowAssetStrategy = noYieldAddress;
        requestData.collateralAsset = address(collateralAsset);
        requestData.collateralStrategy = noYieldAddress;
        requestData.requestAsLender = false;

        creditLineId = goToActiveStage();

        // Setting global parameters
        borrowAssetStrategy = requestData.borrowAssetStrategy;
        collateralStrategy = requestData.collateralStrategy;
    }

    //----------------------- Credit line calculateInterest tests -----------------------//

    // Should have zero interest when principal is not borrowed, after collateral is deposited
    function test_calculateInterest_DepositCollateral() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = 10 days;

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + timeElapsed);

        // Interest after depositing collateral should be zero
        (, , , borrowRate, , , , , , , ) = creditLine.creditLineConstants(creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(creditLineId);

        uint256 currentInterest = creditLine.calculateInterestScaled(principal, borrowRate, timeElapsed).div(SCALING_FACTOR);
        assertEq(currentInterest, 0);
    }

    // Should have non-zero interest after principal is borrowed
    function test_calculateInterest_Borrow(uint128 _borrowAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        _increaseBlock(block.timestamp + timeElapsed);
        assert_calculatedInterest(creditLineId, timeElapsed);
    }

    // Should have non-zero interest after some amount is repaid and zero after entire amount is repaid
    function test_calculateInterest_Repay(uint128 _repayAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);
        _increaseBlock(block.timestamp + 10 days);

        uint256 currentDebt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, currentDebt.sub(Borrowable).add(1), currentDebt);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        assert_calculatedInterest(creditLineId, timeElapsed);

        _increaseBlock(block.timestamp + 10 days);

        uint256 remainingDebt = creditLine.calculateCurrentDebt(creditLineId);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), remainingDebt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), remainingDebt);

        borrower.repay(address(creditLine), creditLineId, remainingDebt);

        // Interest after repaying entire credit line should be zero
        (, , , borrowRate, , , , , , , ) = creditLine.creditLineConstants(creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(creditLineId);

        uint256 currentInterest = creditLine.calculateInterestScaled(principal, borrowRate, timeElapsed).div(SCALING_FACTOR);
        assertEq(currentInterest, 0);
    }

    //----------------------- Credit line calculateInterest, assert helper -----------------------//

    function assert_calculatedInterest(uint256 _creditLineId, uint256 _timeElapsed) public {
        (, , , borrowRate, , , , , , , ) = creditLine.creditLineConstants(_creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(_creditLineId);

        uint256 currentInterest = creditLine.calculateInterestScaled(principal, borrowRate, _timeElapsed).div(SCALING_FACTOR);
        calculatedInterest = principal.mul(borrowRate).mul(_timeElapsed).div(SCALING_FACTOR).div(YEAR_IN_SECONDS);
        assertEq(currentInterest, calculatedInterest);
    }

    //----------------------- Credit line calculateInterestAccrued tests -----------------------//

    // Should have zero interest when principal is not borrowed, after collateral is deposited
    function test_calculateInterestAccrued_DepositCollateral() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = 10 days;

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        _increaseBlock(block.timestamp + timeElapsed);

        uint256 currentInterest = creditLine.calculateInterestAccrued(creditLineId);
        assertEq(currentInterest, 0);
    }

    // Should have non-zero interest after principal is borrowed
    function test_calculateInterestAccrued_Borrow(uint128 _borrowAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        _increaseBlock(block.timestamp + timeElapsed);
        assert_calculateInterestAccrued(creditLineId, timeElapsed);
    }

    // Should have non-zero interest after some amount is repaid
    function test_calculateInterestAccrued_noPrincipal_Repay(uint128 _repayAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);

        _increaseBlock(block.timestamp + timeElapsed);

        uint256 interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, interest);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        assert_calculateInterestAccrued(creditLineId, timeElapsed);
    }

    //----------------------- Credit line calculateInterestAccrued, assert helper -----------------------//

    function assert_calculateInterestAccrued(uint256 _creditLineId, uint256 _timeElapsed) public {
        (, , , borrowRate, , , , , , , ) = creditLine.creditLineConstants(_creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(_creditLineId);

        uint256 currentInterest = creditLine.calculateInterestAccrued(_creditLineId);
        calculatedInterest = principal.mul(borrowRate).mul(_timeElapsed);
        if (calculatedInterest % SCALING_FACTOR.mul(YEAR_IN_SECONDS) != 0) {
            calculatedInterest = calculatedInterest.div(SCALING_FACTOR).div(YEAR_IN_SECONDS) + 1;
        } else {
            calculatedInterest = calculatedInterest.div(SCALING_FACTOR).div(YEAR_IN_SECONDS);
        }
        assertEq(currentInterest, calculatedInterest);
    }

    //----------------------- Credit line calculateCurrentDebt tests -----------------------//

    // Should have zero debt when principal is not borrowed, after collateral is deposited
    function test_calculateCurrentDebt_DepositCollateral() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = 10 days;

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        _increaseBlock(block.timestamp + timeElapsed);

        uint256 currentDebt = creditLine.calculateCurrentDebt(creditLineId);
        assertEq(currentDebt, 0);
    }

    // Should have non-zero debt immediately after principal is borrowed
    function test_calculateCurrentDebt_Borrow(uint128 _borrowAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);

        _increaseBlock(block.timestamp + timeElapsed);
        assert_calculateCurrentDebt(creditLineId, timeElapsed);
    }

    // Should have less debt after some amount is repaid
    function test_calculateCurrentDebt_Repay(uint128 _repayAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);

        _increaseBlock(block.timestamp + timeElapsed);

        uint256 currentDebt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, currentDebt);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        (, , , borrowRate, , , , , , , ) = creditLine.creditLineConstants(creditLineId);
        (, principal, totalInterestRepaid, , ) = creditLine.creditLineVariables(creditLineId);

        currentDebt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 currentInterest = creditLine.calculateInterestAccrued(creditLineId);
        assertEq(currentDebt, currentInterest.add(principal).sub(totalInterestRepaid));
    }

    //----------------------- Credit line calculateCurrentDebt, assert helper -----------------------//

    function assert_calculateCurrentDebt(uint256 _creditLineId, uint256 _timeElapsed) public {
        (, , , borrowRate, , , , , , , ) = creditLine.creditLineConstants(_creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(_creditLineId);

        uint256 currentDebt = creditLine.calculateCurrentDebt(_creditLineId);
        calculatedInterest = principal.mul(borrowRate).mul(_timeElapsed);
        if (calculatedInterest % SCALING_FACTOR.mul(YEAR_IN_SECONDS) != 0) {
            calculatedInterest = calculatedInterest.div(SCALING_FACTOR).div(YEAR_IN_SECONDS) + 1;
        } else {
            calculatedInterest = calculatedInterest.div(SCALING_FACTOR).div(YEAR_IN_SECONDS);
        }
        assertEq(currentDebt, calculatedInterest.add(principal));
    }

    //----------------------- Credit line calculateTotalCollateralTokens tests -----------------------//

    // Should have same amount of collateral tokens, after addCollateral operation
    function test_calculateTotalCollateralTokens_DepositCollateral(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        uint256 timeElapsed = 10 days;
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        _increaseBlock(block.timestamp + timeElapsed);
        assert_calculateTotalCollateralTokens(creditLineId, collateralShares);
    }

    // Should have same amount of collateral tokens, after addCollateral operation
    function test_calculateTotalCollateralTokens_DepositCollateralTwice(uint128 _amount, uint128 _secondAmount) public {
        uint256 maxAmount = collateralAsset.totalSupply();
        uint256 amount = scaleToRange256(_amount, 1, maxAmount.div(3));
        uint256 secondAmount = scaleToRange256(_secondAmount, 1, maxAmount.div(3));
        uint256 timeElapsed = 5 days;
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        _increaseBlock(block.timestamp + timeElapsed);
        assert_calculateTotalCollateralTokens(creditLineId, collateralShares);

        // Adding collateral again
        admin.transferToken(address(collateralAsset), address(borrower), secondAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), secondAmount);

        borrower.addCollateral(address(creditLine), creditLineId, secondAmount, false);
        uint256 collateralShares1 = IYield(collateralStrategy).getSharesForTokens(secondAmount, address(collateralAsset));
        _increaseBlock(block.timestamp + timeElapsed);
        assert_calculateTotalCollateralTokens(creditLineId, collateralShares.add(collateralShares1));
    }

    // Should have same amount of collateral tokens, after borrow operation
    function test_calculateTotalCollateralTokens_Borrow(uint128 _borrowAmount) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        assert_calculateTotalCollateralTokens(creditLineId, collateralShares);
    }

    // Should have same amount of collateral tokens, after repayment operation
    function test_calculateTotalCollateralTokens_Repay(uint128 _repayAmount) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, borrowAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        assert_calculateTotalCollateralTokens(creditLineId, collateralShares);
    }

    //----------------------- Credit line calculateTotalCollateralTokens, assert helper -----------------------//

    function assert_calculateTotalCollateralTokens(uint256 _creditLineId, uint256 _collateralShares) public {
        uint256 totalCollateral = creditLine.calculateTotalCollateralTokens(_creditLineId);
        uint256 calculatedCollateral = IYield(collateralStrategy).getTokensForShares(_collateralShares, address(collateralAsset));
        assertApproxEqRel(totalCollateral, calculatedCollateral, 1e14);
    }

    //----------------------- Credit line calculateCurrentCollateralRatio tests -----------------------//

    // Current debt is zero, CCR = max(uint256)
    function test_calculateCurrentCollateralRatio_DepositCollateral() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        (collateralRatio, ) = creditLine.calculateCurrentCollateralRatio(creditLineId);
        assertEq(collateralRatio, type(uint256).max);
    }

    // Should have non-zero collateral ratio immediately after principal is borrowed
    // If current debt is zero, CCR = max(uint256)
    function test_calculateCurrentCollateralRatio_Borrow(uint128 _borrowAmount) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        assert_calculateCurrentCollateralRatio(creditLineId, collateralShares);
    }

    // Should have non-zero collateral ratio after some amount is repaid
    function test_calculateCurrentCollateralRatio_Repay(uint128 _repayAmount) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);

        uint256 repayAmount = scaleToRange256(_repayAmount, 1, borrowAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        assert_calculateCurrentCollateralRatio(creditLineId, collateralShares);
    }

    //----------------------- Credit line calculateCurrentCollateralRatio tests -----------------------//

    function assert_calculateCurrentCollateralRatio(uint256 _creditLineId, uint256 _collateralShares) public {
        (, principal, , , ) = creditLine.creditLineVariables(_creditLineId);

        (_ratioOfPrices, _decimals) = IPriceOracle(priceOracle).getLatestPrice(address(collateralAsset), address(borrowAsset));

        (collateralRatio, ) = creditLine.calculateCurrentCollateralRatio(_creditLineId);
        uint256 totalCollateral = IYield(collateralStrategy).getTokensForShares(_collateralShares, address(collateralAsset));
        if (principal == 0) {
            // After complete repayment
            assertEq(collateralRatio, type(uint256).max);
        } else {
            calculatedCollateralRatio = totalCollateral.mul(_ratioOfPrices).div(10**_decimals).mul(SCALING_FACTOR).div(principal);
            assertApproxEqRel(collateralRatio, calculatedCollateralRatio, 1e14);
        }
    }

    //----------------------- Credit line calculateBorrowableAmount tests -----------------------//

    // Should have zero borrowable amount when collateral is not deposited
    function test_calculateBorrowableAmount() public {
        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(creditLineId);
        assertEq(borrowableAmount, 0);
    }

    // Should have some borrowable amount after collateral is deposited
    function test_calculateBorrowableAmount_DepositCollateral(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        (, , , borrowRate, collateralRatio, , , , , , ) = creditLine.creditLineConstants(creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(creditLineId);

        (_ratioOfPrices, _decimals) = IPriceOracle(priceOracle).getLatestPrice(address(collateralAsset), address(borrowAsset));

        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 totalCollateral = creditLine.calculateTotalCollateralTokens(creditLineId);
        uint256 calculatedMaxPossible = totalCollateral.mul(_ratioOfPrices).div(collateralRatio).mul(SCALING_FACTOR).div(10**_decimals);
        assertApproxEqRel(borrowableAmount, Math.min(requestData.borrowLimit, calculatedMaxPossible), 1e14);
    }

    // Should have non-zero borrowable amount immediately after some amount is borrowed
    function test_calculateBorrowableAmount_Borrow(uint128 _borrowAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        _increaseBlock(block.timestamp + timeElapsed);

        assert_calculateBorrowableAmount(creditLineId, collateralShares);
    }

    // Should have zero borrowable amount immediately after all amount is borrowed
    function test_calculateBorrowableAmount_BorrowAll() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);

        assert_calculateBorrowableAmount(creditLineId, collateralShares);
    }

    // Should have zero borrowable after some amount is repaid
    function test_calculateBorrowableAmount_Repay(
        uint128 _borrowAmount,
        uint128 _repayAmount,
        uint128 _timeElapsed
    ) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, borrowAsset.totalSupply());
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);

        _increaseBlock(block.timestamp + timeElapsed);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        try borrower.repay(address(creditLine), creditLineId, repayAmount) {
            assert_calculateBorrowableAmount(creditLineId, collateralShares);
        } catch Error(string memory reason) {
            assertEq(reason, 'SA:D2');
        }
    }

    //----------------------- Credit line calculateBorrowableAmount, assert help -----------------------//

    function assert_calculateBorrowableAmount(uint256 _creditLineId, uint256 _collateralShares) public {
        (, , , , collateralRatio, , , , , , ) = creditLine.creditLineConstants(_creditLineId);
        (, principal, totalInterestRepaid, , ) = creditLine.creditLineVariables(creditLineId);

        (_ratioOfPrices, _decimals) = IPriceOracle(priceOracle).getLatestPrice(address(collateralAsset), address(borrowAsset));

        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(_creditLineId);
        uint256 totalCollateral = IYield(collateralStrategy).getTokensForShares(_collateralShares, address(collateralAsset));
        uint256 interestAccrued = creditLine.calculateInterestAccrued(_creditLineId);

        uint256 maxBorrowableAmount = totalCollateral.mul(_ratioOfPrices).div(collateralRatio).mul(SCALING_FACTOR).div(10**_decimals);

        if (maxBorrowableAmount <= principal.add(interestAccrued).sub(totalInterestRepaid)) {
            assertEq(borrowableAmount, 0);
        } else {
            assertApproxEqRel(
                borrowableAmount,
                Math.min(
                    maxBorrowableAmount - principal.add(interestAccrued).sub(totalInterestRepaid),
                    requestData.borrowLimit - principal
                ),
                1e14
            );
        }
    }

    //----------------------- Credit line withdrawableCollateral tests -----------------------//

    // Should have zero withdrawable collateral when collateral is not deposited
    function test_withdrawableCollateral() public {
        uint256 withdrawable = creditLine.withdrawableCollateral(creditLineId);
        assertEq(withdrawable, 0);
    }

    // Should have withdrawable amount = collateral deposited, when no amount is borrowed
    function test_withdrawableCollateral_DepositCollateral(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 withdrawable = creditLine.withdrawableCollateral(creditLineId);
        assertApproxEqAbs(withdrawable, amount, 1);
    }

    // Should have withdrawable amount < collateral deposited, when some amount is borrowed
    function test_withdrawableCollateral_Borrow(uint128 _borrowAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        _increaseBlock(block.timestamp + timeElapsed);
        assert_withdrawableCollateral(creditLineId);
    }

    // Should have non-zero withdrawable collateral after some amount is repaid
    function test_withdrawableCollateral_Repay(uint128 _repayAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, borrowAsset.totalSupply());
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);

        _increaseBlock(block.timestamp + timeElapsed);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        _increaseBlock(block.timestamp + timeElapsed);
        assert_withdrawableCollateral(creditLineId);
    }

    //----------------------- Credit line withdrawableCollateral, assert helper -----------------------//

    function assert_withdrawableCollateral(uint256 _creditLineId) public {
        (, , , borrowRate, collateralRatio, , , , , , ) = creditLine.creditLineConstants(_creditLineId);
        (, principal, , , ) = creditLine.creditLineVariables(_creditLineId);

        (_ratioOfPrices, _decimals) = IPriceOracle(priceOracle).getLatestPrice(address(collateralAsset), address(borrowAsset));

        uint256 withdrawable = creditLine.withdrawableCollateral(_creditLineId);
        uint256 currentDebt = creditLine.calculateCurrentDebt(_creditLineId);
        uint256 totalCollateral = creditLine.calculateTotalCollateralTokens(_creditLineId);
        uint256 calculatedWithdrawable = currentDebt.mul(collateralRatio).div(_ratioOfPrices).mul(10**_decimals).div(SCALING_FACTOR);

        if (calculatedWithdrawable >= totalCollateral) {
            // value more than total collateral tokens
            assertEq(withdrawable, 0);
        } else {
            assertApproxEqRel(withdrawable, totalCollateral.sub(calculatedWithdrawable), 1e14);
        }
    }

    //----------------------- Credit line borrowTokensToLiquidate tests -----------------------//

    // Should have zero borrowTokensToLiquidate when principal is not borrowed, after collateral is deposited
    function test_borrowTokensToLiquidate_DepositCollateral() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 Toliquidate = creditLine.borrowTokensToLiquidate(creditLineId);
        // current debt is 0, hence borrowTokens to liquidate is also 0
        assertEq(Toliquidate, 0);
    }

    // Should have non-zero borrowTokensToLiquidate immediately after principal is borrowed
    function test_borrowTokensToLiquidate_Borrow(uint128 _borrowAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);
        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, BorrowAmount);

        borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
        _increaseBlock(block.timestamp + timeElapsed);
        assert_borrowTokensToLiquidate(creditLineId, collateralShares);
    }

    // Should have non-zero borrowTokensToLiquidate after some amount is repaid
    function test_borrowTokensToLiquidate_Repay(uint128 _repayAmount, uint128 _timeElapsed) public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 timeElapsed = scaleToRange256(_timeElapsed, 1, 7500 days);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, borrowAsset.totalSupply());
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, Borrowable);

        borrower.borrow(address(creditLine), creditLineId, Borrowable);

        _increaseBlock(block.timestamp + timeElapsed);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(borrowAsset), address(borrower), repayAmount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), repayAmount);

        borrower.repay(address(creditLine), creditLineId, repayAmount);
        assert_borrowTokensToLiquidate(creditLineId, collateralShares);
    }

    //----------------------- Credit line borrowTokensToLiquidate, assert helper -----------------------//

    function assert_borrowTokensToLiquidate(uint256 _creditLineId, uint256 _collateralShares) public {
        (_ratioOfPrices, _decimals) = IPriceOracle(priceOracle).getLatestPrice(address(collateralAsset), address(borrowAsset));
        uint256 liquidatorRewardFraction = creditLine.liquidatorRewardFraction();
        uint256 Toliquidate = creditLine.borrowTokensToLiquidate(_creditLineId);
        uint256 debt = creditLine.calculateCurrentDebt(_creditLineId);
        uint256 equivalentCollateral = (debt).mul(10**_decimals).div(_ratioOfPrices);
        uint256 totalCollateral = IYield(collateralStrategy).getTokensForShares(_collateralShares, address(collateralAsset));
        if (equivalentCollateral > totalCollateral) {
            equivalentCollateral = totalCollateral;
        }
        uint256 borrowTokens = (equivalentCollateral.mul(uint256(SCALING_FACTOR).sub(liquidatorRewardFraction)).div(SCALING_FACTOR))
            .mul(_ratioOfPrices)
            .div(10**_decimals);
        assertApproxEqRel(Toliquidate, borrowTokens, 1e14);
    }
}
