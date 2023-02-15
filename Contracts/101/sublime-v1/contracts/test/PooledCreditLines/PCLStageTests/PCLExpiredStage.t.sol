// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../../SublimeProxy.sol';
import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../PooledCreditLine/LenderPool.sol';
import '../../../PriceOracle.sol';
import '../../../SavingsAccount/SavingsAccount.sol';
import '../../../yield/StrategyRegistry.sol';
import '../../../yield/NoYield.sol';
import '../../../yield/CompoundYield.sol';
import '../../../mocks/MockWETH.sol';
import '../../../mocks/MockCToken.sol';
import '../../../mocks/MockVerification2.sol';
import '../../../mocks/MockV3Aggregator.sol';
import '../../../mocks/MockToken.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '../../../interfaces/ISavingsAccount.sol';

import '../Helpers/PCLParent.t.sol';

contract PCLExpiredStage is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    uint256 requestId;

    function setUp() public virtual override {
        super.setUp();

        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((1 * pcl.SCALING_FACTOR()) / 1e2);
        request.collateralRatio = pcl.SCALING_FACTOR();
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 5000 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 3650 days;
        request.gracePenaltyRate = (10 * pcl.SCALING_FACTOR()) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);
        assertEq(uint256(pcl.getStatusAndUpdate(requestId)), uint256(1));

        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        // Now the borrower finds out the collateral he is required to deposit
        uint256 _requiredCollateral = borrower.getRequiredCollateral(requestId, request.borrowLimit);
        // & deposits the required collateral (this involves getting the collateral from the admin and giving allowance to the PCL)
        admin.transferToken(request.collateralAsset, address(borrower), _requiredCollateral);
        borrower.setAllowance(address(pcl), request.collateralAsset, type(uint256).max);
        borrower.depositCollateral(requestId, _requiredCollateral, false);

        // Now the borrower calculates the borrowable amount
        uint256 borrowableAmount = borrower.calculateBorrowableAmount(requestId);
        // and borrows the borrowable amount
        borrower.borrow(requestId, borrowableAmount);

        // Borrower decides to repay everything at mid-duration

        // Time travel to mid-duration
        vm.warp(block.timestamp + request.duration / 2);
        // Current Debt on the borrower
        uint256 currentDebt = borrower.calculateCurrentDebt(requestId);
        // Borrower decides to repay partial debt
        admin.transferToken(address(borrowAsset), address(borrower), currentDebt);
        borrower.setAllowance(address(pooledCreditLineAddress), address(borrowAsset), type(uint256).max);
        borrower.repay(requestId, currentDebt / 2);

        // Now we travel past the duration to the expiration period
        vm.warp(block.timestamp + 100 + request.duration / 2);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.EXPIRED, '!Expired');
    }

    // Test0: Test SetUp
    function test_SetUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.EXPIRED, '!Expired');
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // START function calls
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Test1: Expired PCL cannot be started
    function assert_start_functionality_in_expired_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertString,
        string memory _errorString
    ) public {
        try _user.start(_id) {
            revert(_revertString);
        } catch Error(string memory reason) {
            assertEq(reason, _errorString);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);
    }

    function test_adminCannotStartAnExpiredPCL() public {
        assert_start_functionality_in_expired_state(requestId, admin, 'Admin cannot start a PCL in expired state', 'LP:S1');
    }

    function test_borrowerCannotStartAnExpiredPCL() public {
        assert_start_functionality_in_expired_state(requestId, borrower, 'Borrower cannot start a PCL in expired state', 'LP:S1');
    }

    function test_lenderCannotStartAnExpiredPCL() public {
        assert_start_functionality_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot start a PCL in expired state',
            'LP:S1'
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // CANCEL function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_cancel_functionality_in_expired_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);
    }

    function test_adminCannotCancelAnExpiredPCL() public {
        assert_cancel_functionality_in_expired_state(requestId, admin, 'Admin cannot Cancel a PCL in expired state', 'PCL:OCLB1');
    }

    function test_borrowerCannotCancelAnExpiredPCL() public {
        assert_cancel_functionality_in_expired_state(requestId, borrower, 'Borrower cannot Cancel a PCL in expired state', 'PCL:CR1');
    }

    function test_lenderCannotCancelAnExpiredPCL() public {
        assert_cancel_functionality_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot Cancel a PCL in expired state',
            'PCL:OCLB1'
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // CLOSE function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_close_functionality_in_expired_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);
    }

    function assert_close_functionality_in_expired_state_zero_debt(uint256 _id, PCLUser _user) public {
        (, _principal, , , ) = pcl.pooledCreditLineVariables(_id);
        assertTrue(_principal != 0);

        _currentDebt = borrower.calculateCurrentDebt(_id);
        admin.transferToken(address(borrowAsset), address(borrower), _currentDebt * 10);

        // Borrower wants to repay everything now
        borrower.repay(_id, _currentDebt);

        (, _principal, , , ) = pcl.pooledCreditLineVariables(_id);
        assertTrue(_principal == 0, 'principal != 0');
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CLOSED, '!Closed');

        try _user.close(_id) {
            revert('Cannot go through when entire debt is repaid');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:C1');
        }
    }

    function test_adminCannotCloseAnExpiredPCL() public {
        assert_close_functionality_in_expired_state(requestId, admin, 'Admin cannot close a expired PCL', 'PCL:OCLB1');
    }

    // If the principal != 0
    function test_borrowerCannotCloseAnExpiredPCL() public {
        assert_close_functionality_in_expired_state(requestId, borrower, 'Borrower cannot close a expired PCL', 'PCL:C2');
    }

    // If the principal == 0
    function test_borrowerCanCloseAnExpiredPCL_principalIsZero() public {
        assert_close_functionality_in_expired_state_zero_debt(requestId, borrower);
    }

    function test_lenderCannotCloseAnExpiredPCL() public {
        assert_close_functionality_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot close a expired PCL',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Deposit collateral function calls
    *************************************************************************************************************************************/

    function assert_collateralCanBeDepositedInExpiredState(
        uint256 _id,
        uint256 _amount,
        PCLUser _depositor,
        bool _isDepositorLender
    ) public {
        if (_isDepositorLender) {
            _depositor = PCLUser(lenders[0].lenderAddress);
        }

        admin.transferToken(address(collateralAsset), address(_depositor), _amount);
        if (_depositor != borrower) {
            _depositor.setAllowance(address(pcl), address(collateralAsset), _amount);
        }
        uint256 _collateralShares = pcl.depositedCollateralInShares(_id);
        _depositor.depositCollateral(_id, _amount, false);
        assertGt(pcl.depositedCollateralInShares(_id), _collateralShares);
    }

    function test_borrowerCanDepositCollateral() public {
        uint256 _amountToDeposit = 100 * (10**ERC20(address(collateralAsset)).decimals());
        assert_collateralCanBeDepositedInExpiredState(requestId, _amountToDeposit, borrower, true);
    }

    function test_lenderCanDepositCollateral() public {
        uint256 _amountToDeposit = 100 * (10**ERC20(address(collateralAsset)).decimals());
        assert_collateralCanBeDepositedInExpiredState(requestId, _amountToDeposit, PCLUser(address(0)), true);
    }

    function test_adminCanDepositCollateral() public {
        uint256 _amountToDeposit = 100 * (10**ERC20(address(collateralAsset)).decimals());
        assert_collateralCanBeDepositedInExpiredState(requestId, _amountToDeposit, admin, false);
    }

    /*************************************************************************************************************************************
    Borrow function tests
    *************************************************************************************************************************************/

    function assertBorrowFunctionalityInExpiredState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        uint256 _stateToAssert,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.borrow(_id, _amount) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert);
    }

    function test_adminCannotBorrow() public {
        assertBorrowFunctionalityInExpiredState(
            requestId,
            1,
            admin,
            uint256(PooledCreditLineStatus.EXPIRED),
            'Admin cannot borrow a PCL in expired state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotBorrow() public {
        assertBorrowFunctionalityInExpiredState(
            requestId,
            1,
            borrower,
            uint256(PooledCreditLineStatus.EXPIRED),
            'Borrower cannot borrow a PCL in expired state',
            'PCL:IB3'
        );
    }

    function test_lenderCannotBorrow() public {
        assertBorrowFunctionalityInExpiredState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.EXPIRED),
            'Lender cannot borrow a PCL in expired state',
            'PCL:OCLB1'
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Repayment function tests
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_repayment_functionality_in_expired_state(
        uint256 _id,
        uint256 _repaymentAmount,
        string memory _errorMessage,
        PCLUser _user
    ) public {
        // Admin transfers some borrow token to the _user for repayment
        uint256 _adminBorrowAssetBalance = borrowAsset.balanceOf(address(admin));

        log_named_uint('Admin Borrow Asset Balance', _adminBorrowAssetBalance);
        log_named_address('borrower', address(borrower));

        admin.transferToken(address(borrowAsset), address(_user), (_adminBorrowAssetBalance / 10));
        if (_user != borrower) {
            _user.setAllowance(address(pcl), address(borrowAsset), uint256(-1));
        }
        try _user.repay(_id, _repaymentAmount) {
            log_string('Repayment successful');
        } catch Error(string memory reason) {
            log_named_string('Error', reason);
            assertEq(reason, _errorMessage);
        }
    }

    function test_borrowerCannotRepayZeroAmount() public {
        assert_repayment_functionality_in_expired_state(requestId, 0, 'PCL:REP1', borrower);
    }

    function test_borrowerCannotRepayIfDebtIsZero() public {
        // Repaying the remaining debt so that current debt == 0
        _currentDebt = pcl.calculateCurrentDebt(requestId);
        log_named_uint('Current debt', _currentDebt);

        admin.transferToken(address(borrowAsset), address(borrower), (_currentDebt));
        borrower.repay(requestId, _currentDebt);

        // Travelling some more so that interest gets accrued and we do not get PCL:REP3
        helper_timeWarp(block.timestamp + request.defaultGracePeriod / 2);

        // Now since the entire repayment is done in the EXPIRED state, the PCL goes into CLOSED state.
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);

        // Admin transfers some borrow token to the _user for repayment
        uint256 _adminBorrowAssetBalance = borrowAsset.balanceOf(address(admin));
        admin.transferToken(address(borrowAsset), address(borrower), (_adminBorrowAssetBalance / 10));

        try borrower.repay(requestId, 10**4) {
            log_string('Repayment successful');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:REP2');
        }
    }

    function test_borrowerCannotRepayIfInterestAccruedIsZero() public {
        uint256 _interestRemaining = pcl.calculateInterestAccrued(requestId);

        admin.transferToken(address(borrowAsset), address(borrower), (_interestRemaining));
        borrower.repay(requestId, _interestRemaining);

        assert_repayment_functionality_in_expired_state(requestId, 10**10, 'PCL:REP4', borrower);
    }

    function test_adminCanRepay() public {
        // Travelling so that some interest gets accrued
        helper_timeWarp(block.timestamp + request.defaultGracePeriod / 2);

        // Repaying the remaining debt so that current debt == 0
        _currentDebt = pcl.calculateCurrentDebt(requestId);
        log_named_uint('Current debt', _currentDebt);

        assert_repayment_functionality_in_expired_state(requestId, _currentDebt, '', admin);
    }

    function test_lenderCanRepay() public {
        // Travelling so that some interest gets accrued
        helper_timeWarp(block.timestamp + request.defaultGracePeriod / 2);

        // Repaying the remaining debt so that current debt == 0
        _currentDebt = pcl.calculateCurrentDebt(requestId);
        log_named_uint('Current debt', _currentDebt);

        assert_repayment_functionality_in_expired_state(requestId, _currentDebt, '', PCLUser(lenders[0].lenderAddress));
    }

    function test_borrowerCanRepay() public {
        // Travelling so that some interest gets accrued
        helper_timeWarp(block.timestamp + request.defaultGracePeriod / 2);

        // Repaying the remaining debt so that current debt == 0
        _currentDebt = pcl.calculateCurrentDebt(requestId);
        log_named_uint('Current debt', _currentDebt);

        assert_repayment_functionality_in_expired_state(requestId, _currentDebt, '', borrower);
    }

    /*************************************************************************************************************************************
    Withdraw collateral function tests
    *************************************************************************************************************************************/

    function assertWithdrawCollateralFunctionalityInExpiredState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        uint256 _stateToAssert,
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

        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert);
    }

    function test_adminCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInExpiredState(
            requestId,
            1,
            admin,
            uint256(PooledCreditLineStatus.EXPIRED),
            'Admin cannot withdraw collateral in expired state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInExpiredState(
            requestId,
            1,
            borrower,
            uint256(PooledCreditLineStatus.EXPIRED),
            'Borrower cannot withdraw collateral in expired state',
            'PCL:WC1',
            'PCL:WAC1'
        );
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        assertWithdrawCollateralFunctionalityInExpiredState(
            requestId,
            0,
            borrower,
            uint256(PooledCreditLineStatus.EXPIRED),
            'Borrower cannot withdraw zero collateral in expired state',
            'PCL:WC2',
            'PCL:WAC1'
        );
    }

    function test_lenderCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInExpiredState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.EXPIRED),
            'Lender cannot withdraw collateral in expired state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    WithdrawLiquidity function calls
    **************************************************************************************************************************************/

    function assert_withdraw_liquidity_functionality_in_expired_state(
        uint256 _id,
        PCLUser _user,
        uint256 _stateToAssert,
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

        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert);
    }

    function test_adminCannotWithdrawLiquidity() public {
        assert_withdraw_liquidity_functionality_in_expired_state(
            requestId,
            admin,
            uint256(PooledCreditLineStatus.EXPIRED),
            false,
            'Admin cannot withdraw liquidity a PCL in expired state',
            'LP:IWL1'
        );
    }

    function test_borrowerCannotWithdrawLiquidity() public {
        assert_withdraw_liquidity_functionality_in_expired_state(
            requestId,
            borrower,
            uint256(PooledCreditLineStatus.EXPIRED),
            false,
            'Borrower cannot withdraw liquidity a PCL in expired state',
            'LP:IWL1'
        );
    }

    function test_lenderCannotWithdrawLiquidity() public {
        assert_withdraw_liquidity_functionality_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.EXPIRED),
            false,
            'Lender cannot withdraw liquidity a PCL in expired state',
            'LP:IWL3'
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // LIQUIDATE function calls
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_liquidate_functionality_in_expired_state(
        uint256 _id,
        PCLUser _user,
        bool _positiveCase,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        if (_positiveCase) {
            _user.liquidate(_id, true);
            assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
        } else {
            try _user.liquidate(_id, true) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
                assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);
            }
        }
    }

    function test_adminCannotLiquidateAnExpiredPCL() public {
        assert_liquidate_functionality_in_expired_state(requestId, admin, false, 'Admin cannot liquidate an expired PCL', 'LP:LIQ1');
    }

    function test_borrowerCannotLiquidateAnExpiredPCL() public {
        assert_liquidate_functionality_in_expired_state(requestId, borrower, false, 'Borrower cannot liquidate an expired PCL', 'LP:LIQ1');
    }

    function test_lenderCannotLiquidateAnExpiredPCL_underDefaultsAtTimePeriod() public {
        assert_liquidate_functionality_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            false,
            'If under defaultsAt time period, must not go through',
            'PCL:L3'
        );
    }

    function test_lenderCanLiquidateAnExpiredPCL_afterDefaultsAtTimePeriod() public {
        helper_timeWarp(block.timestamp + request.defaultGracePeriod);
        // (, , , , , , , , _defaultTimeStamp, , , ) = pcl.pooledCreditLineConstants(requestId);
        // assertTrue(block.timestamp >= _defaultTimeStamp, '!Still not past default time');

        assert_liquidate_functionality_in_expired_state(requestId, PCLUser(lenders[0].lenderAddress), true, '', '');
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Terminate function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_terminate_functionality_in_expired_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        uint256 _userBorrowTokenBalancePreTerminate = borrowAsset.balanceOf(address(_user));
        uint256 _userCollateralTokenBalancePreTerminate = collateralAsset.balanceOf(address(_user));

        try _user.terminate(_id) {
            uint256 _userBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(_user));
            uint256 _userCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(_user));

            if (_user == admin) {
                assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
                assertTrue((_userBorrowTokenBalancePreTerminate < _userBorrowTokenBalancePostTerminate) == true);
                if (request.collateralRatio != 0) {
                    assertTrue((_userCollateralTokenBalancePreTerminate < _userCollateralTokenBalancePostTerminate) == true);
                }
            } else {
                assertTrue(
                    (_userBorrowTokenBalancePreTerminate == _userBorrowTokenBalancePostTerminate) ==
                        (_userCollateralTokenBalancePreTerminate == _userCollateralTokenBalancePostTerminate) ==
                        true
                );
                revert(_revertMessage);
            }
        } catch Error(string memory reason) {
            uint256 _userBorrowTokenBalancePostTerminate = borrowAsset.balanceOf(address(_user));
            uint256 _userCollateralTokenBalancePostTerminate = collateralAsset.balanceOf(address(_user));

            assertTrue((_userBorrowTokenBalancePreTerminate == _userBorrowTokenBalancePostTerminate) == true);
            assertTrue((_userCollateralTokenBalancePreTerminate == _userCollateralTokenBalancePostTerminate) == true);

            assertEq(reason, _errorMessage);
            assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);
        }
    }

    function test_adminCanTerminateAnExpiredPCL() public {
        assert_terminate_functionality_in_expired_state(requestId, admin, '', '');
    }

    function test_adminCanTerminateAnExpiredPCL_beyondDefaultTimeStamp() public {
        helper_timeWarp(block.timestamp + request.defaultGracePeriod);

        // (, , , , , , , , _defaultTimeStamp, , , ) = pcl.pooledCreditLineConstants(requestId);

        // assertTrue(block.timestamp >= _defaultTimeStamp, '!Still not past default time');

        assert_terminate_functionality_in_expired_state(requestId, admin, '', '');
    }

    function test_borrowerCannotTerminateAnExpiredPCL() public {
        assert_terminate_functionality_in_expired_state(
            requestId,
            borrower,
            'Cannot terminate a PCL that is expired',
            'Ownable: caller is not the owner'
        );
    }

    function test_lenderCannotTerminateAnExpiredPCL() public {
        assert_terminate_functionality_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot terminate a PCL that is expired',
            'Ownable: caller is not the owner'
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Pool Token Transfer function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    uint256 lender0PoolTokenBalance;
    uint256 lender1PoolTokenBalance;
    uint256 lender2PoolTokenBalance;
    uint256 lender3PoolTokenBalance;
    uint256 _from1BalancePostBurn;
    uint256 lender0PoolTokenBalanceFinal;
    uint256 lender1PoolTokenBalanceFinal;
    uint256 lender2PoolTokenBalanceFinal;
    uint256 lender3PoolTokenBalanceFinal;
    uint256 _defaultTimeStamp;
    uint256 _originalPrice;
    uint256 _modifiedPrice;

    PCLUser _from1;
    PCLUser _from2;
    PCLUser _to1;
    PCLUser _to2;

    function assert_pool_token_transfer_in_expired_stage(
        uint256 _id,
        uint256 _fractionOfPTSupply,
        bool _positiveCase,
        address _From1,
        address _From2,
        address _To1,
        address _To2,
        string memory _errorString
    ) public {
        _from1 = PCLUser(_From1);
        _from2 = PCLUser(_From2);
        _to1 = PCLUser(_To1);
        _to2 = PCLUser(_To2);

        if (_positiveCase) {
            // Ensuring that these lenders indeed had lent something
            lender0PoolTokenBalance = lp.balanceOf(address(_from1), _id);
            lender1PoolTokenBalance = lp.balanceOf(address(_to1), _id);
            lender2PoolTokenBalance = lp.balanceOf(address(_from2), _id);
            lender3PoolTokenBalance = lp.balanceOf(address(_to2), _id);

            assertGt(lender0PoolTokenBalance, 0);
            assertGt(lender1PoolTokenBalance, 0);
            assertGt(lender2PoolTokenBalance, 0);
            assertGt(lender3PoolTokenBalance, 0);

            // Lender0 transfers pool tokens to lender1
            _from1.transferLPTokens(address(_to1), _id, (lender0PoolTokenBalance / _fractionOfPTSupply));

            // Checking the transfer took place or not
            lender0PoolTokenBalanceFinal = lp.balanceOf(address(_from1), _id);
            lender1PoolTokenBalanceFinal = lp.balanceOf(address(_to1), _id);

            assertTrue(lender0PoolTokenBalanceFinal == (lender0PoolTokenBalance - (lender0PoolTokenBalance / _fractionOfPTSupply)));
            assertTrue(lender1PoolTokenBalanceFinal == ((lender0PoolTokenBalance / _fractionOfPTSupply) + lender1PoolTokenBalance));

            helper_timeWarp(block.timestamp + request.defaultGracePeriod);

            // (, , , , , , , , _defaultTimeStamp, , , ) = pcl.pooledCreditLineConstants(_id);

            // assertTrue(block.timestamp >= _defaultTimeStamp, '!Still not past default time');

            // Lender2 transfers pool tokens to lender3
            _from2.transferLPTokens(address(_to2), _id, lender2PoolTokenBalance);

            lender2PoolTokenBalanceFinal = lp.balanceOf(address(_from2), _id);
            lender3PoolTokenBalanceFinal = lp.balanceOf(address(_to2), _id);

            // Checking whether the transfer took place or not
            assertTrue(lender2PoolTokenBalanceFinal == 0);
            assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance + lender3PoolTokenBalance));

            assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);
        } else {
            lender0PoolTokenBalance = lp.balanceOf(address(_from1), _id);
            try _from1.transferLPTokens(_To1, _id, lender0PoolTokenBalance) {
                if (_To1 == address(0)) {
                    _from1BalancePostBurn = lp.balanceOf(_From1, _id);
                    assertEq(_from1BalancePostBurn, 0);
                } else {
                    revert('REVERT');
                }
            } catch Error(string memory reason) {
                assertEq(reason, _errorString);
            }
        }
    }

    function test_poolTokenTransferComplete_expiredState() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            1,
            true,
            lenders[0].lenderAddress,
            lenders[1].lenderAddress,
            lenders[2].lenderAddress,
            lenders[3].lenderAddress,
            ''
        );
    }

    function test_poolTokenTransferPartial_expiredState() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            2,
            true,
            lenders[0].lenderAddress,
            lenders[1].lenderAddress,
            lenders[2].lenderAddress,
            lenders[3].lenderAddress,
            ''
        );
    }

    function test_poolTokenTransferPartialByFour_expiredState() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            4,
            true,
            lenders[0].lenderAddress,
            lenders[1].lenderAddress,
            lenders[2].lenderAddress,
            lenders[3].lenderAddress,
            ''
        );
    }

    function test_cannotBurnPoolToken_expiredState() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            1,
            false,
            lenders[0].lenderAddress,
            address(0),
            address(0),
            address(0),
            'ERC1155: transfer to the zero address'
        );
    }

    function test_cannotTransferPoolTokensToSelf_expiredState() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            1,
            false,
            lenders[0].lenderAddress,
            address(0),
            lenders[0].lenderAddress,
            address(0),
            'LP:IT1'
        );
    }

    function test_cannotTransferPoolTokensToNonVerified_expiredState() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            1,
            false,
            lenders[0].lenderAddress,
            address(0),
            protocolFeeCollectorAddress,
            address(0),
            'LP:IT3'
        );
    }

    function test_cannotTransferLPTokensToBorrower() public {
        assert_pool_token_transfer_in_expired_stage(
            requestId,
            1,
            false,
            lenders[0].lenderAddress,
            address(0),
            address(borrower),
            address(0),
            'LP:IT2'
        );
    }

    function test_cannotTransferNonTransferableLPTokens() public {
        request.areTokensTransferable = false;
        (uint256 _requestId, ) = goToActiveStage(10, request.borrowLimit);
        assertTrue(pcl.getStatusAndUpdate(_requestId) == PooledCreditLineStatus.ACTIVE, '!Active');

        uint256 _requiredCollateral = borrower.getRequiredCollateral(_requestId, request.borrowLimit);
        admin.transferToken(request.collateralAsset, address(borrower), _requiredCollateral);
        if (request.collateralRatio != 0) {
            borrower.depositCollateral(_requestId, _requiredCollateral, false);
        }

        uint256 borrowableAmount = borrower.calculateBorrowableAmount(_requestId);
        borrower.borrow(_requestId, borrowableAmount / 10);

        vm.warp(block.timestamp + 100 + request.duration);
        assertTrue(pcl.getStatusAndUpdate(_requestId) == PooledCreditLineStatus.EXPIRED, '!Expired');

        assert_pool_token_transfer_in_expired_stage(
            _requestId,
            1,
            false,
            lenders[0].lenderAddress,
            address(0),
            lenders[1].lenderAddress,
            address(0),
            'LP:IT5'
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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw Interest function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_withdraw_interest_in_expired_state(
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
                assertEq((_userBorrowTokenBalancePostWithdraw - _userBorrowTokenBalancePreWithdraw), _lenderInterest);
            }

            assertEq(_userPoolTokenBalancePreWithdraw, _userPoolTokenBalancePostWithdraw);
            assertEq(_userCollateralTokenBalancePostWithdraw, _userCollateralTokenBalancePreWithdraw);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
    }

    function test_adminCannotWithdrawInterest_expiredState() public {
        assert_withdraw_interest_in_expired_state(requestId, admin, 'LP:WI1');
    }

    function test_borrowerCannotWithdrawInterest_expiredState() public {
        assert_withdraw_interest_in_expired_state(requestId, borrower, 'LP:WI1');
    }

    function test_lendersCanWithdrawInterest_expiredState() public {
        assert_withdraw_interest_in_expired_state(requestId, PCLUser(lenders[0].lenderAddress), '');
    }

    function test_lenderCannotWithdrawZeroInterest() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        uint256 _lenderInterestOwed = lp.getLenderInterestWithdrawable(requestId, address(_lender));
        assertGt(_lenderInterestOwed, 0);

        _lender.withdrawInterest(requestId);
        _lenderInterestOwed = lp.getLenderInterestWithdrawable(requestId, address(_lender));
        assertEq(_lenderInterestOwed, 0);

        try _lender.withdrawInterest(requestId) {
            revert('Lender cannot withdraw zero interest');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:WI1');
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw Liquidation function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_withdraw_liquidation_in_expired_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.withdrawTokensAfterLiquidation(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
    }

    function test_adminCannotWithdrawLiquidation_expiredState() public {
        assert_withdraw_liquidation_in_expired_state(
            requestId,
            admin,
            'Cannot withdraw liquidation/liquidity from an expired PCL',
            'LP:WLC1'
        );
    }

    function test_borrowerCannotWithdrawLiquidation_expiredState() public {
        assert_withdraw_liquidation_in_expired_state(
            requestId,
            borrower,
            'Cannot withdraw liquidation/liquidity from an expired PCL',
            'LP:WLC1'
        );
    }

    function test_lenderCannotWithdrawLiquidation_expiredState() public {
        assert_withdraw_liquidation_in_expired_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot withdraw liquidation/liquidity from an expired PCL',
            'LP:IWLC1'
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // View/calculation function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    uint256 _currentDebt;
    uint256 _currentCR;
    uint256 _equivalentCollateral;
    uint256 _totalInterestPending;
    uint256 _totalInterestRepaid;
    uint256 _principal;

    // Test8: Helper Functionalities
    function assert_helper_functionalities_in_expired_state_when_price_fluctuates(uint256 _id) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.EXPIRED);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 0. collateralTokensToLiquidate
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        _equivalentCollateral = _borrower.collateralTokensToLiquidate(_id, _currentDebt);
        assertGt(_equivalentCollateral, 0);

        // 1. calculateCurrentCollateralRatio
        _currentCR = _borrower.calculateCurrentCollateralRatio(_id);
        if (request.collateralRatio != 0) {
            assertGt(_currentCR, request.collateralRatio);
        } // Since a lot of extra collateral was deposited

        // 2. calculatePrincipalWithdrawable
        try _lender.withdrawLiquidity(_id) {
            revert('Cannot be called without liquidating the borrower');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWL3');
        }

        // 3. withdrawableCollateral
        uint256 _withdrawableCollateral = _borrower.withdrawableCollateral(_id);
        assertEq(_withdrawableCollateral, 0); //Since the PCL has already gone into the EXPIRED state

        // 4. calculateTotalCollateralTokens
        uint256 _totalCollateral = pcl.calculateTotalCollateralTokens(_id);
        if (request.collateralRatio != 0) {
            assertGt(_totalCollateral, 0);
        } // Since a lot of extra collateral was deposited

        // 5. calculateBorrowableAmount
        uint256 _borrowableAmount = _borrower.calculateBorrowableAmount(_id);
        assertEq(_borrowableAmount, 0); // Since the PCL is already EXPIRED

        // 6. calculateInterestAccrued
        uint256 _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertGt(_interestAccrued, 0); // Should be non-zero, since it calculates interest accrued since last repayment
        // doesn't matter whether the PCL has been expired or not

        // 7. calculateCurrentDebt
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        (, _principal, _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(_id);
        _totalInterestPending = _borrower.calculateInterestAccrued(_id);
        uint256 calculatedCurrentDebt = _totalInterestPending + _principal - _totalInterestRepaid;
        assertEq(_currentDebt, calculatedCurrentDebt);
    }

    function test_helperFunctionsInExpiredState() public {
        assert_helper_functionalities_in_expired_state_when_price_fluctuates(requestId);
    }

    function helper_timeWarp(uint256 _time) public {
        vm.warp(_time);
        vm.roll(_time.div(20));
    }
}
