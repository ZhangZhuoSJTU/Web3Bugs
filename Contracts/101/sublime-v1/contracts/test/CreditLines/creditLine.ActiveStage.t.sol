pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../SavingsAccount/SavingsAccount.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_ActiveStageTests is CLParent {
    using SafeMath for uint256;

    uint256 creditLineId;
    uint256 protocolFee;
    uint256 constant SCALING_FACTOR = 1e18;
    address borrowAssetStrategy;
    address collateralStrategy;

    CreditLine creditLine;
    SavingsAccount savingsAccount;
    PriceOracle priceOracle;

    address[] public userList;

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
        requestData.collateralRatio = (350 * CLConstants.maxCollteralRatio) / 1e11;
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

        // Adding addresses to array
        userList.push(address(admin));
        userList.push(address(borrower));
        userList.push(address(lender));
        userList.push(address(liquidator));
    }

    //----------------------- ACTIVE stage, failing tests -----------------------//

    // Cannot accept credit line in ACTIVE stage
    function test_active_accept() public {
        try lender.acceptRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot accpet ACTIVE credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:A1');
        }
    }

    //----------------------- Credit line Deposit, failing tests -----------------------//

    // Depositing zero collateral amount should fail
    function test_DepositZeroCollateralAmount() public {
        uint256 amountZero = 0;
        try borrower.addCollateral(address(creditLine), creditLineId, amountZero, false) {
            revert('REVERT: Cannot deposit zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC1');
        }
    }

    // Depositing collateral for invalid (REQUESTED) creditline should fail
    function test_DepositInvalidCreditLine() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        uint256 newCreditLine = borrower.createRequest(address(creditLine), requestData);

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        try borrower.addCollateral(address(creditLine), newCreditLine, amount, false) {
            revert('REVERT: Cannot deposit to invalid (REQUESTED) Creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }
    }

    // Creditline lender should not be able to deposit collateral
    function test_LenderCannotDepositCollateral() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(lender), amount);
        lender.setAllowance(address(creditLine), address(collateralAsset), amount);

        try lender.addCollateral(address(creditLine), creditLineId, amount, false) {
            revert('REVERT: Invalid Actor cannot deposit');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC3');
        }
    }

    // Depositing collateral amount more than available balance should fail
    function test_CollateralDepositCannotExceedBalance() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        // Adding collateral more than the balance amount
        try borrower.addCollateral(address(creditLine), creditLineId, amount + 1, false) {
            revert('REVERT: Insufficient amount');
        } catch Error(string memory reason) {
            if (!isForked) {
                assertEq(reason, 'ERC20: transfer amount exceeds balance');
            } else {
                assertEq(reason, 'SafeERC20: low-level call failed');
            }
        }
    }

    //----------------------- Credit line Deposit, passing tests -----------------------//

    // Depositing collateral into creditline should pass with correct parameters
    function test_creditLineDeposit_fromWallet(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        assert_creditLineDeposit(creditLineId, address(borrower), amount, false);
    }

    // Depositing collateral into creditline should pass with correct parameters
    function test_creditLineDeposit_fromSavingsAccount(uint128 _amount) public {
        uint256 amount = scaleToRange256(_amount, 1, collateralAsset.totalSupply() / 100);
        uint256 liquidityShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        // Adding tokens to borrower and setting allowance for creditline contract
        savingsAccount_depositHelper(address(borrower), address(collateralAsset), collateralStrategy, liquidityShares);

        assert_creditLineDeposit(creditLineId, address(borrower), amount, true);
    }

    // Any user (except lender) should be able to deposit collateral from wallet
    function test_DepositByRandomUser_fromWallet() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                // Setting allowance for creditline contract
                user.setAllowance(address(creditLine), address(collateralAsset), amount);

                assert_creditLineDeposit(creditLineId, address(user), amount, false);
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(lender)) {
                    // Adding tokens to user and setting allowance for credit line
                    admin.transferToken(address(collateralAsset), address(user), amount);
                    user.setAllowance(address(creditLine), address(collateralAsset), amount);

                    assert_creditLineDeposit(creditLineId, address(user), amount, false);
                }
            }
        }
    }

    // Any user (except lender) should be able to deposit collateral from savings Account
    function test_DepositByRandomUser_fromSavingsAccount() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        uint256 liquidityShares = IYield(collateralStrategy).getSharesForTokens(amount, address(collateralAsset));

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                // set token allowance
                user.setAllowance(savingsAccountAddress, address(collateralAsset), liquidityShares);
                user.setAllowance(collateralStrategy, address(collateralAsset), liquidityShares);

                // set savings account allowance
                user.setAllowanceForSavingsAccount(savingsAccountAddress, address(collateralAsset), creditLineAddress, liquidityShares);

                // deposit into savings account
                user.savingsAccountDeposit(
                    savingsAccountAddress,
                    address(collateralAsset),
                    collateralStrategy,
                    address(user),
                    liquidityShares
                );

                assert_creditLineDeposit(creditLineId, address(user), amount, true);
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(lender)) {
                    // Adding tokens to borrower and setting allowance for creditline contract
                    savingsAccount_depositHelper(address(user), address(collateralAsset), collateralStrategy, liquidityShares);

                    assert_creditLineDeposit(creditLineId, address(user), amount, true);
                }
            }
        }
    }

    //----------------------- Credit line Deposit, Assert helper -----------------------//

    function assert_creditLineDeposit(
        uint256 _creditLineId,
        address _user,
        uint256 _amount,
        bool _fromSavingsAccount
    ) public {
        // Checking collateral balance of credit line before deposit
        uint256 sharesBefore = creditLine.collateralShareInStrategy(_creditLineId);

        if (_user == address(admin)) {
            CLAdmin user = CLAdmin(_user);

            // Depositing collateral into credit line
            user.addCollateral(address(creditLine), _creditLineId, _amount, _fromSavingsAccount);
        } else {
            CLUser user = CLUser(_user);

            // Depositing collateral into credit line
            user.addCollateral(address(creditLine), _creditLineId, _amount, _fromSavingsAccount);
        }

        // assert the received shares and deposited amount equivalent shares are equal
        uint256 sharesReceived = creditLine.collateralShareInStrategy(_creditLineId);
        uint256 sharesOfAmount = IYield(collateralStrategy).getSharesForTokens(_amount, address(collateralAsset));

        assertEq(sharesReceived.sub(sharesBefore), sharesOfAmount);
    }

    //----------------------- Credit line Borrow, failing tests -----------------------//

    // Borrowing more than borrowable (limit) amount should fail
    function test_BorrowExcessAmount() public {
        uint256 amount = 10_000 * 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable + 1);

        try borrower.borrow(address(creditLine), creditLineId, borrowable + 1) {
            revert('REVERT: Cannot borrow if collateral ratio is disturbed');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:B2');
        }
    }

    // Borrowing from creditline with amount more than lender balance should fail
    // Borrowable amount > lender balance of borrow tokens
    function test_BorrowExceedsLenderBalance() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding less tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable - 1);

        try borrower.borrow(address(creditLine), creditLineId, borrowable) {
            revert('REVERT: Insufficient balance');
        } catch Error(string memory reason) {
            assertEq(reason, 'SA:ISA1');
        }
    }

    // Borrowing from creditline by invalid actor (not borrower) should fail
    function test_BorrowInvalidBorrower() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable.add(100));

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.borrow(address(creditLine), creditLineId, borrowable) {
                    revert('REVERT: Invalid actor cannot borrow');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:OCLB1');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(borrower)) {
                    try user.borrow(address(creditLine), creditLineId, borrowable) {
                        revert('REVERT: Invalid actor cannot borrow');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:OCLB1');
                    }
                }
            }
        }
    }

    // Borrowing from invalid creditline (REQUESTED stage) should fail
    function test_BorrowInvalidCreditline() public {
        uint256 RequestedCL = borrower.createRequest(address(creditLine), requestData);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, 1e20);

        try borrower.borrow(address(creditLine), RequestedCL, 1e20) {
            revert('REVERT: Cannot borrow from invalid creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CBA1');
        }
    }

    //----------------------- Credit line Borrow, passing tests -----------------------//

    // Borrower should be able to borrow from credit line
    // Adding enough collateral to borrow amount = borrow limit
    function test_creditLineBorrow_borrowLimit(uint256 _borrowAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );

        uint256 maxBorrowAmount = requestData.borrowLimit;
        uint256 collateralAmount = requestData.collateralRatio.mul(maxBorrowAmount).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e9); // 0.000000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, maxBorrowAmount.sub(maxBorrowAmount.mul(1e10).div(1e18))); // based on precision difference

        // Adding required tokens to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(borrowAmount, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);
    }

    // Borrower should be able to borrow from credit line
    // Adding only enough collateral to borrow the amount = borrow limit / 2
    function test_creditLineBorrow_halfOfBorrowLimit(uint256 _borrowAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );

        uint256 maxBorrowAmount = requestData.borrowLimit / 2;
        uint256 collateralAmount = requestData.collateralRatio.mul(maxBorrowAmount).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e9); // 0.000000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, maxBorrowAmount.sub(maxBorrowAmount.mul(1e10).div(1e18))); // based on precision difference

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(borrowAmount, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);
    }

    // Borrower should be able to borrow from credit line
    // Adding minimum collateral amount (1 unit)
    function test_creditLineBorrow_minCollateral(uint256 _borrowAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 collateralAmount = 1 * 10**ERC20(address(collateralAsset)).decimals(); // 1 unit of collateral token
        uint256 maxBorrowAmount = _ratioOfPrices.mul(collateralAmount).div(requestData.collateralRatio).mul(SCALING_FACTOR).div(
            10**_decimals
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e10); // 0.00000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, maxBorrowAmount.sub(maxBorrowAmount.mul(1e11).div(1e18))); // based on precision difference

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);
        uint256 borrowShares = IYield(borrowAssetStrategy).getSharesForTokens(borrowAmount, address(borrowAsset));
        assert_creditLineBorrow(creditLineId, borrowShares);
    }

    //----------------------- Credit line Borrow , Assert helper -----------------------//

    function assert_creditLineBorrow(uint256 _creditLineId, uint256 _borrowShares) public {
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

    //----------------------- Credit line withdraw collateral , failing tests -----------------------//

    // Should not be able to withdraw zero collateral from creditline
    function test_WithdrawCollateralZeroAmount() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        try borrower.withdrawCollateral(address(creditLine), creditLineId, 0, false) {
            revert('REVERT: Cannot withdraw zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC1');
        }
    }

    // Invalid Actor should not be able to withdraw collateral from creditline
    function test_WithdrawCollateralInvalidActor() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        uint256 withdrawAmount = creditLine.withdrawableCollateral(creditLineId);

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.withdrawCollateral(address(creditLine), creditLineId, withdrawAmount, false) {
                    revert('REVERT: Invalid actor cannot withdraw');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:OCLB1');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(borrower)) {
                    try user.withdrawCollateral(address(creditLine), creditLineId, withdrawAmount, false) {
                        revert('REVERT: Invalid actor cannot withdraw');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:OCLB1');
                    }
                }
            }
        }
    }

    // withdrawing collateral more than the limit should fail
    function test_WithdrawCollateralInvalidAmount() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        uint256 withdrawAmount = creditLine.withdrawableCollateral(creditLineId);

        try borrower.withdrawCollateral(address(creditLine), creditLineId, withdrawAmount + 1, false) {
            revert('REVERT: Cannot withdraw excess amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC3');
        }
    }

    //----------------------- Credit line withdraw collateral , passing tests -----------------------//

    // borrower should be able to withdraw extra collateral from wallet
    // Adding only enough collateral to borrow amount = borrow limit and borrowing some amount
    function test_creditLineWithdrawCollateral_toWallet(uint256 _borrowAmount, uint256 _withdrawAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );

        uint256 maxBorrowAmount = requestData.borrowLimit;
        uint256 collateralAmount = requestData.collateralRatio.mul(maxBorrowAmount).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e9); // 0.000000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding required tokens to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);

        // checking withdrawable amount
        uint256 withdrawable = creditLine.withdrawableCollateral(creditLineId);

        (_ratioOfPrices, _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(address(collateralAsset), address(borrowAsset));
        uint256 borrowDiff = maxBorrowAmount.sub(borrowAmount);
        uint256 collateralEquivalentDiff = requestData.collateralRatio.mul(borrowDiff).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // emit log_named_uint('withdrawable',withdrawable);
        // emit log_named_uint('collateralEquivalentDiff',collateralEquivalentDiff);
        assertApproxEqAbs(withdrawable, collateralEquivalentDiff, 1);

        uint256 WithdrawAmount = scaleToRange256(_withdrawAmount, 1, withdrawable);
        assert_creditLineWithdrawCollateral(creditLineId, WithdrawAmount, false);
    }

    // Withdrawing collateral from creditline to savings account should pass
    // Adding only enough collateral to borrow amount = borrow limit and borrowing some amount
    function test_creditLineWithdrawCollateral_toSavingsAccount(uint128 _borrowAmount, uint128 _withdrawAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );

        uint256 maxBorrowAmount = requestData.borrowLimit;
        uint256 collateralAmount = requestData.collateralRatio.mul(maxBorrowAmount).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e9); // 0.000000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding required tokens to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);

        // checking withdrawable amount
        uint256 withdrawable = creditLine.withdrawableCollateral(creditLineId);

        (_ratioOfPrices, _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(address(collateralAsset), address(borrowAsset));
        uint256 borrowDiff = maxBorrowAmount.sub(borrowAmount);
        uint256 collateralEquivalentDiff = requestData.collateralRatio.mul(borrowDiff).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // emit log_named_uint('withdrawable',withdrawable);
        // emit log_named_uint('collateralEquivalentDiff',collateralEquivalentDiff);
        assertApproxEqAbs(withdrawable, collateralEquivalentDiff, 1);
        uint256 WithdrawAmount = scaleToRange256(_withdrawAmount, 1, withdrawable);

        admin.transferToken(address(collateralAsset), address(borrower), WithdrawAmount);
        borrower.setAllowance(savingsAccountAddress, address(collateralAsset), WithdrawAmount);
        borrower.setAllowance(collateralStrategy, address(collateralAsset), WithdrawAmount);

        borrower.setAllowanceForSavingsAccount(savingsAccountAddress, address(collateralAsset), address(creditLine), WithdrawAmount);

        assert_creditLineWithdrawCollateral(creditLineId, WithdrawAmount, true);
    }

    //----------------------- Credit line withdraw collateral, Assert helper -----------------------//

    function assert_creditLineWithdrawCollateral(
        uint256 _creditLineId,
        uint256 _withdrawAmount,
        bool _toSavingsAccount
    ) public {
        uint256 balanceBorrower = 0;
        uint256 balanceBorrowerAfter = 0;

        if (_toSavingsAccount) {
            balanceBorrower = savingsAccount.balanceInShares(address(borrower), address(collateralAsset), collateralStrategy);
            try borrower.withdrawCollateral(address(creditLine), _creditLineId, _withdrawAmount, _toSavingsAccount) {
                balanceBorrowerAfter = savingsAccount.balanceInShares(address(borrower), address(collateralAsset), collateralStrategy);
                uint256 withdrawShares = IYield(collateralStrategy).getSharesForTokens(_withdrawAmount, address(collateralAsset));
                assertApproxEqAbs(withdrawShares, balanceBorrowerAfter.sub(balanceBorrower), 1);
            } catch Error(string memory reason) {
                assertEq(reason, 'CL:WC1');
            }
        } else {
            balanceBorrower = collateralAsset.balanceOf(address(borrower));
            try borrower.withdrawCollateral(address(creditLine), _creditLineId, _withdrawAmount, _toSavingsAccount) {
                balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));
                assertApproxEqAbs(_withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower), 1);
            } catch Error(string memory reason) {
                assertEq(reason, 'CL:WC1');
            }
        }
    }

    //----------------------- Credit line withdraw ALL collateral , failing tests -----------------------//

    // Invalid Actor should not be able to withdraw collateral from creditline
    function test_WithdrawAllCollateralInvalidActor() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.withdrawAllCollateral(address(creditLine), creditLineId, false) {
                    revert('REVERT: Invalid actor cannot withdraw');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:OCLB1');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(borrower)) {
                    try user.withdrawAllCollateral(address(creditLine), creditLineId, false) {
                        revert('REVERT: Invalid actor cannot withdraw');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:OCLB1');
                    }
                }
            }
        }
    }

    //----------------------- Credit line withdraw ALL collateral , passing tests -----------------------//

    // Withdrawing collateral from creditline to wallet should pass
    // Adding only enough collateral to borrow amount = borrow limit
    function test_creditLineWithdrawAllCollateral_toWallet(uint256 _borrowAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );

        uint256 maxBorrowAmount = requestData.borrowLimit;
        uint256 collateralAmount = requestData.collateralRatio.mul(maxBorrowAmount).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e9); // 0.000000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding required tokens to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);

        assert_creditLineWithdrawAllCollateral(creditLineId, false);
    }

    // Withdrawing collateral from creditline to savings account should pass
    function test_creditLineWithdrawAllCollateral_toSavingsAccount(uint256 _borrowAmount) public {
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );

        uint256 maxBorrowAmount = requestData.borrowLimit;
        uint256 collateralAmount = requestData.collateralRatio.mul(maxBorrowAmount).div(_ratioOfPrices).mul(10**_decimals).div(
            SCALING_FACTOR
        );

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), collateralAmount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), collateralAmount);

        borrower.addCollateral(address(creditLine), creditLineId, collateralAmount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);
        assertApproxEqRel(borrowable, maxBorrowAmount, 1e9); // 0.000000001 difference

        uint256 borrowAmount = scaleToRange256(_borrowAmount, 1, borrowable);

        // Adding required tokens to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowAmount);

        borrower.borrow(address(creditLine), creditLineId, borrowAmount);

        uint256 withdrawAmount = creditLine.withdrawableCollateral(creditLineId);

        admin.transferToken(address(collateralAsset), address(borrower), withdrawAmount);
        borrower.setAllowance(savingsAccountAddress, address(collateralAsset), withdrawAmount);
        borrower.setAllowance(collateralStrategy, address(collateralAsset), withdrawAmount);

        borrower.setAllowanceForSavingsAccount(savingsAccountAddress, address(collateralAsset), address(creditLine), withdrawAmount);

        assert_creditLineWithdrawAllCollateral(creditLineId, true);
    }

    //----------------------- Credit line withdraw ALL collateral, Assert helper -----------------------//

    function assert_creditLineWithdrawAllCollateral(uint256 _creditLineId, bool _toSavingsAccount) public {
        uint256 balanceBorrower = 0;
        uint256 balanceBorrowerAfter = 0;
        uint256 withdrawAmount = creditLine.withdrawableCollateral(creditLineId);

        if (_toSavingsAccount) {
            balanceBorrower = savingsAccount.balanceInShares(address(borrower), address(collateralAsset), collateralStrategy);
            try borrower.withdrawAllCollateral(address(creditLine), _creditLineId, _toSavingsAccount) {
                balanceBorrowerAfter = savingsAccount.balanceInShares(address(borrower), address(collateralAsset), collateralStrategy);
                uint256 withdrawShares = IYield(collateralStrategy).getSharesForTokens(withdrawAmount, address(collateralAsset));
                assertApproxEqAbs(withdrawShares, balanceBorrowerAfter.sub(balanceBorrower), 1);
            } catch Error(string memory reason) {
                assertEq(reason, 'CL:WC1');
            }
        } else {
            balanceBorrower = collateralAsset.balanceOf(address(borrower));
            try borrower.withdrawAllCollateral(address(creditLine), _creditLineId, _toSavingsAccount) {
                balanceBorrowerAfter = collateralAsset.balanceOf(address(borrower));
                assertApproxEqAbs(withdrawAmount, balanceBorrowerAfter.sub(balanceBorrower), 1);
            } catch Error(string memory reason) {
                assertEq(reason, 'CL:WC1');
            }
        }
    }

    //----------------------- Credit line liquidate, failing tests -----------------------//

    // liqidate function should fail if the prinipal is zero
    function test_LiquidateZeroPrincipal() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        try lender.liquidate(address(creditLine), creditLineId, false) {
            revert('REVERT: Cannot liquidate if principal = 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L2');
        }
    }

    // Liquidating a credit line should fail, if the liquidator does not have enough token balance
    function test_creditLineLiquidate_LessLiquidatorBalance() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();
        requestData.autoLiquidation = true;

        // Requesting a creditline
        uint256 newCreditLine = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.mul(2).div(30000));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.mul(2).div(30000));

        borrower.addCollateral(address(creditLine), newCreditLine, amount.mul(2).div(30000), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(newCreditLine);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), newCreditLine, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }

        uint256 tokensToLiquidate = creditLine.borrowTokensToLiquidate(newCreditLine);

        admin.transferToken(address(borrowAsset), address(liquidator), tokensToLiquidate.sub(1));
        liquidator.setAllowance(address(creditLine), address(borrowAsset), tokensToLiquidate.sub(1));

        try liquidator.liquidate(address(creditLine), newCreditLine, false) {
            revert('REVERT: Balance too low');
        } catch Error(string memory reason) {
            if (isForked) {
                assertEq(reason, 'Dai/insufficient-balance');
            } else {
                assertEq(reason, 'ERC20: transfer amount exceeds balance');
            }
        }
    }

    // CreditLine cannot be liquidated if the collateral ratio is higher than ideal value
    function test_LiquidateInvalidCollateralRatio() public {
        uint256 amount = 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount);

        borrower.addCollateral(address(creditLine), creditLineId, amount, false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        try lender.liquidate(address(creditLine), creditLineId, false) {
            revert('REVERT: Cannot liquidate if collateral ratio > min collateral ratio');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L3');
        }
    }

    // Credit line cannot be liquidated if it is not in ACTIVE stage
    function test_LiquidateInvalidCreditLine() public {
        // Request a credit line
        uint256 newCreditLineId = borrower.createRequest(address(creditLine), requestData);

        try lender.liquidate(address(creditLine), newCreditLineId, false) {
            revert('REVERT: Cannot liquidate invalid creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }
    }

    // Invalid actor (except lender) should not be able to liquidate credit line
    // autoLiquidate = false, Only lender can liquidates
    function test_LiquidateInvalidActor() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.div(5));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.div(5));

        borrower.addCollateral(address(creditLine), creditLineId, amount.div(5), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.liquidate(address(creditLine), creditLineId, false) {
                    revert('REVERT: Invalid actor cannot liquidate');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:L4');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(lender)) {
                    try user.liquidate(address(creditLine), creditLineId, false) {
                        revert('REVERT: Invalid actor cannot liquidate');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:L4');
                    }
                }
            }
        }
    }

    //----------------------- Credit line liquidate, passing tests -----------------------//

    // Liquidating a credit line should pass (from lender's wallet)
    // autoLiquidate = false, lender liquidates
    function test_creditLineLiquidate_fromWallet() public {
        uint256 amount = 10 * 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.mul(2).div(5));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.mul(2).div(5));

        borrower.addCollateral(address(creditLine), creditLineId, amount.mul(2).div(5), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }
        assert_creditLineLiquidate(address(lender), creditLineId, false);
    }

    // Liquidating a credit line should pass (from lender's savings account)
    // autoLiquidate = false, lender liquidates
    function test_creditLineLiquidate_fromSavingsAccount() public {
        uint256 amount = 100 * 10**ERC20(address(collateralAsset)).decimals();
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.mul(5).div(100));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.mul(5).div(100));

        borrower.addCollateral(address(creditLine), creditLineId, amount.mul(5).div(100), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }
        assert_creditLineLiquidate(address(lender), creditLineId, true);
    }

    // Liquidating a credit line should pass (from lender's wallet)
    // autoLiquidate = true, lender liquidates
    function test_LiquidateTrue_byLender() public {
        uint256 amount = 1 * 10**ERC20(address(collateralAsset)).decimals();
        requestData.autoLiquidation = true;

        // Requesting a creditline
        uint256 newCreditLine = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.mul(3).div(5));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.mul(3).div(5));

        borrower.addCollateral(address(creditLine), newCreditLine, amount.mul(3).div(5), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(newCreditLine);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), newCreditLine, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }
        assert_creditLineLiquidate(address(lender), newCreditLine, false);
    }

    // Liquidating a credit line should pass (from liquidator's wallet)
    // autoLiquidate = true, liquidator liquidates
    function test_LiquidateTrue_byLiquidator() public {
        uint256 amount = 10 * 10**ERC20(address(collateralAsset)).decimals();
        requestData.autoLiquidation = true;

        // Requesting a creditline
        uint256 newCreditLine = goToActiveStage();

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.mul(95).div(100));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.mul(95).div(100));

        borrower.addCollateral(address(creditLine), newCreditLine, amount.mul(95).div(100), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(newCreditLine);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), newCreditLine, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }
        assert_creditLineLiquidate(address(liquidator), newCreditLine, false);
    }

    //----------------------- Credit line liquidate, Assert helper -----------------------//

    function assert_creditLineLiquidate(
        address _user,
        uint256 _creditLineId,
        bool _fromSavingsAccount
    ) public {
        uint256 tokensToLiquidate = creditLine.borrowTokensToLiquidate(_creditLineId);
        uint256 totalCollateralTokens = creditLine.calculateTotalCollateralTokens(_creditLineId);
        uint256 currentBalance;
        uint256 balanceAfter;
        uint256 balanceDiff;

        uint256 currentDebt = creditLine.calculateCurrentDebt(_creditLineId);
        (uint256 _ratioOfPrices, uint256 _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 collateralToLiquidate = currentDebt.mul(10**_decimals).div(_ratioOfPrices);
        if (collateralToLiquidate > totalCollateralTokens) {
            collateralToLiquidate = totalCollateralTokens;
        }

        CLUser user = CLUser(_user);

        admin.transferToken(address(borrowAsset), address(user), tokensToLiquidate);
        user.setAllowance(address(creditLine), address(borrowAsset), tokensToLiquidate);

        if (_fromSavingsAccount) {
            currentBalance = savingsAccount.balanceInShares(address(user), address(collateralAsset), collateralStrategy);
            user.liquidate(address(creditLine), _creditLineId, _fromSavingsAccount);
            balanceAfter = savingsAccount.balanceInShares(address(user), address(collateralAsset), collateralStrategy);
            balanceDiff = balanceAfter.sub(currentBalance);
            uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(collateralToLiquidate, address(collateralAsset));
            assertApproxEqAbs(balanceDiff, collateralShares, 1);
        } else {
            currentBalance = collateralAsset.balanceOf(address(user));
            user.liquidate(address(creditLine), _creditLineId, _fromSavingsAccount);
            balanceAfter = collateralAsset.balanceOf(address(user));
            balanceDiff = balanceAfter.sub(currentBalance);
            assertApproxEqAbs(balanceDiff, collateralToLiquidate, 1);
        }

        uint256 status = uint256(creditLine.getCreditLineStatus(_creditLineId));
        assertEq(status, 0); // Credit line variables are deleted
    }

    function setCurrentCollRatio() public {
        vm.mockCall(
            priceOracleAddress,
            abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(collateralAsset), address(borrowAsset)),
            abi.encode(1000000, 8) // price, decimals
        );
    }
}
