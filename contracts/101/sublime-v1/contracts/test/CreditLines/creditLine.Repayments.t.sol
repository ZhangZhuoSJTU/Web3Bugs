pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_RepaymentTests is CLParent {
    using SafeMath for uint256;

    uint256 creditLineId;
    uint256 amount;

    CreditLine creditLine;
    PriceOracle priceOracle;

    address[] public userList;

    function setUp() public virtual {
        CLSetUp();

        creditLine = CreditLine(creditLineAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

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

        // Adding addresses to array
        userList.push(address(admin));
        userList.push(address(borrower));
        userList.push(address(lender));
        userList.push(address(liquidator));

        creditLineId = goToActiveStage();

        amount = 10_000 * 10**(ERC20(address(collateralAsset)).decimals());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), requestData.borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);
    }

    //----------------------- Credit line Repay, failing tests -----------------------//

    // Repaying zero amount should fail
    function test_RepayZeroAmount() public {
        try borrower.repay(address(creditLine), creditLineId, 0) {
            revert('REVERT: Cannot repay zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP1');
        }
    }

    // Repaying to invalid (not ACTIVE) creditline should fail
    function test_RepayInvalidCreditLine() public {
        // Request a credit line
        uint256 newCreditLineId = borrower.createRequest(address(creditLine), requestData);

        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(borrowAsset), amount);

        try borrower.repay(address(creditLine), newCreditLineId, amount) {
            revert('REVERT: Cannot repay to invalid creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP2');
        }
    }

    // Lender should not be allowed to repay the creditline
    function test_RepayInvalidActor() public {
        // add balance to user
        admin.transferToken(address(borrowAsset), address(lender), amount);
        lender.setAllowance(address(creditLine), address(borrowAsset), amount);

        try lender.repay(address(creditLine), creditLineId, amount) {
            revert('REVERT: Invalid actor cannot repay');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP3');
        }
    }

    // Repaying creditline with insufficient balance should fail
    function test_RepayInsufficientBalance() public {
        uint256 toRepay = creditLine.calculateCurrentDebt(creditLineId);
        // add balance to user
        admin.transferToken(address(borrowAsset), address(borrower), toRepay.sub(10));
        borrower.setAllowance(address(creditLine), address(borrowAsset), toRepay.sub(10));

        try borrower.repay(address(creditLine), creditLineId, toRepay) {
            revert('REVERT: Insufficient Balance');
        } catch Error(string memory reason) {
            if (!isForked) {
                assertEq(reason, 'ERC20: transfer amount exceeds allowance');
            } else {
                assertEq(reason, 'Dai/insufficient-allowance');
            }
        }
    }

    //----------------------- Credit line Repay, passing tests -----------------------//

    // Any actor, except lender can repay any amount
    function test_creditLineRepay_RandomUser() public {
        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                // Time travel by 10 days and repay
                _increaseBlock(block.timestamp + 10 days);
                uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);

                // Repay and related checks
                assert_creditLineRepay_amountGTinterest(address(user), creditLineId, address(borrowAsset), Interest.add(100));
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(lender)) {
                    // Time travel by 10 days and repay remaining interest
                    _increaseBlock(block.timestamp + 10 days);
                    uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
                    (, , uint256 interestRepaid, , ) = creditLine.creditLineVariables(creditLineId);

                    // Repay and related checks
                    assert_creditLineRepay_amountLTEinterest(
                        address(user),
                        creditLineId,
                        address(borrowAsset),
                        Interest.sub(interestRepaid)
                    );
                }
            }
        }
    }

    // Borrower Repaying amount>Interest & amount<Total Debt from Wallet should pass
    function test_creditLineRepay_amountGTInterest(uint128 _repayAmount) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        (, uint256 principal, , , ) = creditLine.creditLineVariables(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, Interest.add(1), principal.add(Interest));

        // Repay and related checks
        assert_creditLineRepay_amountGTinterest(address(borrower), creditLineId, address(borrowAsset), repayAmount);
    }

    // Borrower Repaying amount=Total Debt from Wallet should pass
    function test_creditLineRepay_totalDebt(uint128 _repayAmount) public {
        // Checking for variable values
        uint256 totalCurrentDebt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, totalCurrentDebt, borrowAsset.totalSupply());

        // Repay and related checks
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), repayAmount);
    }

    // Borrower Repaying amount=Interest from Wallet should pass
    function test_creditLineRepay_interest() public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);

        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), Interest);
    }

    // Borrower Repaying amount<Interest from Wallet should pass
    function test_creditLineRepay_amountLTInterest(uint128 _repayAmount) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, Interest);

        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), repayAmount);
    }

    // Two installment repayments, repayment completed in two installments

    // 1. Repaying amount<Interest should pass
    // 2. Repaying remaining amount should pass
    function test_creditLineRepay_twoInstallments_1(uint128 _repayAmount) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, 1, Interest);
        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), repayAmount);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        uint256 remainingRepayment = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), remainingRepayment);
    }

    // 1. Repaying amount=Interest should pass
    // 2. Repaying remaining amount should pass
    function test_creditLineRepay_twoInstallments_2() public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);

        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), Interest);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        uint256 remainingRepayment = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), remainingRepayment);
    }

    // 1. Repaying amount>Interest should pass
    // 2. Repaying remaining amount should pass
    function test_creditLineRepay_twoInstallments_3(uint128 _repayAmount) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repayAmount = scaleToRange256(_repayAmount, Interest.add(1), debt);
        // Repay and related checks
        assert_creditLineRepay_amountGTinterest(address(borrower), creditLineId, address(borrowAsset), repayAmount);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        uint256 remainingRepayment = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), remainingRepayment);
    }

    // Three installment repayments, incomplete repayment in three installments

    // 1. Repaying amount=Interest should pass
    // 2. Repaying amount=Interest should pass
    // 3. Repaying remaining amount should pass
    function test_creditLineRepay_threeInstallments_1() public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);

        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), Interest);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Checking for variable values
        uint256 interestToRepay = creditLine.calculateInterestAccrued(creditLineId);
        (, , uint256 interestRepaid, , ) = creditLine.creditLineVariables(creditLineId);
        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(
            address(borrower),
            creditLineId,
            address(borrowAsset),
            interestToRepay.sub(interestRepaid)
        );

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        uint256 remainingRepayment = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), remainingRepayment);
    }

    // 1. Repaying amount>Interest should pass
    // 2. Repaying amount>Interest should pass
    // 3. Repaying remaining amount should pass
    function test_creditLineRepay_threeInstallments_2(uint128 _repay1, uint128 _repay2) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repay1 = scaleToRange256(_repay1, Interest.add(1), debt);
        // Repay and related checks
        assert_creditLineRepay_amountGTinterest(address(borrower), creditLineId, address(borrowAsset), repay1);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Checking for variable values
        uint256 interestToRepay = creditLine.calculateInterestAccrued(creditLineId);
        (, , uint256 interestRepaid, , ) = creditLine.creditLineVariables(creditLineId);
        debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repay2 = scaleToRange256(_repay2, interestToRepay.sub(interestRepaid).add(1), debt);
        // Repay and related checks
        assert_creditLineRepay_amountGTinterest(address(borrower), creditLineId, address(borrowAsset), repay2);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        debt = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), debt);
    }

    // 1. Repaying amount<Interest should pass
    // 2. Repaying amount<Interest should pass
    // 3. Repaying remaining amount should pass
    function test_creditLineRepay_threeInstallments_3(uint128 _repay1, uint128 _repay2) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 repay1 = scaleToRange256(_repay1, 1, Interest);
        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), repay1);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Checking for variable values
        uint256 interestToRepay = creditLine.calculateInterestAccrued(creditLineId);
        (, , uint256 interestRepaid, , ) = creditLine.creditLineVariables(creditLineId);
        uint256 repay2 = scaleToRange256(_repay2, 1, interestToRepay.sub(interestRepaid));
        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), repay2);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        uint256 remainingRepayment = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), remainingRepayment);
    }

    // 1. Repaying amount>Interest should pass
    // 2. Repaying amount<Interest should pass
    // 3. Repaying remaining amount should pass
    function test_creditLineRepay_threeInstallments_4(uint128 _repay1, uint128 _repay2) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repay1 = scaleToRange256(_repay1, Interest.add(1), debt);

        // Repay and related checks
        assert_creditLineRepay_amountGTinterest(address(borrower), creditLineId, address(borrowAsset), repay1);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Checking for variable values
        uint256 interestToRepay = creditLine.calculateInterestAccrued(creditLineId);
        (, , uint256 interestRepaid, , ) = creditLine.creditLineVariables(creditLineId);
        if (interestToRepay.sub(interestRepaid) > 1) {
            uint256 repay2 = scaleToRange256(_repay2, 1, interestToRepay.sub(interestRepaid));
            // Repay and related checks
            assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), repay2);

            // Time travel by 10 days
            _increaseBlock(block.timestamp + 10 days);

            // Repay and related checks
            debt = creditLine.calculateCurrentDebt(creditLineId);
            assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), debt);
        }
    }

    // 1. Repaying amount<Interest should pass
    // 2. Repaying amount>Interest should pass
    // 3. Repaying remaining amount should pass
    function test_creditLineRepay_threeInstallments_5(uint128 _repay1, uint128 _repay2) public {
        // Checking for variable values
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        uint256 repay1 = scaleToRange256(_repay1, 1, Interest);
        // Repay and related checks
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), repay1);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Checking for variable values
        uint256 interestToRepay = creditLine.calculateInterestAccrued(creditLineId);
        (, , uint256 interestRepaid, , ) = creditLine.creditLineVariables(creditLineId);
        uint256 debt = creditLine.calculateCurrentDebt(creditLineId);
        uint256 repay2 = scaleToRange256(_repay2, interestToRepay.sub(interestRepaid).add(1), debt);
        // Repay and related checks
        assert_creditLineRepay_amountGTinterest(address(borrower), creditLineId, address(borrowAsset), repay2);

        // Time travel by 10 days
        _increaseBlock(block.timestamp + 10 days);

        // Repay and related checks
        debt = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), debt);
    }

    //----------------------- Credit line Repay, Assert helper -----------------------//

    function assert_creditLineRepay_FullDebt(
        address _user,
        uint256 _creditLineId,
        address _asset,
        uint256 _amount
    ) public {
        uint256 currentDebt = creditLine.calculateCurrentDebt(_creditLineId);

        if (_user == address(admin)) {
            // initialize the user
            CLAdmin user = CLAdmin(_user);

            // add balance to user
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
        } else {
            // initialize the user
            CLUser user = CLUser(_user);

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
        }

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

    function assert_creditLineRepay_amountGTinterest(
        address _user,
        uint256 _creditLineId,
        address _asset,
        uint256 _amount
    ) public {
        uint256 interest = creditLine.calculateInterestAccrued(_creditLineId);
        uint256 currentDebt = creditLine.calculateCurrentDebt(_creditLineId);

        if (_user == address(admin)) {
            // initialize the user
            CLAdmin user = CLAdmin(_user);

            // add balance to user
            user.setAllowance(address(creditLine), _asset, _amount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(_asset).balanceOf(_user);

            // repay the credit line
            user.repay(address(creditLine), _creditLineId, _amount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(_asset).balanceOf(_user);

            // assert: balance change for user should be equal to amount repaid
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            assertEq(balanceDiff, _amount);
        } else {
            // initialize the user
            CLUser user = CLUser(_user);

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
            assertEq(balanceDiff, _amount);
        }

        // checking the variable updates after repayment
        (
            ,
            uint256 principal,
            uint256 totalInterestRepaid,
            uint256 lastPrincipalUpdateTime,
            uint256 interestAccruedTillLastPrincipalUpdate
        ) = creditLine.creditLineVariables(_creditLineId);

        // all variables are updated, principal updated
        assertEq(principal, currentDebt.sub(_amount));
        assertEq(totalInterestRepaid, interest);
        assertEq(lastPrincipalUpdateTime, block.timestamp);
        assertEq(interestAccruedTillLastPrincipalUpdate, interest);
    }

    function assert_creditLineRepay_amountLTEinterest(
        address _user,
        uint256 _creditLineId,
        address _asset,
        uint256 _amount
    ) public {
        (
            ,
            uint256 principalBefore,
            uint256 interestRepaid,
            uint256 prinipalUpdateTime,
            uint256 interestTillLastPrincipalUpdate
        ) = creditLine.creditLineVariables(_creditLineId);

        if (_user == address(admin)) {
            // initialize the user
            CLAdmin user = CLAdmin(_user);

            // add balance to user
            user.setAllowance(creditLineAddress, _asset, _amount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(_asset).balanceOf(_user);

            // repay the credit line
            user.repay(creditLineAddress, _creditLineId, _amount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(_asset).balanceOf(_user);

            // assert: balance change for user should be equal to amount repaid
            assertEq(balanceBefore.sub(balanceAfter), _amount);
        } else {
            // initialize the user
            CLUser user = CLUser(_user);

            // add balance to user
            admin.transferToken(_asset, _user, _amount);
            user.setAllowance(creditLineAddress, _asset, _amount);

            // getting balance of the user before repayment
            uint256 balanceBefore = IERC20(_asset).balanceOf(_user);

            // repay the credit line
            user.repay(creditLineAddress, _creditLineId, _amount);

            // getting the balance after repayment
            uint256 balanceAfter = IERC20(_asset).balanceOf(_user);

            // assert: balance change for user should be equal to amount repaid
            assertEq(balanceBefore.sub(balanceAfter), _amount);
        }

        // checking the variable updates after repayment
        (
            ,
            uint256 principal,
            uint256 totalInterestRepaid,
            uint256 lastPrincipalUpdateTime,
            uint256 interestAccruedTillLastPrincipalUpdate
        ) = creditLine.creditLineVariables(_creditLineId);

        // only repaid interest is updated
        assertEq(principal, principalBefore);
        assertEq(totalInterestRepaid, interestRepaid.add(_amount));
        assertEq(lastPrincipalUpdateTime, prinipalUpdateTime);
        assertEq(interestAccruedTillLastPrincipalUpdate, interestTillLastPrincipalUpdate);
    }

    //----------------------- Credit line close, failing tests -----------------------//

    // Invalid actor should not be able to close creditline
    function test_CloseInvalidActor() public {
        // Checking for variable values
        uint256 toRepay = creditLine.calculateCurrentDebt(creditLineId);

        // Repay and related checks
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), toRepay);

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.close(address(creditLine), creditLineId) {
                    revert('REVERT: Admin cannot close credit line');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:C2');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (!(userList[i] == address(lender) || userList[i] == address(borrower))) {
                    try user.close(address(creditLine), creditLineId) {
                        revert('REVERT: Invalid actor cannot close credit line');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:C2');
                    }
                }
            }
        }
    }

    // Closing invalid creditline should fail (REQUESTED status)
    function test_CloseInvalidCreditLineStatus() public {
        uint256 RequestedCL = borrower.createRequest(address(creditLine), requestData);

        try lender.close(address(creditLine), RequestedCL) {
            revert('REVERT: Cannot close invalid creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C1');
        }
    }

    // Cannot close creditline when principal is not repaid
    function test_CloseInvalidPrincipalState() public {
        try borrower.close(address(creditLine), creditLineId) {
            revert('REVERT: Cannot close if principal is not repaid');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C3');
        }
    }

    //----------------------- Credit line close, passing tests -----------------------//

    // Borrower should be able to close creditline
    function test_creditLineClose_asBorrower() public {
        // Checking for variable values
        uint256 toRepay = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), toRepay);

        assert_creditLineClose(address(borrower), creditLineId);
    }

    // Lender should be able to close creditline
    function test_creditLineClose_asLender() public {
        // Checking for variable values
        uint256 toRepay = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), toRepay);

        assert_creditLineClose(address(lender), creditLineId);
    }

    // Borrower should be able to close credit line, with multiple repayments
    function test_Close_asBorrower_multipleRepayments() public {
        // 1st repayment
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), Interest.sub(10));

        // 2nd repayment
        uint256 toRepay = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), toRepay);

        assert_creditLineClose(address(borrower), creditLineId);
    }

    // Lender should be able to close credit line, with multiple repayments
    function test_Close_asLender_multipleRepayments() public {
        // 1st repayment
        uint256 Interest = creditLine.calculateInterestAccrued(creditLineId);
        assert_creditLineRepay_amountLTEinterest(address(borrower), creditLineId, address(borrowAsset), Interest.sub(10));

        // 2nd repayment
        uint256 toRepay = creditLine.calculateCurrentDebt(creditLineId);
        assert_creditLineRepay_FullDebt(address(borrower), creditLineId, address(borrowAsset), toRepay);

        assert_creditLineClose(address(lender), creditLineId);
    }

    // Borrower should be able to close credit line in active stage before borrowing
    function test_creditLineClose_activeStage_asBorrower() public {
        // Go to active stage
        uint256 newCreditLine = goToActiveStage();

        assert_creditLineClose(address(borrower), newCreditLine);
    }

    // Lender should be able to close credit line in active stage before borrowing
    function test_creditLineClose_activeStage_asLender() public {
        // Go to active stage
        uint256 newCreditLine = goToActiveStage();

        assert_creditLineClose(address(lender), newCreditLine);
    }

    //----------------------- Credit line close, passing tests -----------------------//

    function assert_creditLineClose(address _user, uint256 _creditLineId) public {
        CLUser user = CLUser(_user);

        uint256 withdrawable = creditLine.withdrawableCollateral(_creditLineId);

        uint256 borrowerBalance = collateralAsset.balanceOf(address(borrower));
        user.close(address(creditLine), _creditLineId);
        uint256 borrowerBalanceAfter = collateralAsset.balanceOf(address(borrower));

        uint256 borrowerBalanceDiff = borrowerBalanceAfter.sub(borrowerBalance);

        assertApproxEqAbs(borrowerBalanceDiff, withdrawable, 1);

        uint256 status = uint256(creditLine.getCreditLineStatus(_creditLineId));
        assertEq(status, 0); // Credit Line variable are deleted
    }
}
