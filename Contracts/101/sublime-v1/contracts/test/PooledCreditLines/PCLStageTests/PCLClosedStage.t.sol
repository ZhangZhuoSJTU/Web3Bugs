// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../mocks/MockToken.sol';
import '../Helpers/PCLParent.t.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';

contract PCLClosedStage is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;

    uint256 requestId;

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

        // The below function will create the PCL request and then lenders lend the entire requested amount
        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        borrowAndRepay(requestId);

        // Now the PCL should be in the CLOSED state
        borrower.close(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function borrowAndRepay(uint256 _id) public {
        // Now we assert that we are in the ACTIVE state
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.ACTIVE);

        // Now the borrower finds out the collateral he is required to deposit
        uint256 _requiredCollateral = borrower.getRequiredCollateral(_id, request.borrowLimit);
        // & deposits the required collateral (this involves getting the collateral from the admin and giving allowance to the PCL)
        admin.transferToken(request.collateralAsset, address(borrower), _requiredCollateral);
        borrower.setAllowance(address(pcl), request.collateralAsset, _requiredCollateral);
        if (request.collateralRatio != 0) {
            borrower.depositCollateral(_id, _requiredCollateral, false);
        }

        // Now the borrower calculates the borrowable amount
        uint256 borrowableAmount = borrower.calculateBorrowableAmount(_id);
        // And borrows the borrowable amount
        borrower.borrow(_id, borrowableAmount);

        // Borrower decides to repay everything at mid-duration

        // Time travel to mid-duration
        vm.warp(block.timestamp + request.duration / 2);
        // Current Debt on the borrower
        uint256 currentDebt = borrower.calculateCurrentDebt(_id);
        // Borrower decides to repay the entire debt
        admin.transferToken(address(borrowAsset), address(borrower), currentDebt);
        borrower.setAllowance(address(pooledCreditLineAddress), address(borrowAsset), currentDebt);
        borrower.repay(_id, currentDebt);
    }

    /*************************************************************************************************************************************
    Start function calls
    *************************************************************************************************************************************/

    function assert_start_functionality_in_closed_state(
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotStartAClosedPCL() public {
        assert_start_functionality_in_closed_state(requestId, admin, 'Admin cannot start a PCL in closed state', 'LP:S1');
    }

    function test_borrowerCannotStartAClosedPCL() public {
        assert_start_functionality_in_closed_state(requestId, borrower, 'Borrower cannot start a PCL in closed state', 'LP:S1');
    }

    function test_lenderCannotStartAClosedPCL() public {
        assert_start_functionality_in_closed_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot start a PCL in closed state',
            'LP:S1'
        );
    }

    /*************************************************************************************************************************************
    Cancel function calls
    *************************************************************************************************************************************/

    function assert_cancel_functionality_in_closed_state(
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotCancelAClosedPCL() public {
        assert_cancel_functionality_in_closed_state(requestId, admin, 'Admin cannot cancel a PCL in closed state', 'PCL:OCLB1');
    }

    function test_borrowerCannotCancelAClosedPCL() public {
        assert_cancel_functionality_in_closed_state(requestId, borrower, 'Borrower cannot cancel a PCL in closed state', 'PCL:CR1');
    }

    function test_lenderCannotCancelAClosedPCL() public {
        assert_cancel_functionality_in_closed_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot cancel a PCL in closed state',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Close function calls
    *************************************************************************************************************************************/

    function assert_close_functionality_in_closed_state(
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotCloseAClosedPCL() public {
        assert_close_functionality_in_closed_state(requestId, admin, 'Admin cannot close a closed PCL', 'PCL:OCLB1');
    }

    function test_borrowerCannotCloseAClosedPCL() public {
        assert_close_functionality_in_closed_state(requestId, borrower, 'Borrower cannot close a closed PCL', 'PCL:C1');
    }

    function test_lenderCannotCloseAClosedPCL() public {
        assert_close_functionality_in_closed_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot close a closed PCL',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Deposit collateral function calls
    *************************************************************************************************************************************/

    function assert_collateralCannotBeDepositedInClosedState(
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
            revert('Collateral cannot be deposited in the CLOSED state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    function test_borrowerCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInClosedState(requestId, _amountToDeposit, borrower, true);
    }

    function test_lenderCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInClosedState(requestId, _amountToDeposit, PCLUser(address(0)), true);
    }

    function test_adminCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInClosedState(requestId, _amountToDeposit, admin, false);
    }

    /*************************************************************************************************************************************
    Borrow function tests
    *************************************************************************************************************************************/

    function assertBorrowFunctionalityInClosedState(
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotBorrow() public {
        assertBorrowFunctionalityInClosedState(requestId, 1, admin, 'Admin cannot borrow a PCL in closed state', 'PCL:OCLB1');
    }

    function test_borrowerCannotBorrowAClosedPCL() public {
        assertBorrowFunctionalityInClosedState(requestId, 1, borrower, 'Borrower cannot borrow a PCL in closed state', 'PCL:IB3');
    }

    function test_borrowerCannotBorrowZeroAmount() public {
        assertBorrowFunctionalityInClosedState(requestId, 0, borrower, 'Borrower cannot borrow a PCL in closed state', 'PCL:IB1');
    }

    function test_lenderCannotBorrow() public {
        assertBorrowFunctionalityInClosedState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot borrow a PCL in closed state',
            'PCL:OCLB1'
        );
    }

    /**************************************************************************************************************************************
    Repay function tests
    **************************************************************************************************************************************/

    function assertRepayFunctionalityInClosedState(
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

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotRepayAClosedPCL() public {
        assertRepayFunctionalityInClosedState(requestId, admin, 'Admin cannot repay a closed PCL', 'PCL:REP2');
    }

    function test_borrowerCannotRepayAClosedPCL() public {
        assertRepayFunctionalityInClosedState(requestId, borrower, 'Borrower cannot repay a closed PCL', 'PCL:REP2');
    }

    function test_lenderCannotRepayAClosedPCL() public {
        assertRepayFunctionalityInClosedState(requestId, PCLUser(lenders[0].lenderAddress), 'Lender cannot repay a closed PCL', 'PCL:REP2');
    }

    /*************************************************************************************************************************************
    Withdraw collateral function tests
    *************************************************************************************************************************************/

    function assertWithdrawCollateralFunctionalityInClosedState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage,
        string memory _errorMessageAll
    ) public virtual {
        if (pcl.withdrawableCollateral(_id) > 0 && _user == borrower) {
            uint256 _balanceBefore = collateralAsset.balanceOf(address(_user));
            _user.withdrawAllCollateral(_id, false);
            uint256 _balanceAfter = collateralAsset.balanceOf(address(_user));
            assertGe(_balanceAfter, _balanceBefore);
        } else {
            try _user.withdrawAllCollateral(_id, false) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessageAll);
            }
        }

        if (pcl.withdrawableCollateral(_id) >= _amount && _user == borrower && _amount != 0) {
            uint256 _balanceBefore = collateralAsset.balanceOf(address(_user));
            _user.withdrawCollateral(_id, _amount, false);
            uint256 _balanceAfter = collateralAsset.balanceOf(address(_user));
            assertApproxEqAbs(_balanceAfter - _balanceBefore, _amount, 2);
        } else {
            try _user.withdrawCollateral(_id, _amount, false) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInClosedState(
            requestId,
            1,
            admin,
            'Admin cannot withdraw collateral in closed state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInClosedState(
            requestId,
            1,
            borrower,
            'Borrower cannot withdraw collateral in closed state',
            'PCL:WC1',
            'PCL:WAC1'
        );
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        assertWithdrawCollateralFunctionalityInClosedState(
            requestId,
            0,
            borrower,
            'Borrower cannot withdraw collateral in closed state',
            'PCL:WC2',
            'PCL:WAC1'
        );
    }

    function test_lenderCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInClosedState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot withdraw collateral in closed state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCanWithdrawCollateral() public {
        // The below function will create the PCL request and then lenders lend the entire requested amount
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        borrowAndRepay(_id);
        vm.warp(block.timestamp + request.duration.mul(110).div(100));
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);

        uint256 _withdrawableCollateral = borrower.withdrawableCollateral(_id);
        emit log_named_uint('_withdrawableCollateral', _withdrawableCollateral);
        uint256 _startBalance = collateralAsset.balanceOf(address(borrower));
        if (request.collateralRatio != 0) {
            assertGt(_withdrawableCollateral, 0);
            borrower.withdrawAllCollateral(_id, false);
        }
        uint256 _finalBalance = collateralAsset.balanceOf(address(borrower));
        assertApproxEqRel(_finalBalance.sub(_startBalance), _withdrawableCollateral, 1e14);
    }

    /*************************************************************************************************************************************
    WithdrawLiquidity function calls
    **************************************************************************************************************************************/

    function assert_withdraw_liquidity_functionality_in_closed_state(
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

            assertGe((_borrowTokenBalanceNew - _borrowTokenBalanceOld), _poolTokenBalanceOld);
            assertEq(_poolTokenBalanceNew, 0);
        } else {
            try _user.withdrawLiquidity(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotWithdrawLiquidityFromAClosedPCL() public {
        assert_withdraw_liquidity_functionality_in_closed_state(
            requestId,
            admin,
            false,
            'Admin cannot WithdrawLiquidity a PCL in closed state',
            'LP:IWL1'
        );
    }

    function test_borrowerCannotWithdrawLiquidityFromAClosedPCL() public {
        assert_withdraw_liquidity_functionality_in_closed_state(
            requestId,
            borrower,
            false,
            'Borrower cannot WithdrawLiquidity a PCL in closed state',
            'LP:IWL1'
        );
    }

    function test_lenderCanWithdrawLiquidityFromAClosedPCL() public {
        assert_withdraw_liquidity_functionality_in_closed_state(requestId, PCLUser(lenders[0].lenderAddress), true, '', '');
    }

    /**************************************************************************************************************************************
    Liquidate function tests
    **************************************************************************************************************************************/

    function assert_liquidate_functionality_in_closed_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.liquidate(_id, true) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_adminCannotLiquidateAClosedPCL() public {
        assert_liquidate_functionality_in_closed_state(requestId, admin, 'Admin cannot liquidate a closed PCL', 'LP:LIQ1');
    }

    function test_borrowerCannotLiquidateAClosedPCL() public {
        assert_liquidate_functionality_in_closed_state(requestId, borrower, 'Borrower cannot liquidate a closed PCL', 'LP:LIQ1');
    }

    function test_lenderCannotLiquidateAClosedPCL() public {
        assert_liquidate_functionality_in_closed_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot liquidate a closed PCL',
            'PCL:L1'
        );
    }

    /*************************************************************************************************************************************
    WithdrawInterest function calls
    **************************************************************************************************************************************/

    function assert_withdraw_interest_functionality_in_closed_state(
        uint256 _id,
        PCLUser _user,
        string memory _errorMessage
    ) public {
        uint256 _userBorrowTokenBalancePreWithdraw = borrowAsset.balanceOf(address(_user));
        uint256 _userCollateralTokenBalancePreWithdraw = collateralAsset.balanceOf(address(_user));
        uint256 _userPoolTokenBalancePreWithdraw = lp.balanceOf(address(_user), _id);

        uint256 _lenderInterest = _user.getLenderInterest(_id, address(_user));

        try _user.withdrawInterest(_id) {
            uint256 _userCollateralTokenBalancePostWithdraw = collateralAsset.balanceOf(address(_user));
            uint256 _userBorrowTokenBalancePostWithdraw = borrowAsset.balanceOf(address(_user));
            uint256 _userPoolTokenBalancePostWithdraw = lp.balanceOf(address(_user), _id);

            if (_userPoolTokenBalancePreWithdraw == 0) {
                assertEq(_lenderInterest, 0);
                assertEq(_userBorrowTokenBalancePreWithdraw, _userBorrowTokenBalancePostWithdraw);
            } else {
                assertTrue(_lenderInterest != 0);
                assertApproxEqAbs((_userBorrowTokenBalancePostWithdraw - _userBorrowTokenBalancePreWithdraw), _lenderInterest, 2);
            }

            assertEq(_userPoolTokenBalancePreWithdraw, _userPoolTokenBalancePostWithdraw);
            assertEq(_userCollateralTokenBalancePostWithdraw, _userCollateralTokenBalancePreWithdraw);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
    }

    function test_adminCannotWithdrawInterestFromAClosedPCL() public {
        assert_withdraw_interest_functionality_in_closed_state(requestId, admin, 'LP:WI1');
    }

    function test_borrowerCannotWithdrawInterestFromAClosedPCL() public {
        assert_withdraw_interest_functionality_in_closed_state(requestId, borrower, 'LP:WI1');
    }

    function test_lenderCanWithdrawInterestFromAClosedPCL() public {
        assert_withdraw_interest_functionality_in_closed_state(requestId, PCLUser(lenders[0].lenderAddress), '');
    }

    /**************************************************************************************************************************************
    Terminate function tests
    **************************************************************************************************************************************/

    function assert_terminate_functionality_in_closed_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        if (_user != admin) {
            try _user.terminate(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        } else {
            _user.terminate(_id);
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.NOT_CREATED);
        }
    }

    function test_adminCanTerminateAClosedPCL() public {
        assert_terminate_functionality_in_closed_state(requestId, admin, '', '');
    }

    function test_borrowerCannotTerminateAClosedPCL() public {
        assert_terminate_functionality_in_closed_state(
            requestId,
            borrower,
            'Should not be able to terminate a closed PCL',
            'Ownable: caller is not the owner'
        );
    }

    function test_lenderCannotTerminateAClosedPCL() public {
        assert_terminate_functionality_in_closed_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Should not be able to terminate a closed PCL',
            'Ownable: caller is not the owner'
        );
    }

    uint256 _fromUserPoolTokenSupplyOld;
    uint256 _toUserPoolTokenSupplyOld;
    uint256 _fromUserPoolTokenSupplyNew;
    uint256 _toUserPoolTokenSupplyNew;
    uint256 _toInterestOwed;
    uint256 _fromInterestOwed;
    uint256 _fromBorrowTokenBalanceInitial;
    uint256 _toBorrowTokenBalanceInitial;

    /**************************************************************************************************************************************
    Pool MockToken Transfer function tests
    **************************************************************************************************************************************/

    function assert_pool_token_transfer_in_closed_stage(
        uint256 _id,
        PCLUser _fromUser,
        PCLUser _toUser,
        bool _positiveCase,
        uint256 _fractionOfPTSupply,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);

        _fromUserPoolTokenSupplyOld = lp.balanceOf(address(_fromUser), _id);
        _toUserPoolTokenSupplyOld = lp.balanceOf(address(_toUser), _id);

        if (_positiveCase) {
            _fromInterestOwed = lp.getLenderInterestWithdrawable(_id, address(_fromUser));
            _toInterestOwed = lp.getLenderInterestWithdrawable(_id, address(_toUser));

            _fromBorrowTokenBalanceInitial = borrowAsset.balanceOf(address(_fromUser));
            _toBorrowTokenBalanceInitial = borrowAsset.balanceOf(address(_toUser));

            _fromUser.transferLPTokens(address(_toUser), _id, (_fromUserPoolTokenSupplyOld / _fractionOfPTSupply));

            _fromUserPoolTokenSupplyNew = lp.balanceOf(address(_fromUser), _id);
            _toUserPoolTokenSupplyNew = lp.balanceOf(address(_toUser), _id);

            assertEq(_fromUserPoolTokenSupplyNew, (_fromUserPoolTokenSupplyOld - (_fromUserPoolTokenSupplyOld / _fractionOfPTSupply)));
            assertEq(_toUserPoolTokenSupplyNew, ((_fromUserPoolTokenSupplyOld / _fractionOfPTSupply) + _toUserPoolTokenSupplyOld));

            assertEq((borrowAsset.balanceOf(address(_toUser)) - _toBorrowTokenBalanceInitial), _toInterestOwed);
            assertEq((borrowAsset.balanceOf(address(_fromUser)) - _fromBorrowTokenBalanceInitial), _fromInterestOwed);
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

    function test_poolTokenTransferComplete() public {
        assert_pool_token_transfer_in_closed_stage(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            PCLUser(lenders[1].lenderAddress),
            true,
            1,
            '',
            ''
        );
    }

    function test_poolTokenTransferPartial() public {
        assert_pool_token_transfer_in_closed_stage(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            PCLUser(lenders[1].lenderAddress),
            true,
            4,
            '',
            ''
        );
    }

    function test_poolTokenTransferToNonVerifiedUser() public {
        assert_pool_token_transfer_in_closed_stage(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            admin,
            false,
            4,
            'Non-verified user should not be able to receive pool tokens',
            'LP:IT3'
        );
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

    function test_lenderCannotWithdrawZeroInterest() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        uint256 _lenderInterestOwed = lp.getLenderInterestWithdrawable(requestId, address(_lender));
        assertGt(_lenderInterestOwed, 0);

        uint256 _startBalance = borrowAsset.balanceOf(address(_lender));
        _lender.withdrawInterest(requestId);
        uint256 _finalBalance = borrowAsset.balanceOf(address(_lender));
        assertEq(_finalBalance.sub(_startBalance), _lenderInterestOwed);
        _lenderInterestOwed = lp.getLenderInterestWithdrawable(requestId, address(_lender));
        assertEq(_lenderInterestOwed, 0);

        try _lender.withdrawInterest(requestId) {
            revert('Lender cannot withdraw zero interest');
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

    function test_cannotTransferLPTokensToBorrower() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(borrower), requestId, _balanceLender) {
            revert('Lender cannot transfer LP tokens to borrower');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT2');
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
        (uint256 _requestId, ) = goToActiveStage(10, request.borrowLimit);

        vm.warp(block.timestamp + request.duration);
        borrower.close(_requestId);
        assertTrue(pcl.getStatusAndUpdate(_requestId) == PooledCreditLineStatus.CLOSED);

        PCLUser _lenderFrom = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lenderFrom), _requestId);
        PCLUser _lenderTo = PCLUser(lenders[1].lenderAddress);

        try _lenderFrom.transferLPTokens(address(_lenderTo), _requestId, _balanceLender) {
            revert('Lender cannot transfer non transferable LP tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT5');
        }
    }

    /**************************************************************************************************************************************
    View/calculation function tests
    **************************************************************************************************************************************/

    function assert_helper_functionalities_in_closed_state(
        uint256 _id,
        PCLUser _lender,
        PCLUser _borrower
    ) public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);

        // 1. calculatePrincipalWithdrawable
        uint256 _userLiquidity = lp.balanceOf(address(_lender), _id);
        uint256 _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
        assertGe(_principalWithdrawable, _userLiquidity);
        _lender.withdrawLiquidity(_id);
        uint256 newBalance = IERC20(request.borrowAsset).balanceOf(address(_lender));
        assertGe(newBalance, _userLiquidity);

        // 2. withdrawableCollateral
        uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        uint256 _oneUnitOfCollateral = 10**(ERC20(address(collateralAsset)).decimals());
        assertLe(_withdrawableCollateral, _oneUnitOfCollateral / 1e6);

        // 3.calculateTotalCollateralTokens
        uint256 _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
        assertLe(_totalCollateral, _oneUnitOfCollateral / 1e6);

        // 4. calculateBorrowableAmount
        uint256 _totalBorrowable = _borrower.calculateBorrowableAmount(_id);
        assertEq(_totalBorrowable, 0); // Since PCL is closed now

        // 5. calculateInterestAccrued
        uint256 _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertGe(_interestAccrued, 0); // Should be non-zero, since it calculates interest accrued since last repayment

        // 6. calculateCurrentDebt
        uint256 _currentDebt = _borrower.calculateCurrentDebt(_id);
        assertEq(_currentDebt, 0); // Should be zero, since PCL is completely paid off

        // Test Number 7 and 8 should ideally have been returning a revert string, but right now they return PO:IGUPT1
        // and that is because since all pclConstants are deleted, address(tokens) == address(0) which throws

        // 7. calculateCurrentCollateralRatio
        try _borrower.calculateCurrentCollateralRatio(_id) {
            uint256 _currentCR = _borrower.calculateCurrentCollateralRatio(_id);
            assertEq(_currentCR, uint256(-1)); // infinite since no collateral present in the PCL
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }

        // 8. collateralTokensToLiquidate
        try _borrower.collateralTokensToLiquidate(_id, 0) {
            uint256 _collateralTokensToLiquidate = _borrower.collateralTokensToLiquidate(_id, 0);
            assertEq(_collateralTokensToLiquidate, 0); // should be zero, since this PCL cannot be liquidated now
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }
    }

    function test_helperFunctionInClosedState() public {
        assert_helper_functionalities_in_closed_state(requestId, PCLUser(lenders[0].lenderAddress), borrower);
    }
}
