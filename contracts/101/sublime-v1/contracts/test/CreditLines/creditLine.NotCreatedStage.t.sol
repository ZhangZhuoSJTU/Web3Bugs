pragma solidity 0.7.6;
pragma abicoder v2;

import './Helpers/CLParent.sol';
import '../../SavingsAccount/SavingsAccount.sol';
import '../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_NotCreatedStageTests is CLParent {
    using SafeMath for uint256;

    CreditLine cl;
    SavingsAccount savingsAccount;
    PriceOracle priceOracle;

    uint256 tokensToLiquidate;
    uint256 totalCollateralTokens;
    uint256 currentDebt;
    uint256 _ratioOfPrices;
    uint256 _decimals;
    uint256 collateralToLiquidate;

    function setUp() public virtual {
        CLSetUp();

        cl = CreditLine(creditLineAddress);
        savingsAccount = SavingsAccount(savingsAccountAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (_ratioOfPrices, _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

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
    }

    //----------------------- setUp, failing tests-----------------------//

    function test_setup_invalidUSDC() public {
        try
            admin.deployCLContracts(
                address(0),
                priceOracleAddress,
                savingsAccountAddress,
                strategyRegistryAddress,
                protocolFeeCollectorAddress
            )
        {
            revert('Should fail when address(0) is used for usdc');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CON1');
        }
    }

    function test_setup_invalidOracle() public {
        try
            admin.deployCLContracts(address(usdc), address(0), savingsAccountAddress, strategyRegistryAddress, protocolFeeCollectorAddress)
        {
            revert('Should fail when address(0) is used for price oracle');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CON2');
        }
    }

    function test_setup_invalidSavingsAccount() public {
        try admin.deployCLContracts(address(usdc), priceOracleAddress, address(0), strategyRegistryAddress, protocolFeeCollectorAddress) {
            revert('Should fail when address(0) is used for savings account');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CON3');
        }
    }

    function test_setup_invalidStrategyRegistry() public {
        try admin.deployCLContracts(address(usdc), priceOracleAddress, savingsAccountAddress, address(0), protocolFeeCollectorAddress) {
            revert('Should fail when address(0) is used for strategy registry');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CON4');
        }
    }

    //----------------------- NOT_CREATED stage, Credit line is not requested yet-----------------------//

    //----------------------- NOT_CREATED stage, failing tests-----------------------//

    // Cannot call accept function in NOT_CREATED stage
    function test_notCreated_accept() public {
        try lender.acceptRequest(creditLineAddress, 10) {
            revert('REVERT: Cannot accpet non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:A1');
        }
    }

    // Cannot call deposit collateral function in NOT_CREATED stage
    function test_notCreated_depositCollateral() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // _fromSavingsAccount = true
        // Adding tokens to borrower and setting allowance for creditline contract
        savingsAccount_depositHelper(address(borrower), address(collateralAsset), requestData.collateralStrategy, amount);

        try borrower.addCollateral(creditLineAddress, 11, amount, true) {
            revert('REVERT: Cannot add collateral to non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }

        // _fromSavingsAccount = false
        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);

        try borrower.addCollateral(creditLineAddress, 11, amount, false) {
            revert('REVERT: Cannot add collateral to non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }
    }

    // Cannot call withdraw collateral function in NOT_CREATED stage
    function test_notCreated_withdrawCollateral() public {
        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // _toSavingsAccount = true
        try borrower.withdrawCollateral(creditLineAddress, 12, amount, true) {
            revert('REVERT: Cannot withdraw collateral from non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawCollateral(creditLineAddress, 12, amount, false) {
            revert('REVERT: Cannot withdraw collateral from non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot call withdraw all collateral function in NOT_CREATED stage
    function test_notCreated_withdrawAllCollateral() public {
        // _toSavingsAccount = true
        try borrower.withdrawAllCollateral(creditLineAddress, 13, true) {
            revert('REVERT: Cannot withdraw collateral from non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawAllCollateral(creditLineAddress, 13, false) {
            revert('REVERT: Cannot withdraw collateral from non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot update borrow limit function in NOT_CREATED stage
    function test_notCreated_updateBorrowLimit(uint128 _newBorrowLimit) public {
        uint128 newBorrowLimit = scaleToRange128(_newBorrowLimit, 1, type(uint128).max);
        try lender.updateBorrowLimit(creditLineAddress, 14, newBorrowLimit) {
            revert('REVERT: Cannot update borrow limit for non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLL1');
        }
    }

    // Cannot borrow in NOT_CREATED stage
    function test_notCreated_borrow() public {
        uint256 amount = 1_000 * 10**ERC20(address(borrowAsset)).decimals();
        try borrower.borrow(creditLineAddress, 15, amount) {
            revert('REVERT: Cannot borrow from non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot repay in NOT_CREATED stage
    function test_notCreated_repay() public {
        uint256 amount = 1_000 * 10**ERC20(address(borrowAsset)).decimals();
        try borrower.repay(creditLineAddress, 16, amount) {
            revert('REVERT: Cannot repay non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP2');
        }
    }

    // Cannot liquidate in NOT_CREATED stage
    function test_notCreated_liquidate() public {
        // _toSavingsAccount = true
        try lender.liquidate(creditLineAddress, 17, true) {
            revert('REVERT: Cannot liquidate non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }

        // _toSavingsAccount = false
        try lender.liquidate(creditLineAddress, 17, false) {
            revert('REVERT: Cannot liquidate non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }
    }

    // Cannot close credit line in NOT_CREATED stage
    function test_notCreated_close() public {
        try borrower.close(creditLineAddress, 18) {
            revert('REVERT: Cannot close non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C1');
        }
    }

    // Cannot cancel credit line in NOT_CREATED stage
    function test_notCreated_cancel() public {
        try borrower.cancelRequest(creditLineAddress, 19) {
            revert('REVERT: Cannot cancel non-existant credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CP1');
        }
    }

    //----------------------- NOT_CREATED stage, passing tests-----------------------//

    // Requesting a credit line in the NOT_CREATED stage should pass
    function test_notCreated_request() public {
        uint256 creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);
    }

    //----------------------- NOT_CREATED stage, Credit line is cancelled-----------------------//

    //----------------------- NOT_CREATED/CANCELLED stage, failing tests-----------------------//

    // Cannot call accept function for cancelled credit line
    function test_cancelled_accept() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        // accept the credit line
        try lender.acceptRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot accpet cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:A1');
        }
    }

    // Cannot deposit collateral to cancelled credit line
    function test_cancelled_depositCollateral() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // _fromSavingsAccount = true
        savingsAccount_depositHelper(address(borrower), address(collateralAsset), requestData.collateralStrategy, amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot add collateral to cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }

        // _fromSavingsAccount = false
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot add collateral to cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }
    }

    // Cannot withdraw collateral from cancelled credit line
    function test_cancelled_withdrawCollateral() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // withdraw collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot withdraw collateral from cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot withdraw collateral from cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot withdraw collateral from cancelled credit line
    function test_cancelled_withdrawAllCollateral() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        // withdraw all collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot withdraw collateral from cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot withdraw collateral from cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot update Borrow Limit for cancelled credit line
    function test_cancelled_updateBorrowLimit(uint128 _newBorrowLimit) public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        // update borrow limit of the credit line
        uint128 newBorrowLimit = scaleToRange128(_newBorrowLimit, 1, type(uint128).max);
        try lender.updateBorrowLimit(creditLineAddress, creditLineId, newBorrowLimit) {
            revert('REVERT: Cannot update borrow limit for cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLL1');
        }
    }

    // Cannot borrow from cancelled credit line
    function test_cancelled_borrow() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // borrow from the credit line
        try borrower.borrow(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot borrow from cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot repay for cancelled credit line
    function test_cancelled_repay() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // repay the credit line
        try borrower.repay(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot repay cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP2');
        }
    }

    // Cannot liquidate cancelled credit line
    function test_cancelled_liquidate() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        // liquidate the credit line

        // _toSavingsAccount = true
        try lender.liquidate(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot liquidate cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }

        // _toSavingsAccount = false
        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot liquidate cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }
    }

    // Cannot close cancelled credit line
    function test_cancelled_close() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        // close the credit line
        try borrower.close(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot close cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C1');
        }
    }

    // Cannot cancel cancelled credit line
    function test_cancelled_cancel() public {
        // Requesting and cancelling the creditline
        uint256 creditLineId = assert_creditLineRequestedAndCancelled();

        // cancel the credit line
        try borrower.cancelRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot cancel cancelled credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CP1');
        }
    }

    function assert_creditLineRequestedAndCancelled() public returns (uint256) {
        // request a credit line
        uint256 creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);

        // cancel the credit line
        borrower.cancelRequest(address(cl), creditLineId);

        // check status of credit line
        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to NOT_CREATED

        return creditLineId;
    }

    //----------------------- NOT_CREATED stage, Credit line is liquidated-----------------------//

    //----------------------- NOT_CREATED/LIQUIDATED stage, failing tests-----------------------//

    // Cannot accept liquidated credit line
    function test_liquidated_accept() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, false);

        // accept the credit line
        try lender.acceptRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot accpet liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:A1');
        }
    }

    // Cannot deposit collateral to liquidated credit line
    function test_liquidated_depositCollateral() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, false);

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // _fromSavingsAccount = true
        savingsAccount_depositHelper(address(borrower), address(collateralAsset), requestData.collateralStrategy, amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot add collateral to liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }

        // _fromSavingsAccount = false
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot add collateral to liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }
    }

    // Cannot withdraw collateral from liquidated credit line
    function test_liquidated_withdrawCollateral() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, true);

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // withdraw collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot withdraw collateral from liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot withdraw collateral from liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot withdraw collateral from liquidated credit line
    function test_liquidated_withdrawAllCollateral() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, false);

        // withdraw all collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot withdraw collateral from liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot withdraw collateral from liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot update borrow limit for liquidated credit line
    function test_liquidated_updateBorrowLimit(uint128 _newBorrowLimit) public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, false);

        // update borrow limit of the credit line
        uint128 newBorrowLimit = scaleToRange128(_newBorrowLimit, 1, type(uint128).max);
        try lender.updateBorrowLimit(creditLineAddress, creditLineId, newBorrowLimit) {
            revert('REVERT: Cannot update borrow limit for liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLL1');
        }
    }

    // Cannot borrow from liquidated credit line
    function test_liquidated_borrow() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, true);

        uint256 amount = 1_000 * 10**ERC20(address(borrowAsset)).decimals();

        // borrow from the credit line
        try borrower.borrow(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot borrow from liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot repay to liquidated credit line
    function test_liquidated_repay() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, false);

        uint256 amount = 1_000 * 10**ERC20(address(borrowAsset)).decimals();

        // repay the credit line
        try borrower.repay(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot repay liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP2');
        }
    }

    // Cannot liquidate liquidated credit line
    function test_liquidated_liquidate() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, true);

        // liquidate the credit line

        // _toSavingsAccount = true
        try lender.liquidate(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot liquidate liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }

        // _toSavingsAccount = false
        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot liquidate liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }
    }

    // Cannot close liquidated credit line
    function test_liquidated_close() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, true);

        // close the credit line
        try borrower.close(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot close liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C1');
        }
    }

    // Cannot cancel liquidated credit line
    function test_liquidated_cancel() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //Liquidate the credit line
        assert_creditLineLiquidate(address(lender), creditLineId, false);

        // cancel the credit line
        try borrower.cancelRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot cancel liquidated credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CP1');
        }
    }

    //----------------------- NOT_CREATED stage, Credit line is closed-----------------------//

    //----------------------- NOT_CREATED/CLOSED stage, failing tests-----------------------//

    // Cannot accept closed credit line
    function test_closed_accept() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        // accept the credit line
        try lender.acceptRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot accpet closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:A1');
        }
    }

    // Cannot deposit collateral to closed credit line
    function test_closed_depositCollateral() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // _fromSavingsAccount = true
        savingsAccount_depositHelper(address(borrower), address(collateralAsset), requestData.collateralStrategy, amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot add collateral to closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }

        // _fromSavingsAccount = false
        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);
        // deposit collateral to the credit line
        try borrower.addCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot add collateral to closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:DC2');
        }
    }

    // Cannot withdraw collateral from closed credit line
    function test_closed_withdrawCollateral() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        uint256 amount = 1_000 * 10**ERC20(address(collateralAsset)).decimals();

        // withdraw collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, true) {
            revert('REVERT: Cannot withdraw collateral from closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawCollateral(creditLineAddress, creditLineId, amount, false) {
            revert('REVERT: Cannot withdraw collateral from closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot withdraw collateral from closed credit line
    function test_closed_withdrawAllCollateral() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        // withdraw all collateral from the credit line

        // _toSavingsAccount = true
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot withdraw collateral from closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }

        // _toSavingsAccount = false
        try borrower.withdrawAllCollateral(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot withdraw collateral from closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot update borrow limit for closed credit line
    function test_closed_updateBorrowLimit(uint128 _newBorrowLimit) public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        // update borrow limit of the credit line
        uint128 newBorrowLimit = scaleToRange128(_newBorrowLimit, 1, type(uint128).max);
        try lender.updateBorrowLimit(creditLineAddress, creditLineId, newBorrowLimit) {
            revert('REVERT: Cannot update borrow limit for closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLL1');
        }
    }

    // Cannot borrow from closed credit line
    function test_closed_borrow() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        uint256 amount = 1_000 * 10**ERC20(address(borrowAsset)).decimals();

        // borrow from the credit line
        try borrower.borrow(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot borrow from closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:OCLB1');
        }
    }

    // Cannot repay to closed credit line
    function test_closed_repay() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        uint256 amount = 1_000 * 10**ERC20(address(borrowAsset)).decimals();

        // repay the credit line
        try borrower.repay(creditLineAddress, creditLineId, amount) {
            revert('REVERT: Cannot repay closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:REP2');
        }
    }

    // Cannot liquidate closed credit line
    function test_closed_liquidate() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        // liquidate the credit line

        // _toSavingsAccount = true
        try lender.liquidate(creditLineAddress, creditLineId, true) {
            revert('REVERT: Cannot liquidate closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }

        // _toSavingsAccount = false
        try lender.liquidate(creditLineAddress, creditLineId, false) {
            revert('REVERT: Cannot liquidate closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:L1');
        }
    }

    // Cannot close closed credit line
    function test_closed_close() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        // close the credit line
        try borrower.close(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot close closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:C1');
        }
    }

    // Cannot cancel closed credit line
    function test_closed_cancel() public {
        // Go to Active stage
        uint256 creditLineId = goToActiveStage();

        //repay and close the credit line
        assert_creditLineRepayAndClose(address(borrower), creditLineId, address(borrowAsset));

        // cancel the credit line
        try borrower.cancelRequest(creditLineAddress, creditLineId) {
            revert('REVERT: Cannot cancel closed credit line');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:CP1');
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
        assertEq(constantsCheck.borrowAssetStrategy, requestData.borrowAssetStrategy);
        assertEq(constantsCheck.collateralAsset, requestData.collateralAsset);
        assertEq(constantsCheck.collateralStrategy, requestData.collateralStrategy);

        uint256 status = uint256(cl.getCreditLineStatus(_creditLineId));
        assertEq(status, 1); // Checking if creditLine status is updated to REQUESTED
    }

    function assert_creditLineLiquidate(
        address _user,
        uint256 _creditLineId,
        bool _fromSavingsAccount
    ) public {
        uint256 currentBalance;
        uint256 balanceAfter;
        uint256 balanceDiff;
        uint256 amount = 1 * 10**(ERC20(address(collateralAsset)).decimals());
        address borrowAssetStrategy = requestData.borrowAssetStrategy;
        address collateralStrategy = requestData.collateralStrategy;

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);

        borrower.addCollateral(creditLineAddress, _creditLineId, amount, false);

        uint256 borrowable = cl.calculateBorrowableAmount(_creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(creditLineAddress, _creditLineId, borrowable);

        if (!isForked) {
            borrowAssetMockAggregator.updateAnswer(9795040576);
        } else {
            setCurrentCollRatio();
        }

        tokensToLiquidate = cl.borrowTokensToLiquidate(_creditLineId);
        totalCollateralTokens = cl.calculateTotalCollateralTokens(_creditLineId);
        currentDebt = cl.calculateCurrentDebt(_creditLineId);
        (_ratioOfPrices, _decimals) = PriceOracle(priceOracleAddress).getLatestPrice(address(collateralAsset), address(borrowAsset));
        collateralToLiquidate = currentDebt.mul(10**_decimals).div(_ratioOfPrices);
        if (collateralToLiquidate > totalCollateralTokens) {
            collateralToLiquidate = totalCollateralTokens;
        }

        CLUser user = CLUser(_user);

        admin.transferToken(address(borrowAsset), address(user), tokensToLiquidate);
        user.setAllowance(creditLineAddress, address(borrowAsset), tokensToLiquidate);

        if (_fromSavingsAccount) {
            currentBalance = savingsAccount.balanceInShares(address(user), address(collateralAsset), collateralStrategy);
            user.liquidate(creditLineAddress, _creditLineId, _fromSavingsAccount);
            balanceAfter = savingsAccount.balanceInShares(address(user), address(collateralAsset), collateralStrategy);
            balanceDiff = balanceAfter.sub(currentBalance);
            uint256 collateralShares = IYield(collateralStrategy).getSharesForTokens(collateralToLiquidate, address(collateralAsset));
            assertEq(balanceDiff, collateralShares);
        } else {
            currentBalance = collateralAsset.balanceOf(address(user));
            user.liquidate(creditLineAddress, _creditLineId, _fromSavingsAccount);
            balanceAfter = collateralAsset.balanceOf(address(user));
            balanceDiff = balanceAfter.sub(currentBalance);
            assertApproxEqAbs(balanceDiff, collateralToLiquidate, 1);
        }

        uint256 status = uint256(cl.getCreditLineStatus(_creditLineId));
        assertEq(status, 0); // Credit line variables are deleted
    }

    function assert_creditLineRepayAndClose(
        address _user,
        uint256 _creditLineId,
        address _asset
    ) public {
        // initialize the user
        CLUser user = CLUser(_user);
        uint256 amount = 1 * 10**(ERC20(address(collateralAsset)).decimals());
        address borrowAssetStrategy = requestData.borrowAssetStrategy;

        admin.transferToken(address(collateralAsset), address(borrower), amount);
        borrower.setAllowance(creditLineAddress, address(collateralAsset), amount);

        borrower.addCollateral(creditLineAddress, _creditLineId, amount, false);

        uint256 borrowable = cl.calculateBorrowableAmount(_creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), borrowAssetStrategy, borrowable);

        borrower.borrow(creditLineAddress, _creditLineId, borrowable);

        _increaseBlock(block.timestamp + 10000 days);

        currentDebt = cl.calculateCurrentDebt(_creditLineId);

        // add balance to user
        admin.transferToken(_asset, _user, currentDebt);
        user.setAllowance(creditLineAddress, _asset, currentDebt);

        // getting balance of the user before repayment
        uint256 balanceBefore = IERC20(_asset).balanceOf(_user);

        // repay the credit line
        user.repay(creditLineAddress, _creditLineId, currentDebt);

        // getting the balance after repayment
        uint256 balanceAfter = IERC20(_asset).balanceOf(_user);

        // assert: balance change for user should be equal to amount repaid
        assertEq(balanceBefore.sub(balanceAfter), currentDebt);

        // checking the variable updates after repayment
        (
            ,
            uint256 principal,
            uint256 totalInterestRepaid,
            uint256 lastPrincipalUpdateTime,
            uint256 interestAccruedTillLastPrincipalUpdate
        ) = cl.creditLineVariables(_creditLineId);

        // if total debt is repaid, credit line is reset
        assertEq(principal, 0);
        assertEq(totalInterestRepaid, 0);
        assertEq(lastPrincipalUpdateTime, 0);
        assertEq(interestAccruedTillLastPrincipalUpdate, 0);

        user.close(creditLineAddress, _creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(_creditLineId));
        assertEq(status, 0); // Credit Line variable are deleted
    }

    function setCurrentCollRatio() public {
        vm.mockCall(
            priceOracleAddress,
            abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(collateralAsset), address(borrowAsset)),
            abi.encode(1000000, 8) // price, decimals
        );
    }
}
