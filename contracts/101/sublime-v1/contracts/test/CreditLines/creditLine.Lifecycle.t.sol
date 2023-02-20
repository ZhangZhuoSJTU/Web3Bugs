pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../SavingsAccount/SavingsAccount.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

// Possible paths //
// NotCreated -> Requested //
// Requested -> Active //
// Requested -> Closed (NotCreated)//
// Requested -> Cancelled (NotCreated)//
// Active -> Closed (NotCreated)//
// Active -> Liquidated (NotCreated)//

contract CreditLine_LifecycleTests is CLParent {
    using SafeMath for uint256;

    uint256 status;
    uint256 creditLineId;
    uint256 protocolFee;
    uint256 constant SCALING_FACTOR = 1e18;

    CreditLine creditLine;
    SavingsAccount savingsAccount;
    PriceOracle priceOracle;

    function setUp() public virtual {
        CLSetUp();

        creditLine = CreditLine(creditLineAddress);
        savingsAccount = SavingsAccount(savingsAccountAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e18;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = 350 * (CLConstants.maxCollteralRatio / 1e11);
        requestData.borrowAsset = address(borrowAsset);
        requestData.borrowAssetStrategy = noYieldAddress;
        requestData.collateralAsset = address(collateralAsset);
        requestData.collateralStrategy = noYieldAddress;
        requestData.requestAsLender = false;

        protocolFee = creditLine.protocolFeeFraction();
    }

    // Events
    event CollateralSharesDeposited(uint256 indexed id, uint256 shares);
    event CollateralSharesWithdrawn(uint256 indexed id, uint256 shares);
    event CreditLineRequested(uint256 indexed id, address indexed lender, address indexed borrower, bool requestByLender);
    event CreditLineLiquidated(uint256 indexed id, address indexed liquidator);
    event BorrowedFromCreditLine(uint256 indexed id, uint256 borrowAmount);
    event CreditLineAccepted(uint256 indexed id);
    event PartialCreditLineRepaid(uint256 indexed id, address indexed repayer, uint256 repayAmount);
    event CompleteCreditLineRepaid(uint256 indexed id, address indexed repayer, uint256 repayAmount);
    event CreditLineCancelled(uint256 indexed id);
    event CreditLineClosed(uint256 indexed id, bool closedByLender);

    // Adding enough collateral for a target collateral ratio, should give the same current collateral ratio
    // Assuming borrower borrows amount = borrow limit
    function test_targetCollateralRatio(uint256 _collateralRatio) public {
        requestData.collateralRatio = 15 * 1e16; // 15%
        // Request for a creditLine
        creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Accept a creditLine
        lender.acceptRequest(creditLineAddress, creditLineId);
        status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Should return to Active stage

        // Calculating required collateral amount for target collateral ratio
        uint256 targetCollateralRatio = scaleToRange256(_collateralRatio, requestData.collateralRatio, CLConstants.maxCollteralRatio);
        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(collateralAsset), address(borrowAsset));
        uint256 collateralRequired = targetCollateralRatio.mul(requestData.borrowLimit).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        if (collateralRequired <= ERC20(collateralAsset).totalSupply()) {
            // Adding tokens to borrower and setting allowance for creditline contract
            admin.transferToken(address(collateralAsset), address(borrower), collateralRequired);
            borrower.setAllowance(address(creditLine), address(collateralAsset), collateralRequired);

            borrower.addCollateral(address(creditLine), creditLineId, collateralRequired, false);
            assert_creditLineDeposit(creditLineId, collateralRequired);

            // Collateral ratio should be type(uint256).max, before borrowing any amount
            (uint256 currentCollateralRatio, uint256 totalCollateralTokens) = creditLine.calculateCurrentCollateralRatio(creditLineId);
            assertEq(currentCollateralRatio, type(uint256).max);
            assertApproxEqRel(totalCollateralTokens, collateralRequired, 1e14);

            // Borrowable amount check
            uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
            assertApproxEqRel(borrowable, requestData.borrowLimit, 1e14);

            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), requestData.borrowAssetStrategy, borrowable);

            borrower.borrow(address(creditLine), creditLineId, borrowable);
            uint256 borrowShares = IYield(requestData.borrowAssetStrategy).getSharesForTokens(borrowable, address(borrowAsset));
            assert_creditLineBorrow(creditLineId, borrowShares);

            // Current collateral ratio should be equal to target collateral ratio as borrow amount is equal to borrow limit
            (currentCollateralRatio, totalCollateralTokens) = creditLine.calculateCurrentCollateralRatio(creditLineId);
            assertApproxEqRel(currentCollateralRatio, targetCollateralRatio, 1e14);
        }
    }

    function test_RequestedToCancelled() public {
        // Request for a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineRequested(1, address(lender), address(borrower), false);
        creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Cancel creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineCancelled(creditLineId);
        borrower.cancelRequest(creditLineAddress, creditLineId);
        status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Should return to Not_Created stage
    }

    function test_RequestedToActiveToClosed_withOutBorrow(uint256 _amount) public {
        // Request for a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineRequested(1, address(lender), address(borrower), false);
        creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Accept a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineAccepted(creditLineId);
        lender.acceptRequest(creditLineAddress, creditLineId);
        status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Should return to Active stage

        // Deposit to creditLine
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        uint256 collateralShares = IYield(requestData.collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        vm.expectEmit(true, true, false, true);
        emit CollateralSharesDeposited(creditLineId, collateralShares);
        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        uint256 withdrawable = creditLine.withdrawableCollateral(creditLineId);
        if (withdrawable > 0) {
            uint256 withdrawShares = IYield(requestData.collateralStrategy).getSharesForTokens(withdrawable, address(collateralAsset));
            // Close the creditLine
            vm.expectEmit(true, true, false, true);
            emit CollateralSharesWithdrawn(creditLineId, withdrawShares);
            vm.expectEmit(true, true, false, true);
            emit CreditLineClosed(creditLineId, true);
            lender.close(creditLineAddress, creditLineId);
            status = uint256(creditLine.getCreditLineStatus(creditLineId));
            assertEq(status, 0); // Should return to Not_Created stage
        }
    }

    function test_RequestedToActiveToLiquidated(uint256 _amount, uint256 _borrowAmount) public {
        // Request for a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineRequested(1, address(lender), address(borrower), false);
        creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Accept a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineAccepted(creditLineId);
        lender.acceptRequest(creditLineAddress, creditLineId);
        status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Should return to Active stage

        // Deposit to creditLine
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        uint256 collateralShares = IYield(requestData.collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        vm.expectEmit(true, true, false, true);
        emit CollateralSharesDeposited(creditLineId, collateralShares);
        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // Borrow from a creditLine
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(collateralAsset), address(borrowAsset));
        uint256 collateralTokens = IYield(requestData.collateralStrategy).getTokensForShares(collateralShares, address(collateralAsset));
        uint256 calculateBorrowable = collateralTokens.mul(_ratioOfPrices).div(requestData.collateralRatio).mul(SCALING_FACTOR).div(
            10**_decimals
        );
        assertEq(Borrowable, Math.min(requestData.borrowLimit, calculateBorrowable));

        if (Borrowable > 0) {
            uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);

            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), requestData.borrowAssetStrategy, BorrowAmount);
            uint256 borrowShares = IYield(requestData.borrowAssetStrategy).getSharesForTokens(BorrowAmount, address(borrowAsset));
            uint256 borrowAmount = IYield(requestData.borrowAssetStrategy).getTokensForShares(borrowShares, address(borrowAsset));
            uint256 expectedBorrow = borrowAmount.sub(borrowAmount.mul(protocolFee).div(SCALING_FACTOR));
            vm.expectEmit(true, true, false, true);
            emit BorrowedFromCreditLine(creditLineId, borrowAmount);
            borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
            assert_creditLineBorrow(creditLineId, borrowShares);

            if (!isForked) {
                borrowAssetMockAggregator.updateAnswer(9795040576);
            } else {
                _increaseBlock(block.timestamp + 7500000000 days);
            }

            (uint256 currentColRatio, ) = creditLine.calculateCurrentCollateralRatio(creditLineId);
            if (expectedBorrow > 0 && currentColRatio < requestData.collateralRatio) {
                // Liquidate the creditLine
                vm.expectEmit(true, true, false, true);
                emit CreditLineLiquidated(creditLineId, address(lender));
                lender.liquidate(creditLineAddress, creditLineId, false);
                status = uint256(creditLine.getCreditLineStatus(creditLineId));
                assertEq(status, 0); // Should return to Not_Created stage
            }
        }
    }

    function test_RequestedToActiveToClosed_AfterRepay(uint256 _amount, uint256 _borrowAmount) public {
        // Request for a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineRequested(1, address(lender), address(borrower), false);
        creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Accept a creditLine
        vm.expectEmit(true, true, false, true);
        emit CreditLineAccepted(creditLineId);
        lender.acceptRequest(creditLineAddress, creditLineId);
        status = uint256(creditLine.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Should return to Active stage

        // Deposit to creditLine
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        uint256 collateralShares = IYield(requestData.collateralStrategy).getSharesForTokens(amount, address(collateralAsset));
        vm.expectEmit(true, true, false, true);
        emit CollateralSharesDeposited(creditLineId, collateralShares);
        borrower.addCollateral(address(creditLine), creditLineId, amount, false);
        assert_creditLineDeposit(creditLineId, amount);

        // Borrow from a creditLine
        uint256 Borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(collateralAsset), address(borrowAsset));
        uint256 collateralTokens = IYield(requestData.collateralStrategy).getTokensForShares(collateralShares, address(collateralAsset));
        uint256 calculateBorrowable = collateralTokens.mul(_ratioOfPrices).div(requestData.collateralRatio).mul(SCALING_FACTOR).div(
            10**_decimals
        );
        assertEq(Borrowable, Math.min(requestData.borrowLimit, calculateBorrowable));

        if (Borrowable > 0) {
            uint256 BorrowAmount = scaleToRange256(_borrowAmount, 1, Borrowable);

            // Adding tokens to lender and depositing to lender's savings Account
            savingsAccount_depositHelper(address(lender), address(borrowAsset), requestData.borrowAssetStrategy, BorrowAmount);
            uint256 borrowShares = IYield(requestData.borrowAssetStrategy).getSharesForTokens(BorrowAmount, address(borrowAsset));
            uint256 borrowAmount = IYield(requestData.borrowAssetStrategy).getTokensForShares(borrowShares, address(borrowAsset));
            vm.expectEmit(true, true, false, true);
            emit BorrowedFromCreditLine(creditLineId, borrowAmount);
            borrower.borrow(address(creditLine), creditLineId, BorrowAmount);
            assert_creditLineBorrow(creditLineId, borrowShares);

            if (borrowShares > 0) {
                try lender.close(creditLineAddress, creditLineId) {
                    revert('Should not be able to close before complete Repayment');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:C3');
                }

                // Repay the creditLine
                vm.expectEmit(true, true, false, true);
                emit CompleteCreditLineRepaid(creditLineId, address(borrower), borrowAmount);
                assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), BorrowAmount);

                uint256 totalCollateral = IYield(requestData.collateralStrategy).getTokensForShares(
                    collateralShares,
                    address(collateralAsset)
                );
                uint256 withdrawShares = IYield(requestData.collateralStrategy).getSharesForTokens(
                    totalCollateral,
                    address(collateralAsset)
                );
                // Close the creditLine
                vm.expectEmit(true, true, false, true);
                emit CollateralSharesWithdrawn(creditLineId, withdrawShares);
                vm.expectEmit(true, true, false, true);
                emit CreditLineClosed(creditLineId, true);
                lender.close(creditLineAddress, creditLineId);
                status = uint256(creditLine.getCreditLineStatus(creditLineId));
                assertEq(status, 0); // Should return to Not_Created stage
            }
        }
    }

    //----------------------- Assert helper functions -----------------------//

    function assert_creditlineConstantsAndStatus(
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
        assertEq(constantsCheck.collateralAsset, requestData.collateralAsset);
        assertEq(constantsCheck.collateralStrategy, requestData.collateralStrategy);

        status = uint256(creditLine.getCreditLineStatus(_creditLineId));
        assertEq(status, 1); // Checking if creditLine status is updated to REQUESTED
    }

    function assert_creditLineDeposit(uint256 _creditLineId, uint256 _amount) public {
        // assert the received shares and deposited amount equivalent shares are equal
        uint256 sharesReceived = creditLine.collateralShareInStrategy(_creditLineId);
        uint256 sharesOfAmount = IYield(requestData.collateralStrategy).getSharesForTokens(_amount, address(collateralAsset));

        assertEq(sharesReceived, sharesOfAmount);
    }

    function assert_creditLineBorrow(uint256 _creditLineId, uint256 _borrowShares) public {
        uint256 _borrowAmount = IYield(requestData.borrowAssetStrategy).getTokensForShares(_borrowShares, address(borrowAsset));
        // Checking balances
        uint256 protocolFeeAmount = _borrowAmount.mul(protocolFee).div(SCALING_FACTOR);
        uint256 expectedAmount = _borrowAmount.sub(protocolFeeAmount);

        uint256 borrowerBalance = borrowAsset.balanceOf(address(borrower));
        assertEq(expectedAmount, borrowerBalance);

        uint256 lenderBalance = borrowAsset.balanceOf(address(lender));
        assertEq(lenderBalance, 0);

        uint256 lenderBalanceSA = savingsAccount.balanceInShares(address(lender), address(borrowAsset), requestData.borrowAssetStrategy);
        assertEq(lenderBalanceSA, 0);

        uint256 feeCollectorBalance = borrowAsset.balanceOf(protocolFeeCollectorAddress);
        assertEq(feeCollectorBalance, protocolFeeAmount);

        // Variable updates
        (, uint256 principal, , uint256 lastPrincipalUpdateTime, ) = creditLine.creditLineVariables(_creditLineId);

        assertEq(principal, _borrowAmount);
        assertEq(lastPrincipalUpdateTime, block.timestamp);
    }

    function assert_creditLineRepay_FullDebt(
        address _user,
        uint256 _creditLineId,
        address _asset,
        uint256 _amount
    ) public {
        // initialize the user
        CLUser user = CLUser(_user);
        uint256 currentDebt = creditLine.calculateCurrentDebt(_creditLineId);

        // add balance to user
        admin.transferToken(_asset, _user, _amount);
        user.setAllowance(address(creditLine), _asset, _amount);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(_asset).balanceOf(_user);

        // repay the credit line
        user.repay(address(creditLine), _creditLineId, _amount);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(_asset).balanceOf(_user);

        // assert: balance change for user should be equal to amount repaid
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        assertEq(balanceDiff, currentDebt);

        // checking the variable updates after repayment
        (
            ,
            uint256 principal,
            uint256 totalInterestRepaid,
            uint256 lastPrincipalUpdateTime,
            uint256 interestAccruedTillLastPrincipalUpdate
        ) = creditLine.creditLineVariables(_creditLineId);

        // if total debt is repaid, credit line is reset
        assertEq(principal, 0);
        assertEq(totalInterestRepaid, 0);
        assertEq(lastPrincipalUpdateTime, 0);
        assertEq(interestAccruedTillLastPrincipalUpdate, 0);
    }
}
