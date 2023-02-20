// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../mocks/MockToken.sol';
import '../Helpers/PCLParent.t.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';

contract PCLCancelledStage is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;

    uint256 requestId;
    address lender_0;

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

        // Lend any amount lesser than the borrowLimit
        createMultipleLenders(requestId, 5, request.borrowLimit - 100, request.borrowAsset);

        // Let's travel a few days, but stay within the collection period
        vm.warp(block.timestamp + request.collectionPeriod / 2);

        // Borrower tries to cancel the PCL
        borrower.cancelRequest(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    /*************************************************************************************************************************************
    Start function calls
    *************************************************************************************************************************************/

    function assert_start_functionality_in_cancelled_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.start(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotStartACancelledPCL() public {
        assert_start_functionality_in_cancelled_state(requestId, admin, 'Admin cannot start a PCL in cancelled state', 'LP:S1');
    }

    function test_borrowerCannotStartACancelledPCL() public {
        assert_start_functionality_in_cancelled_state(requestId, borrower, 'Borrower cannot start a PCL in cancelled state', 'LP:S1');
    }

    function test_lenderCannotStartACancelledPCL() public {
        assert_start_functionality_in_cancelled_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot start a PCL in cancelled state',
            'LP:S1'
        );
    }

    /**************************************************************************************************************************************
    Cancel function tests
    **************************************************************************************************************************************/

    function assert_cancel_functionality_in_cancelled_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.cancelRequest(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotCancelACancelledPCL() public {
        assert_cancel_functionality_in_cancelled_state(requestId, admin, 'Admin cannot Cancel a PCL in cancelled state', 'PCL:OCLB1');
    }

    // The Borrower is trying to cancel a cancelled PCL, but cannot because address(borrower) is now address(0).
    // And therefore, he gets the OCLB1 error.
    // Discuss.
    function test_borrowerCannotCancelACancelledPCL() public {
        assert_cancel_functionality_in_cancelled_state(requestId, borrower, 'Borrower cannot Cancel a PCL in cancelled state', 'PCL:OCLB1');
    }

    // The Lender is trying to cancel a cancelled PCL, but cannot because address(lenders[0].lenderAddress) is now address(0).
    // And therefore, he gets the OCLB1 error.
    // Discuss.
    function test_lenderCannotCancelACancelledPCL() public {
        assert_cancel_functionality_in_cancelled_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot Cancel a PCL in cancelled state',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Close function calls
    *************************************************************************************************************************************/

    function assert_close_functionality_in_cancelled_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.close(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotCloseACancelledPCL() public {
        assert_close_functionality_in_cancelled_state(requestId, admin, 'Admin cannot close a cancelled PCL', 'PCL:OCLB1');
    }

    // The Borrower is trying to close a cancelled PCL, but cannot because address(borrower) is now address(0).
    // And therefore, he gets the OCLB1 error.
    // Discuss.
    function test_borrowerCannotCloseACancelledPCL() public {
        assert_close_functionality_in_cancelled_state(requestId, borrower, 'Borrower cannot close a cancelled PCL', 'PCL:OCLB1');
    }

    // The Lender is trying to close a cancelled PCL, but cannot because address(lenders[0].lenderAddress) is now address(0).
    // And therefore, he gets the OCLB1 error.
    // Discuss.
    function test_lenderCannotCloseACancelledPCL() public {
        assert_close_functionality_in_cancelled_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot close a cancelled PCL',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    WithdrawLiquidity function calls
    **************************************************************************************************************************************/

    function assert_withdraw_liquidity_functionality_in_cancelled_state(
        uint256 _id,
        PCLUser _user,
        bool _positiveCase,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        if (_positiveCase) {
            uint256 _poolTokenBalanceOld = lp.balanceOf(address(_user), _id);
            uint256 _borrowTokenBalanceOld = IERC20(request.borrowAsset).balanceOf(address(_user));
            _user.withdrawLiquidity(_id);
            uint256 _poolTokenBalanceNew = lp.balanceOf(address(_user), _id);
            uint256 _borrowTokenBalanceNew = IERC20(request.borrowAsset).balanceOf(address(_user));

            assertEq(_poolTokenBalanceOld, (_borrowTokenBalanceNew - _borrowTokenBalanceOld));
            assertEq(_poolTokenBalanceNew, 0);
        } else {
            try _user.withdrawLiquidity(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotWithdrawLiquidity() public {
        assert_withdraw_liquidity_functionality_in_cancelled_state(
            requestId,
            admin,
            false,
            'Admin cannot WithdrawLiquidity a PCL in cancelled state',
            'LP:IWL1'
        );
    }

    function test_borrowerCannotWithdrawLiquidity() public {
        assert_withdraw_liquidity_functionality_in_cancelled_state(
            requestId,
            borrower,
            false,
            'Borrower cannot WithdrawLiquidity a PCL in cancelled state',
            'LP:IWL1'
        );
    }

    function test_lenderCanWithdrawLiquidity() public {
        assert_withdraw_liquidity_functionality_in_cancelled_state(requestId, PCLUser(lenders[0].lenderAddress), true, '', '');
    }

    /**************************************************************************************************************************************
    Liquidate function tests
    **************************************************************************************************************************************/

    function assert_liquidate_functionality_in_cancelled_state(
        uint256 _id,
        bool _isLender,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        if (_isLender) {
            _user = PCLUser(lenders[0].lenderAddress);
        }

        try _user.liquidate(_id, true) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotLiquidateACancelledPCL() public {
        assert_liquidate_functionality_in_cancelled_state(requestId, false, admin, 'Admin cannot liquidate a cancelled PCL', 'LP:LIQ1');
    }

    function test_borrowerCannotLiquidateACancelledPCL() public {
        assert_liquidate_functionality_in_cancelled_state(
            requestId,
            false,
            borrower,
            'Borrower cannot liquidate a cancelled PCL',
            'LP:LIQ1'
        );
    }

    function test_lenderCannotLiquidateACancelledPCL() public {
        assert_liquidate_functionality_in_cancelled_state(
            requestId,
            true,
            PCLUser(address(0)),
            'Lender cannot liquidate a cancelled PCL',
            'PCL:L1'
        );
    }

    /**************************************************************************************************************************************
    Repay function tests
    **************************************************************************************************************************************/

    function assertRepayFunctionalityInCancelledState(
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotRepayACancelledPCL() public {
        assertRepayFunctionalityInCancelledState(requestId, admin, 'Admin cannot repay a cancelled PCL', 'PCL:REP2');
    }

    function test_borrowerCannotRepayACancelledPCL() public {
        assertRepayFunctionalityInCancelledState(requestId, borrower, 'Borrower cannot repay a cancelled PCL', 'PCL:REP2');
    }

    function test_lenderCannotRepayACancelledPCL() public {
        assertRepayFunctionalityInCancelledState(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot repay a cancelled PCL',
            'PCL:REP2'
        );
    }

    /**************************************************************************************************************************************
    Terminate function tests
    **************************************************************************************************************************************/

    function assert_terminate_functionality_in_cancelled_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.terminate(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotTerminateACancelledPCL() public {
        assert_terminate_functionality_in_cancelled_state(requestId, admin, 'Cannot terminate a cancelled PCL', 'PCL:CTCT1');
    }

    function test_borrowerCannotTerminateACancelledPCL() public {
        assert_terminate_functionality_in_cancelled_state(
            requestId,
            borrower,
            'Cannot terminate a cancelled PCL',
            'Ownable: caller is not the owner'
        );
    }

    function test_lenderCannotTerminateACancelledPCL() public {
        assert_terminate_functionality_in_cancelled_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot terminate a cancelled PCL',
            'Ownable: caller is not the owner'
        );
    }

    /**************************************************************************************************************************************
    Deposit collateral function tests
    **************************************************************************************************************************************/

    function assert_collateralCannotBeDepositedInCancelledState(
        uint256 _id,
        uint256 _amount,
        PCLUser _depositor,
        bool _isDepositorLender
    ) public {
        if (_isDepositorLender) {
            _depositor = PCLUser(lenders[0].lenderAddress);
        }

        admin.transferToken(address(collateralAsset), address(_depositor), _amount);
        _depositor.setAllowance(address(pcl), address(collateralAsset), _amount);

        try _depositor.depositCollateral(_id, _amount, false) {
            revert('Collateral cannot be deposited in the CANCELLED state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    function test_borrowerCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInCancelledState(requestId, _amountToDeposit, borrower, true);
    }

    function test_lenderCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInCancelledState(requestId, _amountToDeposit, PCLUser(address(0)), true);
    }

    function test_adminCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInCancelledState(requestId, _amountToDeposit, admin, false);
    }

    /*************************************************************************************************************************************
    Borrow function tests
    *************************************************************************************************************************************/

    function assertBorrowFunctionalityInCancelledState(
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
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotBorrow() public {
        assertBorrowFunctionalityInCancelledState(requestId, 1, admin, 'Admin cannot borrow a PCL in cancelled state', 'PCL:OCLB1');
    }

    function test_borrowerCannotBorrow() public {
        assertBorrowFunctionalityInCancelledState(requestId, 1, borrower, 'Borrower cannot borrow a PCL in cancelled state', 'PCL:OCLB1');
    }

    function test_lenderCannotBorrow() public {
        assertBorrowFunctionalityInCancelledState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot borrow a PCL in cancelled state',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Withdraw collateral function tests
    *************************************************************************************************************************************/

    function assertWithdrawCollateralFunctionalityInCancelledState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.withdrawAllCollateral(_id, false) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        try _user.withdrawCollateral(_id, _amount, false) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInCancelledState(
            requestId,
            1,
            admin,
            'Admin cannot withdraw collateral in cancelled state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInCancelledState(
            requestId,
            1,
            borrower,
            'Borrower cannot withdraw collateral in cancelled state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        assertWithdrawCollateralFunctionalityInCancelledState(
            requestId,
            0,
            borrower,
            'Borrower cannot withdraw collateral in cancelled state',
            'PCL:OCLB1'
        );
    }

    function test_lenderCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInCancelledState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot withdraw collateral in cancelled state',
            'PCL:OCLB1'
        );
    }

    /**************************************************************************************************************************************
    View/calculation function tests
    **************************************************************************************************************************************/

    function assert_helper_functionalities_in_cancelled_state(
        uint256 _id,
        PCLUser,
        PCLUser _borrower
    ) public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CANCELLED);

        // 1. calculatePrincipalWithdrawable
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _userLiquidity = lp.balanceOf(address(_lender), _id);
        uint256 _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
        assertEq(_userLiquidity, _principalWithdrawable);

        // 2. withdrawableCollateral
        uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertEq(_withdrawableCollateral, 0);

        // 3. calculateTotalCollateralTokens (testFail passes for this. This call breaks. Discuss.)
        try _borrower.calculateTotalCollateralTokens(_id) {
            revert('This call should not be working in CANCELLED state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTCT1');
        }

        // 4. calculateBorrowableAmount
        uint256 _totalBorrowable = _borrower.calculateBorrowableAmount(_id);
        assertEq(_totalBorrowable, 0);

        // 5. calculateInterestAccrued
        uint256 _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertEq(_interestAccrued, 0);

        // 6. calculateCurrentDebt
        uint256 _currentDebt = _borrower.calculateCurrentDebt(_id);
        assertEq(_currentDebt, 0);

        // Test Number 7 and 8 should ideally have been returning a revert string, but right now they return PO:IGUPT1
        // and that is because since all pclConstants are deleted, address(tokens) == address(0) which throws

        // 7. calculateCurrentCollateralRatio
        try _borrower.calculateCurrentCollateralRatio(_id) {
            revert('This call should not be working in CANCELLED state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }

        // 8. collateralTokensToLiquidate
        try _borrower.collateralTokensToLiquidate(_id, 0) {
            revert('This call should not be working in CANCELLED state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTTL1');
        }

        // 9. calculateTotalCollateralTokens
        try _borrower.calculateTotalCollateralTokens(_id) {
            revert('This call should not be working in CANCELLED state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTCT1');
        }
    }

    function test_helperFunctionInCancelledState() public {
        assert_helper_functionalities_in_cancelled_state(requestId, PCLUser(lenders[0].lenderAddress), borrower);
    }

    /*************************************************************************************************************************************
    WithdrawInterest function calls
    **************************************************************************************************************************************/

    function assert_withdraw_interest_functionality_in_cancelled_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CANCELLED);

        uint256 _poolTokenBalanceOld = lp.balanceOf(address(_user), _id);
        uint256 _borrowTokenBalanceOld = borrowAsset.balanceOf(address(_user));

        try _user.withdrawInterest(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        uint256 _poolTokenBalanceNew = lp.balanceOf(address(_user), _id);
        uint256 _borrowTokenBalanceNew = borrowAsset.balanceOf(address(_user));

        assertEq(_poolTokenBalanceOld, _poolTokenBalanceNew);
        assertEq(_borrowTokenBalanceNew, _borrowTokenBalanceOld);

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CANCELLED);
    }

    function test_adminCannotWithdrawInterestFromACancelledPCL() public {
        assert_withdraw_interest_functionality_in_cancelled_state(
            requestId,
            admin,
            'Should not have been able to withdraw interest',
            'LP:WI1'
        );
    }

    function test_borrowerCannotWithdrawInterestFromACancelledPCL() public {
        assert_withdraw_interest_functionality_in_cancelled_state(
            requestId,
            borrower,
            'Should not have been able to withdraw interest',
            'LP:WI1'
        );
    }

    function test_lenderCannotWithdrawInterestFromACancelledPCL() public {
        assert_withdraw_interest_functionality_in_cancelled_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Should not have been able to withdraw interest',
            'LP:WI1'
        );
    }

    /**************************************************************************************************************************************
    Pool MockToken Transfer function tests
    **************************************************************************************************************************************/

    uint256 _fromUserPoolTokenSupply;
    uint256 _toUserPoolTokenSupply;
    uint256 _fromUserPoolTokenSupplyNew;
    uint256 _toUserPoolTokenSupplyNew;
    uint256 _toInterestOwed;
    uint256 _fromInterestOwed;
    uint256 _fromBorrowTokenBalanceInitial;
    uint256 _toBorrowTokenBalanceInitial;

    function assert_pool_token_transfer_in_cancelled_stage(
        uint256 _id,
        uint256 _stateToAssert_1,
        PCLUser _fromUser,
        PCLUser _toUser,
        bool _positiveCase,
        uint256 _fractionOfPTSupply,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert_1);
        _fromUserPoolTokenSupply = lp.balanceOf(address(_fromUser), _id);
        _toUserPoolTokenSupply = lp.balanceOf(address(_toUser), _id);

        if (_positiveCase) {
            _fromInterestOwed = lp.getLenderInterestWithdrawable(_id, address(_fromUser));
            _toInterestOwed = lp.getLenderInterestWithdrawable(_id, address(_toUser));

            _fromBorrowTokenBalanceInitial = borrowAsset.balanceOf(address(_fromUser));
            _toBorrowTokenBalanceInitial = borrowAsset.balanceOf(address(_toUser));

            log_named_uint('From User Pool MockToken Supply', _fromUserPoolTokenSupply);
            log_named_uint('To User Pool MockToken Supply', _toUserPoolTokenSupply);
            log_named_uint('Amount to transfer', (_fromUserPoolTokenSupply / _fractionOfPTSupply));

            _fromUser.transferLPTokens(address(_toUser), _id, (_fromUserPoolTokenSupply / _fractionOfPTSupply));

            _fromUserPoolTokenSupplyNew = lp.balanceOf(address(_fromUser), _id);
            _toUserPoolTokenSupplyNew = lp.balanceOf(address(_toUser), _id);

            assertEq(_fromUserPoolTokenSupplyNew, (_fromUserPoolTokenSupply - (_fromUserPoolTokenSupply / _fractionOfPTSupply)));
            assertEq(_toUserPoolTokenSupplyNew, ((_fromUserPoolTokenSupply / _fractionOfPTSupply) + _toUserPoolTokenSupply));

            assertEq((borrowAsset.balanceOf(address(_toUser)) - _toBorrowTokenBalanceInitial), _toInterestOwed);
            assertEq((borrowAsset.balanceOf(address(_fromUser)) - _fromBorrowTokenBalanceInitial), _fromInterestOwed);
        } else {
            try _fromUser.transferLPTokens(address(_toUser), _id, _fromUserPoolTokenSupply) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }

            _fromUserPoolTokenSupplyNew = lp.balanceOf(address(_fromUser), _id);
            _toUserPoolTokenSupplyNew = lp.balanceOf(address(_toUser), _id);

            assertEq(_fromUserPoolTokenSupply, _fromUserPoolTokenSupplyNew);
            assertEq((_toUserPoolTokenSupplyNew - _toUserPoolTokenSupply), 0);
        }
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

    function test_lenderCannotLend() public {
        uint256 _amountToLend = 100;
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(borrowAsset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, _amountToLend) {
            revert('Lender cannot lend');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L3');
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
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.withdrawTokensAfterLiquidation(requestId) {
            revert('Lender cannot withdraw liquidated collateral tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWLC1');
        }
    }

    function test_cannotTransferLPTokensToSameAddress() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(_lender), requestId, _balanceLender) {
            revert('Lender cannot transfer LP tokens to itself');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT1');
        }
    }

    function test_cannotTransferLPTokensToNonVerifiedUser() public {
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier2);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(_pooledCreditLineLender), requestId, _balanceLender) {
            revert('Lender cannot transfer LP tokens to borrower');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT3');
        }
    }

    function test_cannotBurnPoolTokens() public {
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

    function test_poolTokenTransferComplete() public {
        assert_pool_token_transfer_in_cancelled_stage(
            requestId,
            6,
            PCLUser(lenders[0].lenderAddress),
            PCLUser(lenders[1].lenderAddress),
            true,
            1,
            '',
            ''
        );
    }

    function test_poolTokenTransferPartial() public {
        assert_pool_token_transfer_in_cancelled_stage(
            requestId,
            6,
            PCLUser(lenders[0].lenderAddress),
            PCLUser(lenders[1].lenderAddress),
            true,
            4,
            '',
            ''
        );
    }

    function test_poolTokenTransferToNonVerifiedUser() public {
        assert_pool_token_transfer_in_cancelled_stage(
            requestId,
            6,
            PCLUser(lenders[0].lenderAddress),
            admin,
            false,
            4,
            'Non-verified user should not be able to receive pool tokens',
            'LP:IT3'
        );
    }
}
