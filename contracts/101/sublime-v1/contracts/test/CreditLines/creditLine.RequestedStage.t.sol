pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_RequestedStageTests is CLParent {
    using SafeMath for uint256;

    CreditLine cl;
    PriceOracle priceOracle;

    address[] public userList;

    function setUp() public virtual {
        CLSetUp();

        cl = CreditLine(creditLineAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = CLConstants.maxCollteralRatio;
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
    }

    //----------------------- REQUESTED stage, failing tests -----------------------//

    // Cannot deposit collateral to credit line in REQUESTED stage
    function test_requested_depositCollateral() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // _fromSavingsAccount = true
        savingsAccount_depositHelper(address(borrower), address(collateralAsset), requestData.collateralStrategy, amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot add collateral to requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }

        // _fromSavingsAccount = false
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot add collateral to requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }
    }

    // Cannot withdraw collateral from credit line in REQUESTED stage
    function test_requested_withdrawCollateral() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // withdraw collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot withdraw collateral from requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC2');
        }

        // _toSavingsAccount = false
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot withdraw collateral from requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WC2');
        }
    }

    // Cannot withdraw all collateral from credit line in REQUESTED stage
    function test_requested_withdrawAllCollateral() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // withdraw all collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot withdraw collateral from requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WAC1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot withdraw collateral from requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:WAC1');
        }
    }

    // Cannot borrow from credit line in REQUESTED stage
    function test_requested_borrow() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        uint256 amount = 1_000 * ERC20(address(borrowAsset)).decimals();

        // borrow from the credit line
        try borrower.borrow(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot borrow from requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CBA1');
        }
    }

    // Cannot repay from credit line in REQUESTED stage
    function test_requested_repay() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        uint256 amount = 1_000 * ERC20(address(borrowAsset)).decimals();

        // repay the credit line
        try borrower.repay(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot repay requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP2');
        }
    }

    // Cannot liquidate credit line in REQUESTED stage
    function test_requested_liquidate() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // liquidate the credit line

        // _toSavingsAccount = true
        try lender.liquidate(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot liquidate requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }

        // _toSavingsAccount = false
        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot liquidate requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }
    }

    // Cannot close credit line in REQUESTED stage
    function test_requested_close() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        try borrower.close(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot close requested credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C1');
        }
    }

    //----------------------- Credit line Request, failing tests -----------------------//

    // Requesting creditline with collateral ratio above limits should fail
    function test_RequestInvalidCollateralRatio() public {
        requestData.collateralRatio = CLConstants.maxCollteralRatio + 1;

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request for invalid collateral ratio limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R5');
        }
    }

    // Requesting creditline with borrow limit outside of limits should fail
    function test_RequestInvalidBorrowLimit() public {
        requestData.borrowLimit = 1;

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request for invalid borrow limit limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Requesting creditline with borrow rate above limits should fail
    function test_RequestInvalidBorrowRate() public {
        requestData.borrowRate = CLConstants.maxBorrowRate + 1;

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request for invalid borrow rate limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R4');
        }
    }

    // Requesting creditline as borrower with same Lender and Borrower address should fail
    function test_RequestAsBorrower_sameAddresses() public {
        requestData.requestTo = address(borrower);

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when borrower == lender');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R8');
        }
    }

    // Requesting creditline as lender with same Lender and Borrower address should fail
    function test_RequestAsLender_sameAddresses() public {
        requestData.requestAsLender = true;

        try lender.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when borrower == lender');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R8');
        }
    }

    // Requesting creditline with lender as address(0) should fail
    function test_RequestZeroAddressLender() public {
        requestData.requestTo = address(0);

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when lender == address(0)');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R2');
        }
    }

    // Requesting creditline with borrower as address(0) should fail
    function test_RequestZeroAddressBorrower() public {
        requestData.requestTo = address(0);
        requestData.requestAsLender = true;

        try lender.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when borrower == address(0)');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R2');
        }
    }

    // Requesting creditline with borrow asset strategy as address(0) should fail
    function test_RequestZeroBorrowAssetStrategy() public {
        requestData.borrowAssetStrategy = address(0);

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when borrow asset strategy == address(0)');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R6');
        }
    }

    // Requesting creditline with collateral strategy as address(0) should fail
    function test_RequestZeroCollateralStrategy() public {
        requestData.collateralStrategy = address(0);

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when collateral strategy == address(0)');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R7');
        }
    }

    // Requesting creditline with invalid tokens (not supported) should fail
    function test_RequestInvalidTokens() public {
        requestData.collateralAsset = CLConstants.BAT;

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request for invalid tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R3');
        }
    }

    // Requesting creditline with same borrow and collateral tokens should fail
    function test_RequestSameTokens() public {
        requestData.collateralAsset = requestData.borrowAsset;

        try borrower.createRequest(address(cl), requestData) {
            revert('REVERT: Cannot request when borrow asset == collateral asset');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:R1');
        }
    }

    //----------------------- Credit line Request, passing tests -----------------------//

    // Requesting creditline as borrower should pass
    function test_RequestAsBorrower_FuzzWithLimits(
        address _requestTo,
        uint128 _borrowLimit,
        uint128 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio
    ) public {
        requestData.requestTo = _requestTo;
        requestData.borrowLimit = _borrowLimit;
        requestData.borrowRate = _borrowRate;
        requestData.autoLiquidation = _autoLiquidation;
        requestData.collateralRatio = _collateralRatio;

        try borrower.createRequest(address(cl), requestData) {
            assert_creditlineConstantsAndStatus(1, address(borrower), requestData);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:R2')) {
                log_string('Lender is address(0)');
            } else if (compareStrings(reason, 'CL:ILB1')) {
                log_string('Invalid Borrow limits in terms of USD');
            } else if (compareStrings(reason, 'CL:R4')) {
                log_string('Invalid borrow rate limits');
            } else if (compareStrings(reason, 'CL:R5')) {
                log_string('Invalid collateral ratio limits');
            } else {
                revert(reason);
            }
        }
    }

    // Requesting creditline as lender should pass
    function test_RequestAsLender_FuzzWithLimits(
        address _requestTo,
        uint128 _borrowLimit,
        uint128 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio
    ) public {
        requestData.requestTo = _requestTo;
        requestData.borrowLimit = _borrowLimit;
        requestData.borrowRate = _borrowRate;
        requestData.autoLiquidation = _autoLiquidation;
        requestData.collateralRatio = _collateralRatio;
        requestData.requestAsLender = true;

        try lender.createRequest(address(cl), requestData) {
            assert_creditlineConstantsAndStatus(1, address(lender), requestData);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:R2')) {
                log_string('Borrower is address(0)');
            } else if (compareStrings(reason, 'CL:ILB1')) {
                log_string('Invalid Borrow limits in terms of USD');
            } else if (compareStrings(reason, 'CL:R4')) {
                log_string('Invalid borrow rate limits');
            } else if (compareStrings(reason, 'CL:R5')) {
                log_string('Invalid collateral ratio limits');
            } else {
                revert(reason);
            }
        }
    }

    // Requesting creditline as borrower should pass
    function test_RequestAsBorrower_FuzzNoLimits(
        address _requestTo,
        uint128 _borrowLimit,
        uint128 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio
    ) public {
        admin.updateBorrowLimitLimits(0, type(uint256).max, address(cl));
        admin.updateIdealCollateralRatioLimits(0, type(uint256).max, address(cl));
        admin.updateBorrowRateLimits(0, type(uint256).max, address(cl));

        requestData.requestTo = _requestTo;
        requestData.borrowLimit = _borrowLimit;
        requestData.borrowRate = _borrowRate;
        requestData.autoLiquidation = _autoLiquidation;
        requestData.collateralRatio = _collateralRatio;

        try borrower.createRequest(address(cl), requestData) {
            assert_creditlineConstantsAndStatus(1, address(borrower), requestData);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:R2')) {
                log_string('Lender is address(0)');
            } else if (compareStrings(reason, 'CL:R8')) {
                log_string('Borrower == Lender');
            } else {
                revert(reason);
            }
        }
    }

    // Requesting creditline as lender should pass
    function test_RequestAsLender_FuzzNoLimits(
        address _requestTo,
        uint128 _borrowLimit,
        uint128 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio
    ) public {
        admin.updateBorrowLimitLimits(0, type(uint256).max, address(cl));
        admin.updateIdealCollateralRatioLimits(0, type(uint256).max, address(cl));
        admin.updateBorrowRateLimits(0, type(uint256).max, address(cl));

        requestData.requestTo = _requestTo;
        requestData.borrowLimit = _borrowLimit;
        requestData.borrowRate = _borrowRate;
        requestData.autoLiquidation = _autoLiquidation;
        requestData.collateralRatio = _collateralRatio;
        requestData.requestAsLender = true;

        try lender.createRequest(address(cl), requestData) {
            assert_creditlineConstantsAndStatus(1, address(lender), requestData);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:R2')) {
                log_string('Borrower is address(0)');
            } else if (compareStrings(reason, 'CL:R8')) {
                log_string('Borrower == Lender');
            } else {
                revert(reason);
            }
        }
    }

    //----------------------- Credit line Accept, failing tests -----------------------//

    // Accepting creditline with invalid actor (NOT Lender) should fail
    function test_AcceptInvalidAcceptor_RequestedAsBorrower() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.acceptRequest(address(cl), creditLineId) {
                    revert('REVERT: Invalid actor cannot accept');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:A2');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != requestData.requestTo) {
                    try user.acceptRequest(address(cl), creditLineId) {
                        revert('REVERT: Invalid actor cannot accept');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:A2');
                    }
                }
            }
        }
    }

    // Accepting creditline with invalid actor (NOT Borrower) should fail
    function test_AcceptInvalidAcceptor_RequestedAsLender() public {
        requestData.requestAsLender = true;

        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // Testing the function for all the different actors
        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.acceptRequest(address(cl), creditLineId) {
                    revert('REVERT: Invalid actor cannot accept');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:A2');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != requestData.requestTo) {
                    try user.acceptRequest(address(cl), creditLineId) {
                        revert('REVERT: Invalid actor cannot accept');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:A2');
                    }
                }
            }
        }
    }

    // Accepting creditline with invalid creditline (NOT Requested) should fail
    function test_AcceptInvalidCreditLine() public {
        try borrower.acceptRequest(address(cl), 2) {
            revert('REVERT: Cannot accept invalid creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:A1');
        }
    }

    //----------------------- Credit line Accept, passing tests -----------------------//

    // Accepting creditline as a lender should pass
    function test_Accept_AsLender() public {
        CLUser user = new CLUser();

        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin newUser = CLAdmin(userList[i]);
                requestData.requestTo = address(newUser);

                uint256 creditLineId = user.createRequest(address(cl), requestData);
                assert_creditlineConstantsAndStatus(creditLineId, address(user), requestData);
                newUser.acceptRequest(address(cl), creditLineId);

                uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
                assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
            } else {
                CLUser newUser = CLUser(userList[i]);
                requestData.requestTo = address(newUser);

                uint256 creditLineId = user.createRequest(address(cl), requestData);
                assert_creditlineConstantsAndStatus(creditLineId, address(user), requestData);
                newUser.acceptRequest(address(cl), creditLineId);

                uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
                assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
            }
        }
    }

    // Accepting creditline as a borrower should pass
    function test_Accept_AsBorrower() public {
        CLUser user = new CLUser();
        requestData.requestAsLender = true;

        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin newUser = CLAdmin(userList[i]);
                requestData.requestTo = address(newUser);

                uint256 creditLineId = user.createRequest(address(cl), requestData);
                assert_creditlineConstantsAndStatus(creditLineId, address(user), requestData);
                newUser.acceptRequest(address(cl), creditLineId);

                uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
                assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
            } else {
                CLUser newUser = CLUser(userList[i]);
                requestData.requestTo = address(newUser);

                uint256 creditLineId = user.createRequest(address(cl), requestData);
                assert_creditlineConstantsAndStatus(creditLineId, address(user), requestData);
                newUser.acceptRequest(address(cl), creditLineId);

                uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
                assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
            }
        }
    }

    //----------------------- Credit line Cancel, failing tests -----------------------//

    // Invalid actor (other than borrower and lender) should not be able to cancel the credit line
    function test_CancelInvalidActor() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.cancelRequest(address(cl), creditLineId) {
                    revert('REVERT: Invalid actor cannot cancel');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:CP2');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (!(userList[i] == address(lender) || userList[i] == address(borrower))) {
                    try user.cancelRequest(address(cl), creditLineId) {
                        revert('REVERT: Invalid actor cannot cancel');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:CP2');
                    }
                }
            }
        }
    }

    // ACTIVE creditline cannot be cancelled
    function test_CancelInvalidStatus() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        lender.acceptRequest(address(cl), creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE

        try borrower.cancelRequest(address(cl), creditLineId) {
            revert('REVERT: Cannot cancel invalid creditline');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CP1');
        }
    }

    //----------------------- Credit line Cancel, passing tests -----------------------//

    // Borrower should be able to cancel creditline
    function test_creditLineCancel_asBorrower() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        borrower.cancelRequest(address(cl), creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to NOT_CREATED
    }

    // Lender should be able to cancel creditline
    function test_creditLineCancel_asLender() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        lender.cancelRequest(address(cl), creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to NOT_CREATED
    }

    //----------------------- Credit line updateBorrowLimit, failing tests -----------------------//

    // Cannot update borrow limit to newLimit<minBorrowlimit
    function test_updateBorrowLimit_LTLimits() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, CLConstants.minBorrowLimit - 1) {
            revert('REVERT: Cannot update borrow limit to values less than accepted range');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Cannot update borrow limit to newLimit>maxBorrowlimit
    function test_updateBorrowLimit_GTLimits() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, CLConstants.maxBorrowLimit * 100) {
            revert('REVERT: Cannot update borrow limit to values greater than accepted range');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Invalid actor cannot update borrow limit
    function test_updateBorrowLimit_anyAddress() public {
        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        for (uint256 i = 0; i < userList.length; i++) {
            if (i == 0) {
                CLAdmin user = CLAdmin(userList[i]);

                try user.updateBorrowLimit(creditLineAddress, creditLineId, CLConstants.maxBorrowLimit - 10) {
                    revert('REVERT: Invalid actor cannot update borrow limit');
                } catch Error(string memory reason) {
                    assertEq(reason, 'CL:OCLL1');
                }
            } else {
                CLUser user = CLUser(userList[i]);

                if (userList[i] != address(lender)) {
                    try user.updateBorrowLimit(creditLineAddress, creditLineId, CLConstants.maxBorrowLimit - 10) {
                        revert('REVERT: Invalid actor cannot update borrow limit');
                    } catch Error(string memory reason) {
                        assertEq(reason, 'CL:OCLL1');
                    }
                }
            }
        }
    }

    //----------------------- Credit line updateBorrowLimit, passing tests -----------------------//

    // Cannot update borrow limit function in REQUESTED stage
    function test_requested_updateBorrowLimit(uint128 _newBorrowLimit) public {
        uint128 newBorrowLimit = scaleToRange128(_newBorrowLimit, 1, type(uint128).max);

        // Request a credit line
        uint256 creditLineId = borrower.createRequest(address(cl), requestData);
        // Checking variable updates
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, newBorrowLimit) {
            assert_creditlineBorrowLimit(creditLineId, newBorrowLimit);
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
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

        uint256 status = uint256(cl.getCreditLineStatus(_creditLineId));
        assertEq(status, 1); // Checking if creditLine status is updated to REQUESTED
    }

    function assert_creditlineBorrowLimit(uint256 _creditLineId, uint256 _newBorrowLimit) public {
        getCreditlineConstants(_creditLineId);

        assertEq(constantsCheck.borrowLimit, _newBorrowLimit);
    }
}
