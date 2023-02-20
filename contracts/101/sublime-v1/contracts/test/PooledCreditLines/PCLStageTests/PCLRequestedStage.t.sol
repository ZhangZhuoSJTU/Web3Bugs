// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../mocks/MockToken.sol';
import '../Helpers/PCLParent.t.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '../Roles/MaliciousLender.sol';

contract PCLRequestedStage is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;

    uint256 requestId;
    uint256 _fromUserPoolTokenSupplyOld;
    uint256 _toUserPoolTokenSupplyOld;
    uint256 _fromUserPoolTokenSupplyNew;
    uint256 _toUserPoolTokenSupplyNew;

    function setUp() public virtual override {
        super.setUp();

        request.borrowLimit = uint128(1_000_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * 1e18) / 1e2);
        request.collateralRatio = 1e18;
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * 1e18) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED);
    }

    function test_cannotStartAfterEndsAt() public {
        createMultipleLenders(requestId, 5, uint128(request.minBorrowAmount), request.borrowAsset);
        vm.warp(block.timestamp + request.collectionPeriod + request.duration);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        try _lender.start(requestId) {
            revert('Cannot start PCL once it has ended');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S3');
        }
    }

    /**************************************************************************************************************************************
    Deposit collateral function tests
    **************************************************************************************************************************************/

    function assert_collateralCannotBeDepositedInRequestedState(
        uint256 _id,
        uint256 _amountToBorrow,
        PCLUser _depositor,
        bool _isDepositorLender
    ) public {
        // Since the PCL is in the REQUESTED state, let us start some lending
        createMultipleLenders(_id, 5, request.borrowLimit / 2, request.borrowAsset);

        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        if (_isDepositorLender) {
            _depositor = PCLUser(lenders[0].lenderAddress);
        }

        admin.transferToken(address(collateralAsset), address(_depositor), _collateralRequired);
        _depositor.setAllowance(address(pcl), address(collateralAsset), _collateralRequired);

        try _depositor.depositCollateral(_id, _collateralRequired, false) {
            revert('Collateral cannot be deposited in the REQUESTED state');
        } catch Error(string memory reason) {
            if (request.collateralRatio == 0) {
                assertEq(reason, 'PCL:DC1');
            } else {
                assertEq(reason, 'PCL:DC2');
            }
        }
    }

    function test_borrowerCannotDepositCollateral() public {
        uint256 _amountToBorrow = 100_000 * 1e18;
        assert_collateralCannotBeDepositedInRequestedState(requestId, _amountToBorrow, borrower, true);
    }

    function test_lenderCannotDepositCollateral() public {
        uint256 _amountToBorrow = 100_000 * 1e18;
        assert_collateralCannotBeDepositedInRequestedState(requestId, _amountToBorrow, PCLUser(address(0)), true);
    }

    function test_adminCannotDepositCollateral() public {
        uint256 _amountToBorrow = 100_000 * 1e18;
        assert_collateralCannotBeDepositedInRequestedState(requestId, _amountToBorrow, admin, false);
    }

    /**************************************************************************************************************************************
    Start/proceed to Active state function tests
    **************************************************************************************************************************************/

    function assert_start_functionality_in_requested_state(
        uint256 _id,
        uint256 _numOfLenders,
        uint128 _lendAmount,
        uint256 _travelDuration,
        PooledCreditLineStatus _stateToAssert,
        PCLUser _starter,
        bool _positiveCase,
        string memory _revertStatement,
        string memory _errorMessage
    ) public {
        // complex test - code can be simplified

        createMultipleLenders(_id, _numOfLenders, _lendAmount, request.borrowAsset);

        vm.warp(block.timestamp + _travelDuration);

        if (_lendAmount >= request.borrowLimit) {
            borrower.start(_id);
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == _stateToAssert);

        if (!_positiveCase) {
            try _starter.start(_id) {
                revert(_revertStatement);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        } else {
            _starter.start(_id);
        }
    }

    // Test 3.1
    function test_cannotStartAlreadyActivePCL() public {
        assert_start_functionality_in_requested_state(
            requestId,
            4,
            request.borrowLimit + 10,
            request.collectionPeriod,
            PooledCreditLineStatus.ACTIVE,
            borrower,
            false,
            'PCL cannot be started again',
            'LP:S1'
        );
    }

    // Test 3.2
    function test_cannotStartPCLInCollectionPeriod() public {
        assert_start_functionality_in_requested_state(
            requestId,
            2,
            request.borrowLimit - 1,
            0,
            PooledCreditLineStatus.REQUESTED,
            admin,
            false,
            'PCL cannot be started in collection period',
            'LP:S2'
        );
    }

    // Test 3.3
    function test_cannotProceedIntoActiveStateWithoutMinBorrowAmount() public {
        assert_start_functionality_in_requested_state(
            requestId,
            5,
            uint128(request.minBorrowAmount - 1),
            request.collectionPeriod,
            PooledCreditLineStatus.REQUESTED,
            borrower,
            false,
            'PCL cannot be started for an amount less than minBorrowAmount',
            'LP:S4'
        );
    }

    // Test 3.4
    function test_startPCLPositiveCase() public {
        assert_start_functionality_in_requested_state(
            requestId,
            5,
            uint128(request.minBorrowAmount + 1),
            request.collectionPeriod,
            PooledCreditLineStatus.REQUESTED,
            borrower,
            true,
            '',
            ''
        );
    }

    function test_lenderCannotStart() public {
        createMultipleLenders(requestId, 2, request.borrowLimit - 1, request.borrowAsset);

        vm.warp(block.timestamp + request.collectionPeriod);

        PCLUser lender = PCLUser(lenders[0].lenderAddress);

        try lender.start(requestId) {
            revert("Lender shouldn't be able to start PCL");
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:A2');
        }
    }

    function test_adminCannotStart() public {
        createMultipleLenders(requestId, 2, request.borrowLimit - 1, request.borrowAsset);

        vm.warp(block.timestamp + request.collectionPeriod);

        PCLUser admin = PCLUser(admin);

        try admin.start(requestId) {
            revert("Admin shouldn't be able to start PCL");
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:A2');
        }
    }

    function test_randomUserCannotStart() public {
        createMultipleLenders(requestId, 2, request.borrowLimit - 1, request.borrowAsset);

        vm.warp(block.timestamp + request.collectionPeriod);

        PCLUser randomUser = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);

        try randomUser.start(requestId) {
            revert("Random user shouldn't be able to start PCL");
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:A2');
        }
    }

    /**************************************************************************************************************************************
    Cancel function tests
    **************************************************************************************************************************************/

    function assert_cancel_functionality_in_requested_state(
        uint256 _id,
        uint256 _noOfLenders,
        uint128 _amountToLend,
        uint256 _travelDuration,
        PooledCreditLineStatus _stateToAssert_1,
        bool _isLender,
        PCLUser _user,
        bool _positiveCase,
        string memory _revertMessage,
        string memory _errorMessage,
        PooledCreditLineStatus _stateToAssert_2
    ) public {
        // complex test - code can be simplified

        createMultipleLenders(_id, _noOfLenders, _amountToLend, request.borrowAsset);

        vm.warp(block.timestamp + _travelDuration);

        if (_amountToLend >= request.borrowLimit) {
            borrower.start(_id);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == _stateToAssert_1);

        if (_isLender) {
            _user = PCLUser(lenders[0].lenderAddress);
        }

        if (!_positiveCase) {
            try _user.cancelRequest(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        } else {
            _user.cancelRequest(_id);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == _stateToAssert_2);
    }

    // Test 4.1
    function test_borrowerCannotCancelActivePCL() public {
        assert_cancel_functionality_in_requested_state(
            requestId,
            4,
            request.borrowLimit + 10,
            request.collectionPeriod,
            PooledCreditLineStatus.ACTIVE,
            false,
            borrower,
            false,
            'PCL can be cancelled only in the REQUESTED state',
            'PCL:CR1',
            PooledCreditLineStatus.ACTIVE
        );
    }

    // Test 4.2
    function test_borrowerCannotCancelPostCollectionPeriod() public {
        assert_cancel_functionality_in_requested_state(
            requestId,
            6,
            uint128(request.minBorrowAmount - 1),
            (request.collectionPeriod + 2 days),
            PooledCreditLineStatus.REQUESTED,
            false,
            borrower,
            false,
            'PCL can be cancelled only in the REQUESTED state',
            'PCL:CR2',
            PooledCreditLineStatus.REQUESTED
        );
    }

    // Test 4.3
    function test_lenderCannotCancelPCL() public {
        assert_cancel_functionality_in_requested_state(
            requestId,
            5,
            uint128(request.borrowLimit - 100),
            (request.collectionPeriod / 2),
            PooledCreditLineStatus.REQUESTED,
            true,
            PCLUser(address(0)),
            false,
            'Only borrower can cancel PCL',
            'PCL:OCLB1',
            PooledCreditLineStatus.REQUESTED
        );
    }

    // Test 4.4
    function test_adminCannotCancelPCL() public {
        assert_cancel_functionality_in_requested_state(
            requestId,
            5,
            uint128(request.borrowLimit - 100),
            (request.collectionPeriod / 2),
            PooledCreditLineStatus.REQUESTED,
            false,
            admin,
            false,
            'Only borrower can cancel PCL',
            'PCL:OCLB1',
            PooledCreditLineStatus.REQUESTED
        );
    }

    // Test 4.5
    function test_cancelPCLPositiveCase() public {
        assert_cancel_functionality_in_requested_state(
            requestId,
            5,
            uint128(request.borrowLimit - 100),
            (request.collectionPeriod / 2),
            PooledCreditLineStatus.REQUESTED,
            false,
            borrower,
            true,
            '',
            '',
            PooledCreditLineStatus.CANCELLED
        );
    }

    /**************************************************************************************************************************************
    Liquidity Withdrawal function tests
    **************************************************************************************************************************************/

    function assert_withdraw_liquidity_functionality_in_request_state(
        uint256 _id,
        bool _isLender,
        PCLUser _user,
        PooledCreditLineStatus _stateToAssert_1,
        bool _positiveCase,
        string memory _revertMessage,
        string memory _errorMessage,
        PooledCreditLineStatus _stateToAssert_2
    ) public {
        // complex test - code can be simplified
        createMultipleLenders(_id, 6, uint128(request.minBorrowAmount - 1), request.borrowAsset);

        if (_isLender) {
            _user = PCLUser(lenders[0].lenderAddress);
        }

        uint256 _userPoolTokenBalance = lp.balanceOf(address(_user), _id);

        vm.warp(block.timestamp + (request.collectionPeriod + 2 days));

        assertTrue(pcl.getStatusAndUpdate(_id) == _stateToAssert_1);

        if (!_positiveCase) {
            try admin.withdrawLiquidity(requestId) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        } else {
            // the pcl will get cancelled because of low collection
            _user.withdrawLiquidity(_id);
            uint256 _userBorrowTokenBalance = IERC20(request.borrowAsset).balanceOf(address(_user));
            assertEq(_userPoolTokenBalance, _userBorrowTokenBalance);

            _userPoolTokenBalance = lp.balanceOf(address(_user), _id);
            assertEq(_userPoolTokenBalance, 0);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == _stateToAssert_2);
    }

    // Test 5.1
    function test_lenderWithdrawsLiquidityInRequestedStatePositiveCase() public {
        assert_withdraw_liquidity_functionality_in_request_state(
            requestId,
            true,
            PCLUser(lenders[0].lenderAddress),
            PooledCreditLineStatus.REQUESTED,
            true,
            '',
            '',
            PooledCreditLineStatus.CANCELLED
        );
    }

    // Test 5.2
    function test_adminCannotWithdrawLiquidityInRequestedState() public {
        assert_withdraw_liquidity_functionality_in_request_state(
            requestId,
            false,
            admin,
            PooledCreditLineStatus.REQUESTED,
            false,
            'Admin withdrew liquidity',
            'LP:IWL1',
            PooledCreditLineStatus.REQUESTED
        );
    }

    /**************************************************************************************************************************************
    Close function tests
    **************************************************************************************************************************************/

    function assert_close_functionality_in_requested_state(
        uint256 _id,
        uint256 _noOfLenders,
        uint128 _amountToLend,
        bool _isLender,
        PCLUser _user,
        uint256 _travelDuration,
        PooledCreditLineStatus _stateToAssert_1,
        bool _positiveCase,
        string memory _revertMessage,
        string memory _errorMessage,
        PooledCreditLineStatus _stateToAssert_2
    ) public {
        createMultipleLenders(_id, _noOfLenders, _amountToLend, request.borrowAsset);

        vm.warp(block.timestamp + _travelDuration);

        if (_positiveCase) {
            _user.start(_id);
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == _stateToAssert_1);

        if (_isLender) {
            _user = PCLUser(lenders[0].lenderAddress);
        }

        if (_positiveCase) {
            _user.close(_id);
        } else {
            try _user.close(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == _stateToAssert_2);
    }

    // Test 6.1
    function test_borrowerCannotCloseRequestedPCL() public {
        assert_close_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 1),
            false,
            borrower,
            request.collectionPeriod,
            PooledCreditLineStatus.REQUESTED,
            false,
            'PCL cannot be closed in the ACTIVE state',
            'PCL:C1',
            PooledCreditLineStatus.REQUESTED
        );
    }

    // Test 6.2
    function test_borrowerCanCloseActivePCLPositiveCase() public {
        assert_close_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.borrowLimit + 1),
            false,
            borrower,
            (request.collectionPeriod),
            PooledCreditLineStatus.ACTIVE,
            true,
            '',
            '',
            PooledCreditLineStatus.CLOSED
        );
    }

    // Test 6.3
    function test_lenderCannotClosePCL() public {
        assert_close_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 100),
            true,
            PCLUser(address(0)),
            0,
            PooledCreditLineStatus.REQUESTED,
            false,
            'PCL cannot be closed by a lender',
            'PCL:OCLB1',
            PooledCreditLineStatus.REQUESTED
        );
    }

    // Test 6.4
    function test_adminCannotClosePCL() public {
        assert_close_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 100),
            false,
            admin,
            0,
            PooledCreditLineStatus.REQUESTED,
            false,
            'PCL cannot be closed by admin',
            'PCL:OCLB1',
            PooledCreditLineStatus.REQUESTED
        );
    }

    /**************************************************************************************************************************************
    Liquidate function tests
    **************************************************************************************************************************************/

    function assert_liquidate_functionality_in_requested_state(
        uint256 _id,
        uint256 _noOfLenders,
        uint128 _amountToLend,
        uint256 _travelDuration,
        bool _isLender,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        createMultipleLenders(_id, _noOfLenders, _amountToLend, request.borrowAsset);

        vm.warp(block.timestamp + _travelDuration);

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);

        if (_isLender) {
            _user = PCLUser(lenders[0].lenderAddress);
        }

        try _user.liquidate(_id, true) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
    }

    // Test 7.1: Call Liquidate function in REQUESTED state
    function test_callLiquidateInRequestedState() public {
        assert_liquidate_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 100),
            request.collectionPeriod,
            true,
            PCLUser(address(0)),
            'Borrower cannot be liquidated without borrowing first',
            'PCL:L1'
        );
    }

    // Test 7.2: Borrower calls liquidate function in the REQUESTED state
    function test_borrowerCallsLiquidateInRequestedState() public {
        assert_liquidate_functionality_in_requested_state(
            requestId,
            3,
            uint128(request.minBorrowAmount - 100),
            request.collectionPeriod,
            false,
            borrower,
            'Borrower cannot liquidate a PCL',
            'LP:LIQ1'
        );
    }

    // Test 7.3: Admin calls liquidate function in the REQUESTED state
    function test_adminCallsLiquidateInRequestedState() public {
        assert_liquidate_functionality_in_requested_state(
            requestId,
            3,
            uint128(request.minBorrowAmount - 100),
            request.collectionPeriod,
            false,
            admin,
            'Admin cannot liquidate a PCL',
            'LP:LIQ1'
        );
    }

    function test_callLiquidateAfterTransferringPoolTokens() public {
        // Lend any amount lower than the minBorrowAmount, so that PCL does not go into active state
        createMultipleLenders(requestId, 4, uint128(request.minBorrowAmount - 100), request.borrowAsset);

        // Warping past the collection period
        vm.warp(block.timestamp + request.collectionPeriod);

        // Check whether the PCL went into the ACTIVE state
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED);

        // Picking out two lenders from the list of 4 lenders
        PCLUser lender_0 = PCLUser(lenders[0].lenderAddress);
        PCLUser lender_1 = PCLUser(lenders[1].lenderAddress);

        uint256 lender_0_pool_token_balance = lp.balanceOf(address(lender_0), requestId);

        log_named_uint('Lender_0 Pool MockToken Balance-1', lender_0_pool_token_balance);

        // lender_0 tries to transfer their pool tokens to lender_1
        lender_0.transferLPTokens(address(lender_1), requestId, lender_0_pool_token_balance);

        // Lender_0 calls the liquidate function
        try lender_0.liquidate(requestId, false) {
            revert('Lender with 0 pool tokens cannot liquidate');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:LIQ1');
        }
    }

    /**************************************************************************************************************************************
    Repay function tests
    **************************************************************************************************************************************/

    function assertRepayFunctionalityInRequestedState(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.repay(_id, 1) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);
    }

    function test_adminCannotRepay() public {
        assertRepayFunctionalityInRequestedState(requestId, admin, 'Admin cannot repay a requested PCL', 'PCL:REP2');
    }

    function test_borrowerCannotRepay() public {
        assertRepayFunctionalityInRequestedState(requestId, borrower, 'Borrower cannot repay a requested PCL', 'PCL:REP2');
    }

    function test_lenderCannotRepay() public {
        createMultipleLenders(requestId, 4, uint128(request.minBorrowAmount - 100), request.borrowAsset);
        assertRepayFunctionalityInRequestedState(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot repay a requested PCL',
            'PCL:REP2'
        );
    }

    /*************************************************************************************************************************************
    Borrow function tests
    *************************************************************************************************************************************/

    function assertBorrowFunctionalityInRequestedState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.borrow(_id, _amount) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);
    }

    function test_adminCannotBorrow() public {
        assertBorrowFunctionalityInRequestedState(requestId, 1, admin, 'Admin cannot borrow a PCL in requested state', 'PCL:OCLB1');
    }

    function test_borrowerCannotBorrowAfterStartTimestamp() public {
        vm.warp(block.timestamp + request.collectionPeriod);
        assertBorrowFunctionalityInRequestedState(requestId, 1, borrower, 'Borrower cannot borrow a PCL in requested state', 'PCL:IB3');
    }

    function test_borrowerCannotBorrow() public {
        assertBorrowFunctionalityInRequestedState(requestId, 1, borrower, 'Borrower cannot borrow a PCL in requested state', 'PCL:IB2');
    }

    function test_borrowerCannotBorrowZeroAmount() public {
        assertBorrowFunctionalityInRequestedState(requestId, 0, borrower, 'Borrower cannot borrow a PCL in requested state', 'PCL:IB1');
    }

    function test_lenderCannotBorrow() public {
        createMultipleLenders(requestId, 4, uint128(request.minBorrowAmount - 100), request.borrowAsset);
        assertBorrowFunctionalityInRequestedState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot borrow a PCL in requested state',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Withdraw collateral function tests
    *************************************************************************************************************************************/

    function assertWithdrawCollateralFunctionalityInRequestedState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage,
        string memory _errorMessageAll
    ) public {
        try _user.withdrawAllCollateral(_id, false) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessageAll);
        }

        try _user.withdrawCollateral(_id, _amount, false) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
    }

    function test_adminCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInRequestedState(
            requestId,
            1,
            admin,
            'Admin cannot withdraw collateral in requested state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInRequestedState(
            requestId,
            1,
            borrower,
            'Borrower cannot withdraw collateral in requested state',
            'PCL:WC1',
            'PCL:WAC1'
        );
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        assertWithdrawCollateralFunctionalityInRequestedState(
            requestId,
            0,
            borrower,
            'Borrower cannot withdraw collateral in requested state',
            'PCL:WC2',
            'PCL:WAC1'
        );
    }

    function test_lenderCannotWithdrawCollateral() public {
        createMultipleLenders(requestId, 4, uint128(request.minBorrowAmount - 100), request.borrowAsset);
        assertWithdrawCollateralFunctionalityInRequestedState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot withdraw collateral in requested state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    /**************************************************************************************************************************************
    Terminate function tests
    **************************************************************************************************************************************/

    function assert_terminate_functionality_in_requested_state(
        uint256 _id,
        uint256 _noOfLenders,
        uint128 _amountToLend,
        uint256 _travelDuration,
        PooledCreditLineStatus _stateToAssert_1,
        bool _isLender,
        PCLUser _user,
        bool _positiveCase,
        string memory _revertMessage,
        string memory _errorMessage,
        PooledCreditLineStatus _stateToAssert_2
    ) public {
        createMultipleLenders(_id, _noOfLenders, _amountToLend, request.borrowAsset);

        vm.warp(block.timestamp + _travelDuration);

        assertTrue(pcl.getStatusAndUpdate(requestId) == _stateToAssert_1);

        if (_isLender) {
            _user = PCLUser(lenders[0].lenderAddress);
        }

        if (_positiveCase) {
            _user.terminate(_id);
            // PooledCreditLine.PooledCreditLineConstants memory _params = pcl.getpooledCreditLineConstant(requestId);
            // assertEq(_params.borrowAsset, address(0));
        } else {
            try _user.terminate(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == _stateToAssert_2);
    }

    // Test 8.1: Admin can terminate the PCL in requested state
    function test_terminationInRequestedState() public {
        assert_terminate_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 1),
            request.collectionPeriod,
            PooledCreditLineStatus.REQUESTED,
            false,
            admin,
            true,
            '',
            '',
            PooledCreditLineStatus.NOT_CREATED // Final state. Since everything gets deleted.
        );
    }

    // Test 8.2: Lender cannot terminate the PCL in REQUESTED state
    function test_terminationInRequestedStateByLender() public {
        assert_terminate_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 1),
            request.collectionPeriod,
            PooledCreditLineStatus.REQUESTED,
            true,
            PCLUser(address(0)),
            false,
            'Lender cannot terminate PCLs',
            'Ownable: caller is not the owner',
            PooledCreditLineStatus.REQUESTED
        );
    }

    // Test 8.3: Borrower cannot terminate the PCL in REQUESTED state
    function test_terminationInRequestedStateByBorrower() public {
        assert_terminate_functionality_in_requested_state(
            requestId,
            4,
            uint128(request.minBorrowAmount - 1),
            request.collectionPeriod,
            PooledCreditLineStatus.REQUESTED,
            false,
            borrower,
            false,
            'Borrower cannot terminate PCLs',
            'Ownable: caller is not the owner',
            PooledCreditLineStatus.REQUESTED
        );
    }

    /**************************************************************************************************************************************
    View/Calculation function tests
    **************************************************************************************************************************************/

    uint256 _currentCR;
    uint256 _collateralTokensToLiquidate;

    function assert_helper_functionalities_in_request_state(
        uint256 _id,
        uint256 _noOfLenders,
        uint128 _amountToLend,
        uint256 _travelDuration
    ) public {
        createMultipleLenders(_id, _noOfLenders, _amountToLend, request.borrowAsset);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;
        vm.warp(block.timestamp + _travelDuration);

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);

        // 1. calculatePrincipalWithdrawable
        uint256 _userLiquidity = lp.balanceOf(address(_lender), _id);
        emit log_named_uint('_userLiquidity: ', _userLiquidity);
        uint256 _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
        if (_amountToLend < request.minBorrowAmount) {
            assertEq(_principalWithdrawable, _userLiquidity);
        } else {
            assertEq(_principalWithdrawable, 0);
        }

        // 2. withdrawableCollateral
        uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertEq(_withdrawableCollateral, 0);

        // 3. calculateTotalCollateralTokens
        uint256 _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
        assertEq(_totalCollateral, 0);

        // 4. calculateBorrowableAmount
        uint256 _totalBorrowable = _borrower.calculateBorrowableAmount(_id);
        assertEq(_totalBorrowable, 0);

        {
            // 5. calculateInterestAccrued
            assertEq(_borrower.calculateInterestAccrued(_id), 0);
        }

        {
            // 6. calculateCurrentDebt
            assertEq(_borrower.calculateCurrentDebt(_id), 0);
        }

        // 7. calculateCurrentCollateralRatio
        _currentCR = _borrower.calculateCurrentCollateralRatio(_id);
        assertEq(_currentCR, uint256(-1));

        // 8. collateralTokensToLiquidate
        _collateralTokensToLiquidate = _borrower.collateralTokensToLiquidate(_id, 0);
        assertEq(_collateralTokensToLiquidate, 0);
    }

    function test_helperFunctionsInRequestedState(uint128 _amountToLend) public {
        _amountToLend = scaleToRange128(_amountToLend, 1, uint128(request.borrowLimit - 1));

        assert_helper_functionalities_in_request_state(requestId, 6, _amountToLend, request.collectionPeriod + 2 days);
    }

    /**************************************************************************************************************************************
    Pool MockToken Transfer tests
    **************************************************************************************************************************************/

    function assert_pool_transfers_in_requested_state(
        uint256 _id,
        PCLUser _fromUser,
        PCLUser _toUser,
        bool _positiveCase,
        uint256 _fractionOfPTSupply,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        uint256 _fromUserPoolTokenSupply;
        uint256 _toUserPoolTokenSupply;
        uint256 _fromUserPoolTokenSupplyNew;
        uint256 _toUserPoolTokenSupplyNew;

        createMultipleLenders(_id, 4, uint128(request.minBorrowAmount + 10), request.borrowAsset);

        vm.warp(block.timestamp + request.collectionPeriod + 2 days);

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.REQUESTED);

        if (address(_fromUser) == address(0)) {
            _fromUser = PCLUser(lenders[0].lenderAddress);
        }
        if (address(_toUser) == address(0)) {
            _toUser = PCLUser(lenders[1].lenderAddress);
        }

        _fromUserPoolTokenSupplyOld = lp.balanceOf(address(_fromUser), _id);
        _toUserPoolTokenSupplyOld = lp.balanceOf(address(_toUser), _id);

        if (_positiveCase) {
            _fromUser.transferLPTokens(address(_toUser), _id, (_fromUserPoolTokenSupplyOld / _fractionOfPTSupply));

            _fromUserPoolTokenSupplyNew = lp.balanceOf(address(_fromUser), _id);
            _toUserPoolTokenSupplyNew = lp.balanceOf(address(_toUser), _id);

            assertEq(_fromUserPoolTokenSupplyNew, (_fromUserPoolTokenSupplyOld - (_fromUserPoolTokenSupplyOld / _fractionOfPTSupply)));
            assertEq(_toUserPoolTokenSupplyNew, ((_fromUserPoolTokenSupplyOld / _fractionOfPTSupply) + _toUserPoolTokenSupplyOld));
        } else {
            try _fromUser.transferLPTokens(address(_toUser), _id, _fromUserPoolTokenSupplyOld) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }

            _fromUserPoolTokenSupplyNew = lp.balanceOf(address(_fromUser), _id);
            _toUserPoolTokenSupplyNew = lp.balanceOf(address(_toUser), _id);

            assertEq(_fromUserPoolTokenSupplyOld, _fromUserPoolTokenSupplyNew);
            assertEq((_toUserPoolTokenSupplyNew - _toUserPoolTokenSupplyOld), 0);
        }
    }

    // Test 10.1:
    function test_poolTokenTransferToNonVerifiedUsersNotPossible() public {
        assert_pool_transfers_in_requested_state(
            requestId,
            PCLUser(address(0)),
            admin,
            false,
            1,
            'Admin should not be able to recieve pool tokens',
            'LP:IT3'
        );
    }

    // Test 10.2:
    function test_poolTokenTransferInRequestedStatePossible() public {
        assert_pool_transfers_in_requested_state(requestId, PCLUser(address(0)), PCLUser(address(0)), true, 1, '', '');
    }

    // Test 10.3:
    function test_partialPoolTokenTransferPossible() public {
        assert_pool_transfers_in_requested_state(requestId, PCLUser(address(0)), PCLUser(address(0)), true, 2, '', '');
    }

    function test_pooledCreditLine_onERC1155ReceivedHook() public {
        PCLUser _pooledCreditLineLender = new MaliciousLender(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(request.borrowAsset), address(_pooledCreditLineLender), request.borrowLimit);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(request.borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, request.borrowLimit) {
            revert('REVERT: should have reverted');
        } catch Error(string memory reason) {
            assertEq(reason, 'ReentrancyGuard: reentrant call');
        }
    }

    event PooledCreditLineCancelled(uint256 indexed id, CancellationStatus indexed reason);
    event WithdrawLiquidityOnCancel(uint256 indexed id, address indexed user, uint256 amount);

    function test_withdrawLiquidityAfterPclHasEnded() public {
        createMultipleLenders(requestId, 5, uint128(request.minBorrowAmount), request.borrowAsset);
        vm.warp(block.timestamp + request.collectionPeriod + request.duration);

        // make sure pcl cannot be started
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        vm.expectRevert(bytes('LP:S3'));
        _lender.start(requestId);

        uint256 _lenderLpBalance = lp.balanceOf(address(_lender), requestId);
        assertGe(_lenderLpBalance, 0);

        assertEq(lp.calculatePrincipalWithdrawable(requestId, address(_lender)), _lenderLpBalance);

        vm.expectEmit(true, true, false, true);
        emit PooledCreditLineCancelled(requestId, CancellationStatus.LENDER_NOT_STARTED_AT_END);
        vm.expectEmit(true, true, true, true);
        emit WithdrawLiquidityOnCancel(requestId, address(_lender), _lenderLpBalance);
        // liquidate
        _lender.withdrawLiquidity(requestId);
    }

    function test_withdrawLiquidityOnLowCollection() public {
        // lend less than minBorrowAmount
        createMultipleLenders(requestId, 5, uint128(request.minBorrowAmount) - 100, request.borrowAsset);
        // go to start time
        vm.warp(block.timestamp + request.collectionPeriod);

        // make sure pcl cannot be started
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        vm.expectRevert(bytes('LP:S4'));
        _lender.start(requestId);

        uint256 _lenderLpBalance = lp.balanceOf(address(_lender), requestId);
        assertGe(_lenderLpBalance, 0);
        assertEq(lp.calculatePrincipalWithdrawable(requestId, address(_lender)), _lenderLpBalance);

        vm.expectEmit(true, true, false, true);
        emit PooledCreditLineCancelled(requestId, CancellationStatus.LENDER_LOW_COLLECTION);
        vm.expectEmit(true, true, true, true);
        emit WithdrawLiquidityOnCancel(requestId, address(_lender), _lenderLpBalance);
        // liquidate
        _lender.withdrawLiquidity(requestId);
    }

    function test_withdrawLiquidityReverted() public {
        createMultipleLenders(requestId, 5, request.borrowLimit, request.borrowAsset);
        vm.warp(block.timestamp + request.collectionPeriod);

        // make sure pcl has not been started
        assertTrue(uint256(pcl.getStatusAndUpdate(requestId)) == 1);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _lenderLpBalance = lp.balanceOf(address(_lender), requestId);
        assertGe(_lenderLpBalance, 0);
        assertEq(lp.calculatePrincipalWithdrawable(requestId, address(_lender)), 0);

        vm.expectRevert(bytes('LP:IWL3'));
        _lender.withdrawLiquidity(requestId);
    }

    function test_externalUserCannotCreate() public {
        try
            lp.create(
                requestId,
                mockAdminVerifier1,
                address(borrowAsset),
                noYieldAddress,
                request.borrowLimit,
                request.minBorrowAmount,
                request.collectionPeriod,
                true
            )
        {
            revert('External user cannot create');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:OPCL1');
        }
    }

    function test_externalUserCannotTerminate() public {
        try lp.terminate(requestId, address(admin)) {
            revert('External user cannot terminate');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:OPCL1');
        }
    }

    function test_cannotLendZeroAmount() public {
        uint256 _amountToLend = 100;
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(borrowAsset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, 0) {
            revert('Lender cannot lend zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L1');
        }
    }

    function test_unverifiedLenderCannotLend() public {
        uint256 _amountToLend = 100;
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier2);

        admin.transferToken(address(borrowAsset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, _amountToLend) {
            revert('Unverified lender cannot lend');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L2');
        }
    }

    function test_cannotLendAfterCollectionPeriod() public {
        uint256 _amountToLend = 100;
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(borrowAsset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(borrowAsset), type(uint256).max);

        vm.warp(block.timestamp + request.collectionPeriod);

        try _pooledCreditLineLender.lend(requestId, _amountToLend) {
            revert('Lender cannot lend after collection period');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L3');
        }
    }

    function test_cannotLendIfBorrowLimitReached() public {
        createMultipleLenders(requestId, 5, request.borrowLimit, request.borrowAsset);

        uint256 _amountToLend = 100;
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(borrowAsset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, _amountToLend) {
            revert('Lender cannot lend if borrow limit is reached');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L4');
        }
    }

    function test_lenderCannotWithdrawInterest() public {
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.withdrawInterest(requestId) {
            revert('Lender cannot withdraw interest');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:WI1');
        }
    }

    function test_nonLenderCannotWithdrawLiquidationTokens() public {
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        try _pooledCreditLineLender.withdrawTokensAfterLiquidation(requestId) {
            revert('Non lender cannot withdraw liquidated collateral tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:WLC1');
        }
    }

    function test_lenderCannotWithdrawLiquidationTokens() public {
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.withdrawTokensAfterLiquidation(requestId) {
            revert('Lender cannot withdraw liquidated collateral tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    function test_cannotTransferLPTokensToSameAddress() public {
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(_lender), requestId, _balanceLender) {
            revert('Lender cannot transfer LP tokens to itself');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT1');
        }
    }

    function test_cannotTransferLPTokensToBorrower() public {
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(borrower), requestId, _balanceLender) {
            revert('Lender cannot transfer LP tokens to borrower');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT2');
        }
    }

    function test_cannotBurnPoolTokens() public {
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(0), requestId, _balanceLender) {
            revert('Lender cannot burn LP tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'ERC1155: transfer to the zero address');
        }
    }

    function test_cannotTransferNonTransferableLPTokens() public {
        request.areTokensTransferable = false;
        uint256 _requestId = borrower.createRequest(request);
        assertTrue(pcl.getStatusAndUpdate(_requestId) == PooledCreditLineStatus.REQUESTED);

        createMultipleLenders(_requestId, 5, request.borrowLimit - 100, request.borrowAsset);

        PCLUser _lenderFrom = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lenderFrom), _requestId);
        PCLUser _lenderTo = PCLUser(lenders[1].lenderAddress);

        try _lenderFrom.transferLPTokens(address(_lenderTo), _requestId, _balanceLender) {
            revert('Lender cannot transfer non transferable LP tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT5');
        }
    }
}
