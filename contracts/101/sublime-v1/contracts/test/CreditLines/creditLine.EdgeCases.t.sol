pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../SavingsAccount/SavingsAccount.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_EdgeCaseTests is CLParent {
    using SafeMath for uint256;

    CreditLine creditLine;
    SavingsAccount savingsAccount;
    PriceOracle priceOracle;

    uint256 status;
    uint256 creditLineId;
    uint256 protocolFee;
    address borrowAssetStrategy;
    address collateralStrategy;

    uint256 constant SCALING_FACTOR = 1e18;

    function setUp() public virtual {
        CLSetUp();

        creditLine = CreditLine(creditLineAddress);
        savingsAccount = SavingsAccount(savingsAccountAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e12;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = CLConstants.maxCollteralRatio / 1e18;
        requestData.borrowAsset = address(borrowAsset);
        requestData.borrowAssetStrategy = noYieldAddress;
        requestData.collateralAsset = address(collateralAsset);
        requestData.collateralStrategy = noYieldAddress;
        requestData.requestAsLender = false;

        protocolFee = creditLine.protocolFeeFraction();

        admin.updateBorrowLimitLimits(0, type(uint256).max, address(creditLine));
        admin.updateIdealCollateralRatioLimits(0, type(uint256).max, address(creditLine));
        admin.updateBorrowRateLimits(0, type(uint256).max, address(creditLine));
    }

    // Borrow Limit = 0

    // Depositing collateral into creditline should pass with correct parameters
    function test_creditLineDeposit_BL0(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Cannot borrow anything if Borrow Limit is set to 0
    function test_BorrowFromCreditLine_BL0(uint128 _borrowAmount) public {
        uint256 collateralAmount = 100 * 10**(ERC20(address(collateralAsset)).decimals());
        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowAsset.totalSupply());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(creditLineId);
        assertEq(borrowableAmount, 0);
        // Since borrowableAmount = 0, cannot borrow anything from the credit line

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), borrowAmount);

        // Borrowing non-zero amount when borrowable = 0
        try borrower.borrow(address(creditLine), creditLineId, borrowAmount) {
            revert('REVERT: Borrowing more than allowed');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:B2');
        }

        // Borrowing borrowable amount (amount = 0)
        try borrower.borrow(address(creditLine), creditLineId, borrowableAmount) {
            revert('REVERT: Borrowing zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:B1');
        }
    }

    // Can withdraw the entire amount deposited as borrow is not possible
    function test_WithdrawAllCollateral_BL0(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false);
        uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));

        assertApproxEqAbs(balanceBorrowerAfter.sub(balanceBorrower), amount, 2);
    }

    // Can withdraw the entire amount deposited as borrow is not possible
    function test_WithdrawCollateral_BL0(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));

            assertEq(balanceBorrowerAfter.sub(balanceBorrower), amount);
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC3');
        }
    }

    // Should be able to close credit line
    function test_CloseCreditLine_BL0() public {
        uint256 amount = 100 * 10**(ERC20(address(collateralAsset)).decimals());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // Closing the credit line
        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        borrower.close(creditLineAddress, creditLineId);
        uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));

        assertApproxEqAbs(balanceBorrowerAfter.sub(balanceBorrower), amount, 2);

        uint256 _status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(_status, 0); // status should revert to NOT_CREATED
    }

    // Should be able to withdraw all collateral and then close the credit line
    function test_WithdrawAndCloseCreditLine_BL0() public {
        uint256 amount = 100 * 10**(ERC20(address(collateralAsset)).decimals());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // withdraw collateral from credit line
        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));

            assertEq(balanceBorrowerAfter.sub(balanceBorrower), amount);

            // close credit line
            borrower.close(creditLineAddress, creditLineId);
            uint256 _status = uint256(creditLine.getCreditLineStatus(creditLineId));
            assertEq(_status, 0); // status should revert to NOT_CREATED
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC3');
        }
    }

    // Should be able to withdraw all collateral and then close the credit line
    function test_WithdrawAndCloseCreditLine1_BL0() public {
        uint256 amount = 100 * 10**(ERC20(address(collateralAsset)).decimals());
        requestData.borrowLimit = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // withdraw collateral from credit line
        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false);
        uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));

        assertApproxEqAbs(balanceBorrowerAfter.sub(balanceBorrower), amount, 2);

        // close credit line
        borrower.close(creditLineAddress, creditLineId);
        uint256 _status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(_status, 0); // status should revert to NOT_CREATED
    }

    // Collateral ratio = 0

    // Depositing collateral into creditline should pass with correct parameters
    function test_creditLineDeposit_CR0(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        requestData.collateralRatio = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    function assert_creditLineDeposit(uint256 _creditLineId, uint256 _amount) public {
        collateralStrategy = requestData.collateralStrategy;
        // assert the received shares and deposited amount equivalent shares are equal
        uint256 sharesReceived = creditLine.collateralShareInStrategy(_creditLineId);
        uint256 sharesOfAmount = IYield(collateralStrategy).getSharesForTokens(_amount, address(collateralAsset));

        assertEq(sharesReceived, sharesOfAmount);
    }

    function assert_creditLineLend(
        address _user,
        address _asset,
        uint256 _amount
    ) public {
        borrowAssetStrategy = requestData.borrowAssetStrategy;
        uint256 userBalanceSABefore = savingsAccount.balanceInShares(_user, _asset, borrowAssetStrategy);

        savingsAccount_depositHelper(_user, _asset, borrowAssetStrategy, _amount);

        uint256 userBalanceSA = savingsAccount.balanceInShares(_user, _asset, borrowAssetStrategy);
        uint256 sharesOfAmount = IYield(borrowAssetStrategy).getSharesForTokens(_amount, _asset);
        assertEq(userBalanceSA.sub(userBalanceSABefore), sharesOfAmount);
    }

    function test_BorrowFromCreditLine_CR0(uint128 _borrowAmount) public {
        uint256 amount = 100 * 10**(ERC20(address(collateralAsset)).decimals());
        borrowAssetStrategy = requestData.borrowAssetStrategy;
        requestData.collateralRatio = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        // For CR=0, borrowable amount = borrowLimit
        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(creditLineId);
        assertEq(borrowableAmount, requestData.borrowLimit);
        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowableAmount);

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(borrowAmount, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);
    }

    function assert_creditLineBorrow(uint256 _creditLineId, uint256 _borrowShares) public {
        borrowAssetStrategy = requestData.borrowAssetStrategy;
        uint256 _borrowAmount = IYield(borrowAssetStrategy).getTokensForShares(_borrowShares, address(borrowAsset));
        // Checking balances
        uint256 protocolFeeAmount = _borrowAmount.mul(protocolFee).div(SCALING_FACTOR);
        uint256 expectedAmount = _borrowAmount.sub(protocolFeeAmount);

        uint256 borrowerBalance = borrowAsset.balanceOf(address(borrower));
        assertEq(expectedAmount, borrowerBalance);

        uint256 lenderBalanceSA = savingsAccount.balanceInShares(address(lender), address(borrowAsset), borrowAssetStrategy);
        assertEq(lenderBalanceSA, 0);

        uint256 feeCollectorBalance = borrowAsset.balanceOf(protocolFeeCollectorAddress);
        assertEq(feeCollectorBalance, protocolFeeAmount);

        // Variable updates
        (, uint256 principal, , uint256 lastPrincipalUpdateTime, ) = creditLine.creditLineVariables(_creditLineId);

        assertEq(principal, _borrowAmount);
        assertEq(lastPrincipalUpdateTime, block.timestamp);
    }

    function test_WithdrawCollateral_CR0(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        requestData.collateralRatio = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), requestData.borrowLimit);

        // For CR=0, borrowable amount = borrowLimit
        borrower.borrow(address(creditLine), creditLineId, requestData.borrowLimit);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(requestData.borrowLimit, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);

        uint256 balanceBorrower = collateralAsset.balanceOf(address(borrower));
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            uint256 balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));

            assertEq(balanceBorrowerAfter.sub(balanceBorrower), amount);

            (, uint256 principal, , , ) = creditLine.creditLineVariables(creditLineId);
            assertEq(principal, requestData.borrowLimit);
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC3');
        }
    }

    function test_BorrowWithoutCollateralDeposit_CR0() public {
        requestData.collateralRatio = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), requestData.borrowLimit);

        // For CR=0, borrowable amount = borrowLimit
        borrower.borrow(address(creditLine), creditLineId, requestData.borrowLimit);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(requestData.borrowLimit, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);
    }

    // Borrower should not be able to liquidate credit line if CR=0
    function test_BorowAndLiquidateCreditLine_CR0_borrower() public {
        requestData.collateralRatio = 0;
        requestData.autoLiquidation = true;
        creditLineId = goToActiveStage();

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), requestData.borrowLimit);

        // For CR=0, borrowable amount = borrowLimit
        borrower.borrow(address(creditLine), creditLineId, requestData.borrowLimit);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(requestData.borrowLimit, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);

        try borrower.liquidate(creditLineAddress, creditLineId, false) {
            revert('REVERT: Should not be able to liquidate');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L3');
        }
    }

    // Liquidator should not be able to liquidate credit line if CR=0
    function test_BorowAndLiquidateCreditLine_CR0_liquidator() public {
        requestData.collateralRatio = 0;
        requestData.autoLiquidation = true;
        creditLineId = goToActiveStage();

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), requestData.borrowLimit);

        // For CR=0, borrowable amount = borrowLimit
        borrower.borrow(address(creditLine), creditLineId, requestData.borrowLimit);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(requestData.borrowLimit, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);

        try liquidator.liquidate(creditLineAddress, creditLineId, false) {
            revert('REVERT: Should not be able to liquidate');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L3');
        }
    }

    // Lender should be able to liquidate credit line if CR=0
    function test_BorowAndLiquidateCreditLine_CR0_lender() public {
        requestData.collateralRatio = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), requestData.borrowLimit);

        // For CR=0, borrowable amount = borrowLimit
        borrower.borrow(address(creditLine), creditLineId, requestData.borrowLimit);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(requestData.borrowLimit, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);

        uint256 currentBalance = collateralAsset.balanceOf(address(lender));
        lender.liquidate(creditLineAddress, creditLineId, false);
        uint256 balanceAfter = collateralAsset.balanceOf(address(lender));
        assertEq(balanceAfter.sub(currentBalance), 0);
    }

    // Borrow Rate = 0

    // Depositing collateral into creditline should pass with correct parameters
    function test_creditLineDeposit_BR0(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());
        requestData.borrowRate = 0;
        creditLineId = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);
    }

    // Borrowing from credit line should pass
    function test_BorrowFromCreditLine_BR0(uint256 _borrowAmount) public {
        requestData.borrowRate = 0;
        creditLineId = goToActiveStage();

        uint256 amount = 10_000 * 10**(ERC20(address(collateralAsset)).decimals());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(creditLineId);

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowableAmount);

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(borrowAmount, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);
    }

    // Repaying a credit line should pass
    // No interest is accrued and only principal is repaid
    function test_RepayCreditLine_BR0() public {
        requestData.borrowRate = 0;
        creditLineId = goToActiveStage();

        uint256 amount = 10_000 * 10**(ERC20(address(collateralAsset)).decimals());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowableAmount = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        assert_creditLineLend(address(lender), address(borrowAsset), borrowableAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowableAmount);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Calculating interest accrued
        uint256 interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 currentDebt = creditLine.calculateCurrentDebt(creditLineId);

        assertEq(interest, 0);
        assertApproxEqRel(currentDebt, borrowableAmount, 1e14);

        // add balance to borrower
        admin.transferToken(address(borrowAsset), address(borrower), currentDebt);
        borrower.setAllowance(address(creditLine), address(borrowAsset), currentDebt);

        // Repaying total debt
        borrower.repay(address(creditLine), creditLineId, currentDebt);
        borrower.close(address(creditLine), creditLineId);
        status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 0);
    }

    // updateBorrowLimit, attack scenarios

    // lender can update borrow limit and accept based on the new limit
    function test_updateBorrowLimit_Requested(uint128 _newBorrowLimit) public {
        creditLineId = borrower.createRequest(creditLineAddress, requestData);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, _newBorrowLimit) {
            lender.acceptRequest(creditLineAddress, creditLineId);
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // lender should be able to update borrow limit after borrower has borrowed (borrow limit borrowed)
    // Further borrowing should not be possible
    function test_updateBorrowLimit_Borrowed(uint128 _newBorrowLimit) public {
        creditLineId = goToActiveStage();

        // add collateral to credit line
        uint256 amount = 10_000 * 10**(ERC20(address(collateralAsset)).decimals());
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        // borrower borrows amount = borrow limit
        assert_creditLineLend(address(lender), address(borrowAsset), requestData.borrowLimit);

        borrower.borrow(address(creditLine), creditLineId, requestData.borrowLimit);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(requestData.borrowLimit, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);

        // updating borrow limit to lt older borrow limit after borrower has borrowed borrow limit amount
        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));
        uint128 newLimitForBorrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e7).mul(_ratioOfPrices).div(10**_decimals));
        uint128 newBorrowLimit = scaleToRange128(_newBorrowLimit, 1, newLimitForBorrowLimit);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, newBorrowLimit) {
            getCreditlineConstants(creditLineId);
            assertEq(constantsCheck.borrowLimit, newBorrowLimit);
            try creditLine.calculateBorrowableAmount(creditLineId) {
                revert('Should revert as principal>borrowLimit');
            } catch Error(string memory reason) {
                assertEq(reason, 'SafeMath: subtraction overflow');
            }
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }
}
