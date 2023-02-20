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

contract PCLLiquidatedStage is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    uint256 requestId;
    address lender_0;

    function setUp() public virtual override {
        super.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * pcl.SCALING_FACTOR()) / 1e2);
        request.collateralRatio = pcl.SCALING_FACTOR();
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 5000 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
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
        lender_0 = lenders[0].lenderAddress;

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

        // Time travel to mid-duration
        vm.warp(block.timestamp + request.duration / 10);
        // Current Debt on the borrower
        uint256 currentDebt = borrower.calculateCurrentDebt(requestId);
        // Borrower decides to repay partial debt
        admin.transferToken(address(borrowAsset), address(borrower), currentDebt);
        borrower.setAllowance(address(pooledCreditLineAddress), address(borrowAsset), type(uint256).max);
        borrower.repay(requestId, currentDebt / 200);

        // Now we travel past the expiration date
        vm.warp(block.timestamp + request.duration + request.defaultGracePeriod);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.EXPIRED, '!Expired');

        // Now the PCL should be in the LIQUIDATED state
        PCLUser(lender_0).liquidate(requestId, false);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
    }

    // Test0: Test SetUp
    function test_SetUp() public {
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED, '!Liquidated');
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // START function calls
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Test1: Liquidated PCL cannot be started
    function assert_start_functionality_in_liquidated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
    }

    function test_adminCannotStartALiquidatedPCL() public {
        assert_start_functionality_in_liquidated_state(requestId, admin, 'Admin cannot start a PCL in liquidated state', 'LP:S1');
    }

    function test_borrowerCannotStartALiquidatedPCL() public {
        assert_start_functionality_in_liquidated_state(requestId, borrower, 'Borrower cannot start a PCL in liquidated state', 'LP:S1');
    }

    function test_lenderCannotStartALiquidatedPCL() public {
        assert_start_functionality_in_liquidated_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot start a PCL in liquidated state',
            'LP:S1'
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // CANCEL function calls
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_cancel_functionality_in_liquidated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
    }

    function test_adminCannotCancelALiquidatedPCL() public {
        assert_cancel_functionality_in_liquidated_state(requestId, admin, 'Admin cannot Cancel a PCL in liquidated state', 'PCL:OCLB1');
    }

    function test_borrowerCannotCancelALiquidatedPCL() public {
        assert_cancel_functionality_in_liquidated_state(requestId, borrower, 'Borrower cannot Cancel a PCL in liquidated state', 'PCL:CR1');
    }

    function test_lenderCannotCancelALiquidatedPCL() public {
        assert_cancel_functionality_in_liquidated_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot Cancel a PCL in liquidated state',
            'PCL:OCLB1'
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // CLOSE function calls
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_close_functionality_in_liquidated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
    }

    function test_adminCannotCloseALiquidatedPCL() public {
        assert_close_functionality_in_liquidated_state(requestId, admin, 'Admin cannot close a liquidated PCL', 'PCL:OCLB1');
    }

    function test_borrowerCannotCloseALiquidatedPCL() public {
        assert_close_functionality_in_liquidated_state(requestId, borrower, 'Borrower cannot close a liquidated PCL', 'PCL:C1');
    }

    function test_lenderCannotCloseALiquidatedPCL() public {
        assert_close_functionality_in_liquidated_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot close a liquidated PCL',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Deposit collateral function calls
    *************************************************************************************************************************************/

    function assert_collateralCannotBeDepositedInLiquidatedState(
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

        try _depositor.depositCollateral(_id, _amount, false) {
            revert('Collateral cannot be deposited in the Liquidated state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    function test_borrowerCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInLiquidatedState(requestId, _amountToDeposit, borrower, true);
    }

    function test_lenderCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInLiquidatedState(requestId, _amountToDeposit, PCLUser(address(0)), true);
    }

    function test_adminCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInLiquidatedState(requestId, _amountToDeposit, admin, false);
    }

    /*************************************************************************************************************************************
    Borrow function tests
    *************************************************************************************************************************************/

    function assertBorrowFunctionalityInLiquidatedState(
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
        assertBorrowFunctionalityInLiquidatedState(
            requestId,
            1,
            admin,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Admin cannot borrow a PCL in Liquidated state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotBorrowALiquidatedPCL() public {
        assertBorrowFunctionalityInLiquidatedState(
            requestId,
            1,
            borrower,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Borrower cannot borrow a PCL in Liquidated state',
            'PCL:IB3'
        );
    }

    function test_borrowerCannotBorrowZeroAmount() public {
        assertBorrowFunctionalityInLiquidatedState(
            requestId,
            0,
            borrower,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Borrower cannot borrow a PCL in Liquidated state',
            'PCL:IB1'
        );
    }

    function test_lenderCannotBorrow() public {
        assertBorrowFunctionalityInLiquidatedState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Lender cannot borrow a PCL in Liquidated state',
            'PCL:OCLB1'
        );
    }

    /**************************************************************************************************************************************
    Repay function tests
    **************************************************************************************************************************************/

    function assertRepayFunctionalityInLiquidatedState(
        uint256 _id,
        PCLUser _user,
        uint256 _stateToAssert,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        admin.transferToken(address(borrowAsset), address(_user), 100);
        if (_user != borrower) {
            _user.setAllowance(address(pcl), address(borrowAsset), 100);
        }

        try _user.repay(_id, 1) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert);
    }

    function test_adminCannotRepayALiquidatedPCL() public {
        assertRepayFunctionalityInLiquidatedState(
            requestId,
            admin,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Admin cannot repay a Liquidated PCL',
            'PCL:REP2'
        );
    }

    function test_borrowerCannotRepayALiquidatedPCL() public {
        assertRepayFunctionalityInLiquidatedState(
            requestId,
            borrower,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Borrower cannot repay a Liquidated PCL',
            'PCL:REP2'
        );
    }

    function test_lenderCannotRepayALiquidatedPCL() public {
        assertRepayFunctionalityInLiquidatedState(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Lender cannot repay a Liquidated PCL',
            'PCL:REP2'
        );
    }

    /*************************************************************************************************************************************
    Withdraw collateral function tests
    *************************************************************************************************************************************/

    function assertWithdrawCollateralFunctionalityInLiquidatedState(
        uint256 _id,
        uint256 _amount,
        PCLUser _user,
        uint256 _stateToAssert,
        string memory _revertMessage,
        string memory _errorMessage,
        string memory _errorMessageAll
    ) public {
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
    }

    function test_adminCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInLiquidatedState(
            requestId,
            1,
            admin,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Admin cannot withdraw collateral in Liquidated state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInLiquidatedState(
            requestId,
            1,
            borrower,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Borrower cannot withdraw collateral in Liquidated state',
            'PCL:WC1',
            'PCL:WAC1'
        );
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        assertWithdrawCollateralFunctionalityInLiquidatedState(
            requestId,
            0,
            borrower,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Borrower cannot withdraw zero collateral in Liquidated state',
            'PCL:WC2',
            'PCL:WAC1'
        );
    }

    function test_lenderCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInLiquidatedState(
            requestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Lender cannot withdraw collateral in Liquidated state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    WithdrawLiquidity function calls
    **************************************************************************************************************************************/

    function assert_withdraw_liquidity_functionality_in_Liquidated_state(
        uint256 _id,
        PCLUser _user,
        uint256 _stateToAssert,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.withdrawLiquidity(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert);
    }

    function test_adminCannotWithdrawLiquidityFromALiquidatedPCL() public {
        assert_withdraw_liquidity_functionality_in_Liquidated_state(
            requestId,
            admin,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Admin cannot withdraw liquidity a PCL in Liquidated state',
            'LP:IWL1'
        );
    }

    function test_borrowerCannotWithdrawLiquidityFromALiquidatedPCL() public {
        assert_withdraw_liquidity_functionality_in_Liquidated_state(
            requestId,
            borrower,
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Borrower cannot withdraw liquidity a PCL in Liquidated state',
            'LP:IWL1'
        );
    }

    function test_lenderCannotWithdrawLiquidityFromALiquidatedPCL() public {
        assert_withdraw_liquidity_functionality_in_Liquidated_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.LIQUIDATED),
            'Lender cannot withdraw liquidity a PCL in Liquidated state',
            'LP:IWL2'
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // LIQUIDATE function calls
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_liquidate_functionality_in_liquidated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
    }

    function test_adminCannotLiquidateALiquidatedPCL() public {
        assert_liquidate_functionality_in_liquidated_state(requestId, admin, 'Admin cannot liquidate an liquidated PCL', 'LP:LIQ1');
    }

    function test_borrowerCannotLiquidateALiquidatedPCL() public {
        assert_liquidate_functionality_in_liquidated_state(requestId, borrower, 'Borrower cannot liquidate an liquidated PCL', 'LP:LIQ1');
    }

    function test_lenderCannotLiquidateALiquidatedPCL() public {
        assert_liquidate_functionality_in_liquidated_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Liquidated PCL cannot be liquidated',
            'PCL:L2'
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Terminate function tests
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_terminate_functionality_in_liquidated_state(
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

            assertTrue(
                (_userBorrowTokenBalancePreTerminate == _userBorrowTokenBalancePostTerminate) ==
                    (_userCollateralTokenBalancePreTerminate == _userCollateralTokenBalancePostTerminate) ==
                    true
            );

            assertEq(reason, _errorMessage);
            assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
        }
    }

    function test_adminCanTerminateALiquidatedPCL() public {
        assert_terminate_functionality_in_liquidated_state(requestId, admin, '', '');
    }

    function test_borrowerCannotTerminateALiquidatedPCL() public {
        assert_terminate_functionality_in_liquidated_state(
            requestId,
            borrower,
            'Cannot terminate a PCL that is liquidated',
            'Ownable: caller is not the owner'
        );
    }

    function test_lenderCannotTerminateALiquidatedPCL() public {
        assert_terminate_functionality_in_liquidated_state(
            requestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot terminate a PCL that is liquidated',
            'Ownable: caller is not the owner'
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Pool Token Transfer function tests
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

    PCLUser _from1;
    PCLUser _from2;
    PCLUser _to1;
    PCLUser _to2;

    function assert_pool_token_transfer_in_liquidated_stage(
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

            //Checking the transfer took place or not
            lender0PoolTokenBalanceFinal = lp.balanceOf(address(_from1), _id);
            lender1PoolTokenBalanceFinal = lp.balanceOf(address(_to1), _id);

            assertTrue(lender0PoolTokenBalanceFinal == (lender0PoolTokenBalance - (lender0PoolTokenBalance / _fractionOfPTSupply)));
            assertTrue(lender1PoolTokenBalanceFinal == ((lender0PoolTokenBalance / _fractionOfPTSupply) + lender1PoolTokenBalance));

            vm.warp(block.timestamp + request.defaultGracePeriod);

            // (, , , , , , , , _defaultTimeStamp, , , ) = pcl.pooledCreditLineConstants(_id);

            // assertTrue(block.timestamp >= _defaultTimeStamp, '!Still not past default time');

            // Lender2 transfers pool tokens to lender3
            _from2.transferLPTokens(address(_to2), _id, lender2PoolTokenBalance);

            lender2PoolTokenBalanceFinal = lp.balanceOf(address(_from2), _id);
            lender3PoolTokenBalanceFinal = lp.balanceOf(address(_to2), _id);

            // Checking whether the transfer took place or not
            assertTrue(lender2PoolTokenBalanceFinal == 0);
            assertTrue(lender3PoolTokenBalanceFinal == (lender2PoolTokenBalance + lender3PoolTokenBalance));

            assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
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

    function test_poolTokenTransferComplete_liquidatedState() public {
        assert_pool_token_transfer_in_liquidated_stage(
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

    function test_poolTokenTransferPartial_liquidatedState() public {
        assert_pool_token_transfer_in_liquidated_stage(
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

    function test_poolTokenTransferPartialByFour_liquidatedState() public {
        assert_pool_token_transfer_in_liquidated_stage(
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

    function test_cannotBurnPoolToken_liquidatedState() public {
        assert_pool_token_transfer_in_liquidated_stage(
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

    function test_cannotTransferPoolTokensToSelf_liquidatedState() public {
        assert_pool_token_transfer_in_liquidated_stage(
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

    function test_cannotTransferPoolTokensToNonVerified_liquidatedState() public {
        assert_pool_token_transfer_in_liquidated_stage(
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
        assert_pool_token_transfer_in_liquidated_stage(
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
        borrower.borrow(_requestId, borrowableAmount);

        vm.warp(block.timestamp + request.duration / 10);
        uint256 currentDebt = borrower.calculateCurrentDebt(_requestId);
        admin.transferToken(address(borrowAsset), address(borrower), currentDebt);
        borrower.repay(_requestId, currentDebt / 200);

        vm.warp(block.timestamp + request.duration + request.defaultGracePeriod);
        assertTrue(pcl.getStatusAndUpdate(_requestId) == PooledCreditLineStatus.EXPIRED, '!Expired');

        PCLUser(lenders[0].lenderAddress).liquidate(_requestId, false);
        assertTrue(pcl.getStatusAndUpdate(_requestId) == PooledCreditLineStatus.LIQUIDATED);

        assert_pool_token_transfer_in_liquidated_stage(
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

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw Interest function tests
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_withdraw_interest_in_liquidated_state(
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

    function test_adminCannotWithdrawInterest_liquidatedState() public {
        assert_withdraw_interest_in_liquidated_state(requestId, admin, 'LP:WI1');
    }

    function test_borrowerCannotWithdrawInterest_liquidatedState() public {
        assert_withdraw_interest_in_liquidated_state(requestId, borrower, 'LP:WI1');
    }

    function test_lendersCanWithdrawInterest_liquidatedState() public {
        assert_withdraw_interest_in_liquidated_state(requestId, PCLUser(lenders[0].lenderAddress), '');
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw Liquidation function tests
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_withdraw_liquidation_in_liquidated_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        if (_user == PCLUser(lenders[1].lenderAddress)) {
            uint256 _lenderBorrowTokenBalancePreLiquidation = borrowAsset.balanceOf(address(_user));
            uint256 _lenderCollateralTokenBalancePreLiquidation = collateralAsset.balanceOf(address(_user));
            _user.withdrawTokensAfterLiquidation(_id);
            uint256 _lenderBorrowTokenBalancePostLiquidation = borrowAsset.balanceOf(address(_user));
            uint256 _lenderCollateralTokenBalancePostLiquidation = collateralAsset.balanceOf(address(_user));
            assertGt(_lenderBorrowTokenBalancePostLiquidation, _lenderBorrowTokenBalancePreLiquidation);
            if (request.collateralRatio != 0) {
                assertGt(_lenderCollateralTokenBalancePostLiquidation, _lenderCollateralTokenBalancePreLiquidation);
            }
        } else {
            try _user.withdrawTokensAfterLiquidation(_id) {
                revert(_revertMessage);
            } catch Error(string memory reason) {
                assertEq(reason, _errorMessage);
            }
        }
    }

    function test_adminCannotWithdrawLiquidation_liquidatedState() public {
        assert_withdraw_liquidation_in_liquidated_state(
            requestId,
            admin,
            'Admin cannot withdraw liquidation/liquidity from an liquidated PCL',
            'LP:WLC1'
        );
    }

    function test_borrowerCannotWithdrawLiquidation_liquidatedState() public {
        assert_withdraw_liquidation_in_liquidated_state(
            requestId,
            borrower,
            'Admin cannot withdraw liquidation/liquidity from an liquidated PCL',
            'LP:WLC1'
        );
    }

    function test_lenderCanWithdrawLiquidation_liquidatedState() public {
        assert_withdraw_liquidation_in_liquidated_state(requestId, PCLUser(lenders[1].lenderAddress), '', '');
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // View/calculation function tests
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    uint256 _currentCR;
    uint256 _totalInterestPending;
    uint256 _totalInterestRepaid;
    uint256 _principal;
    uint256 _currentDebt;
    uint256 collateralHeld;

    function assert_helper_functionalities_in_liquidated_state(uint256 _id) public {
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 0. collateralTokensToLiquidate
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        uint256 _equivalentCollateralTokens = _borrower.collateralTokensToLiquidate(_id, _currentDebt);

        log_named_uint('CD', _currentDebt);
        log_named_uint('Equivalent Collateral Tokens', _equivalentCollateralTokens);

        if (request.collateralRatio != 0) {
            (, , , , collateralHeld) = lp.pooledCLVariables(_id);

            log_named_uint('Collateral Held', collateralHeld);

            if (request.collateralAssetStrategy == compoundYieldAddress) {
                assertGt(_equivalentCollateralTokens, collateralHeld); // Since currentDebt is equivalentCollateralHeld + interest generated from the point of last repayment to the point of liquidation)
            } else {
                // assertApproxEqAbs(_equivalentCollateralTokens, collateralHeld, 1, 'Collateral Tokens to liquidate');
            }
        } else {
            log_named_uint('CD', _currentDebt); // Considerable number since debt cannot be recovered by liquidating a PCL with 0 collateral
            assertGt(_equivalentCollateralTokens, 0);
        }

        // The currentCr is coming to be more than idealCR. Discuss.

        // 0. calculateCurrentCollateralRatio
        _currentCR = _borrower.calculateCurrentCollateralRatio(_id);
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
        if (request.collateralRatio != 0) {
            // assertEq(request.collateralRatio, _currentCR, 'Current Collateral Ratio'); // Since a lot of collateral was taken away
        } else {
            assertTrue(true);
        }

        // 1. calculatePrincipalWithdrawable
        try _lender.withdrawLiquidity(_id) {
            revert('Cannot be called without withdrawnLiquidation');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWL2');
        }

        // 2. withdrawableCollateral
        (, , , , collateralHeld) = lp.pooledCLVariables(_id); // This is the collateral that is transferred to the LenderPool contract after liquidation
        uint256 _remainingCollateralInShares = pcl.depositedCollateralInShares(_id);
        uint256 _remainingCollateral = IYield(request.collateralAssetStrategy).getTokensForShares(
            _remainingCollateralInShares,
            address(collateralAsset)
        );
        uint256 withdrawableCollateral = _borrower.withdrawableCollateral(_id);

        assertApproxEqAbs(withdrawableCollateral, _remainingCollateral, 5, 'Withdrawable Collateral');

        // 3.calculateTotalCollateralTokens
        uint256 _totalCollateral = _borrower.calculateTotalCollateralTokens(_id);
        assertEq(_totalCollateral, withdrawableCollateral, 'Total Collateral Tokens');

        // 4. calculateBorrowableAmount
        uint256 _totalBorrowable = _borrower.calculateBorrowableAmount(_id);
        assertEq(_totalBorrowable, 0, 'Borrowable Amount'); // Since PCL is liquidated now

        // 5. calculateInterestAccrued
        uint256 _interestAccrued = _borrower.calculateInterestAccrued(_id);
        assertGt(_interestAccrued, 0, 'Interest Accrued'); // Should be non-zero, since it calculates interest accrued since last repayment
        // doesn't matter whether the PCL has been liquidated or not

        // 6. calculateCurrentDebt
        _currentDebt = _borrower.calculateCurrentDebt(_id);
        (, _principal, _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(_id);
        _totalInterestPending = _borrower.calculateInterestAccrued(_id);
        log_named_uint('First Interest Repaid', _totalInterestRepaid);
        uint256 calculatedCurrentDebt = _totalInterestPending + _principal - _totalInterestRepaid;
        assertApproxEqRel(_currentDebt, calculatedCurrentDebt, 1e14, 'Current Debt');
    }

    function test_helperFunctionsInLiquidatedState() public {
        assert_helper_functionalities_in_liquidated_state(requestId);
    }
}
