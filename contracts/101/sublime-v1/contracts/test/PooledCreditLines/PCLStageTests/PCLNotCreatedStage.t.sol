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

contract PCLNotCreatedStage is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    uint256 requestId;
    uint256 notCreatedRequestId;

    function setUp() public virtual override {
        super.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128((5 * pcl.SCALING_FACTOR()) / 1e2);
        request.collateralRatio = pcl.SCALING_FACTOR();
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * pcl.SCALING_FACTOR()) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * (10**ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        requestId = borrower.createRequest(request);

        // Create a few lenders
        createMultipleLenders(requestId, 5, uint128(request.minBorrowAmount + 1), request.borrowAsset);

        notCreatedRequestId = requestId + 1;
        assertTrue(pcl.getStatusAndUpdate(notCreatedRequestId) == PooledCreditLineStatus.NOT_CREATED);
    }

    // Test1: Test setup
    function test_setUp() public {
        assertTrue(pcl.getStatusAndUpdate(notCreatedRequestId) == PooledCreditLineStatus.NOT_CREATED);
    }

    /*************************************************************************************************************************************
    START function calls
    *************************************************************************************************************************************/

    function assert_start_functionality_in_notCreated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
    }

    function test_adminCannotStartANotCreatedPCL() public {
        assert_start_functionality_in_notCreated_state(notCreatedRequestId, admin, 'Admin cannot start a PCL in notCreated state', 'LP:S1');
    }

    function test_borrowerCannotStartANotCreatedPCL() public {
        assert_start_functionality_in_notCreated_state(
            notCreatedRequestId,
            borrower,
            'Borrower cannot start a PCL in notCreated state',
            'LP:S1'
        );
    }

    function test_lenderCannotStartANotCreatedPCL() public {
        assert_start_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress), // This lender is from a different PCL with requestId, since lenders for PCL with notCreatedRequestId do not exist
            'Lender cannot start a PCL in notCreated state',
            'LP:S1'
        );
    }

    /**************************************************************************************************************************************
    CANCEL function tests
    **************************************************************************************************************************************/

    function assert_cancel_functionality_in_notCreated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
    }

    function test_adminCannotCancelANotCreatedPCL() public {
        assert_cancel_functionality_in_notCreated_state(
            notCreatedRequestId,
            admin,
            'Admin cannot Cancel a PCL in notCreated state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotCancelANotCreatedPCL() public {
        assert_cancel_functionality_in_notCreated_state(
            notCreatedRequestId,
            borrower,
            'Borrower cannot Cancel a PCL in notCreated state',
            'PCL:OCLB1'
        );
    }

    function test_lenderCannotCancelANotCreatedPCL() public {
        assert_cancel_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot Cancel a PCL in notCreated state',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    CLOSE function calls
    *************************************************************************************************************************************/

    function assert_close_functionality_in_notCreated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
    }

    function test_adminCannotCloseANotCreatedPCL() public {
        assert_close_functionality_in_notCreated_state(notCreatedRequestId, admin, 'Admin cannot close a notCreated PCL', 'PCL:OCLB1');
    }

    function test_borrowerCannotCloseANotCreatedPCL() public {
        assert_close_functionality_in_notCreated_state(
            notCreatedRequestId,
            borrower,
            'Borrower cannot close a notCreated PCL',
            'PCL:OCLB1'
        );
    }

    function test_lenderCannotCloseANotCreatedPCL() public {
        assert_close_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot close a notCreated PCL',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    Deposit collateral function calls
    *************************************************************************************************************************************/

    function assert_collateralCannotBeDepositedInNotCreatedState(
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
            revert('Collateral cannot be deposited in the NotCreated state');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC2');
        }
    }

    function test_borrowerCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInNotCreatedState(notCreatedRequestId, _amountToDeposit, borrower, true);
    }

    function test_lenderCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInNotCreatedState(notCreatedRequestId, _amountToDeposit, PCLUser(address(0)), true);
    }

    function test_adminCannotDepositCollateral() public {
        uint256 _amountToDeposit = 100_000 * ERC20(address(collateralAsset)).decimals();
        assert_collateralCannotBeDepositedInNotCreatedState(notCreatedRequestId, _amountToDeposit, admin, false);
    }

    /*************************************************************************************************************************************
    Borrow function tests
    *************************************************************************************************************************************/

    function assertBorrowFunctionalityInNotCreatedState(
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
        assertBorrowFunctionalityInNotCreatedState(
            notCreatedRequestId,
            1,
            admin,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Admin cannot borrow a PCL in NotCreated state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotBorrowANotCreatedPCL() public {
        assertBorrowFunctionalityInNotCreatedState(
            notCreatedRequestId,
            1,
            borrower,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Borrower cannot borrow a PCL in NotCreated state',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotBorrowZeroAmount() public {
        assertBorrowFunctionalityInNotCreatedState(
            notCreatedRequestId,
            0,
            borrower,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Borrower cannot borrow a PCL in NotCreated state',
            'PCL:OCLB1'
        );
    }

    function test_lenderCannotBorrow() public {
        assertBorrowFunctionalityInNotCreatedState(
            notCreatedRequestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Lender cannot borrow a PCL in NotCreated state',
            'PCL:OCLB1'
        );
    }

    /**************************************************************************************************************************************
    Repay function tests
    **************************************************************************************************************************************/

    function assertRepayFunctionalityInNotCreatedState(
        uint256 _id,
        PCLUser _user,
        uint256 _stateToAssert,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        admin.transferToken(address(borrowAsset), address(_user), 100);
        _user.setAllowance(address(pcl), address(borrowAsset), 100);

        try _user.repay(_id, 1) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertEq(uint256(pcl.getStatusAndUpdate(_id)), _stateToAssert);
    }

    function test_adminCannotRepayANotCreatedPCL() public {
        assertRepayFunctionalityInNotCreatedState(
            notCreatedRequestId,
            admin,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Admin cannot repay a NotCreated PCL',
            'PCL:REP2'
        );
    }

    function test_borrowerCannotRepayANotCreatedPCL() public {
        assertRepayFunctionalityInNotCreatedState(
            notCreatedRequestId,
            borrower,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Borrower cannot repay a NotCreated PCL',
            'PCL:REP2'
        );
    }

    function test_lenderCannotRepayANotCreatedPCL() public {
        assertRepayFunctionalityInNotCreatedState(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Lender cannot repay a NotCreated PCL',
            'PCL:REP2'
        );
    }

    /*************************************************************************************************************************************
    Withdraw collateral function tests
    *************************************************************************************************************************************/

    function assertWithdrawCollateralFunctionalityInNotCreatedState(
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
    }

    function test_adminCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInNotCreatedState(
            notCreatedRequestId,
            1,
            admin,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Admin cannot withdraw collateral in NotCreated state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInNotCreatedState(
            notCreatedRequestId,
            1,
            borrower,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Borrower cannot withdraw collateral in NotCreated state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        assertWithdrawCollateralFunctionalityInNotCreatedState(
            notCreatedRequestId,
            0,
            borrower,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Borrower cannot withdraw zero collateral in NotCreated state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    function test_lenderCannotWithdrawCollateral() public {
        assertWithdrawCollateralFunctionalityInNotCreatedState(
            notCreatedRequestId,
            1,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.NOT_CREATED),
            'Lender cannot withdraw collateral in NotCreated state',
            'PCL:OCLB1',
            'PCL:OCLB1'
        );
    }

    /*************************************************************************************************************************************
    WithdrawLiquidity function calls
    **************************************************************************************************************************************/

    function assert_withdraw_liquidity_functionality_in_NotCreated_state(
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

    function test_adminCannotWithdrawLiquidityFromANotCreatedPCL() public {
        assert_withdraw_liquidity_functionality_in_NotCreated_state(
            notCreatedRequestId,
            admin,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            false,
            'Admin cannot withdraw liquidity a PCL in NotCreated state',
            'LP:IWL1'
        );
    }

    function test_borrowerCannotWithdrawLiquidityFromANotCreatedPCL() public {
        assert_withdraw_liquidity_functionality_in_NotCreated_state(
            notCreatedRequestId,
            borrower,
            uint256(PooledCreditLineStatus.NOT_CREATED),
            false,
            'Borrower cannot withdraw liquidity a PCL in NotCreated state',
            'LP:IWL1'
        );
    }

    function test_lenderCannotWithdrawLiquidityFromANotCreatedPCL() public virtual {
        assert_withdraw_liquidity_functionality_in_NotCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            uint256(PooledCreditLineStatus.NOT_CREATED),
            false,
            'Lender cannot withdraw liquidity a PCL in NotCreated state',
            'LP:IWL1'
        );
    }

    /**************************************************************************************************************************************
    Liquidate function tests
    **************************************************************************************************************************************/

    function assert_liquidate_functionality_in_notCreated_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.liquidate(_id, true) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            console.log(reason);
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
    }

    function test_adminCannotLiquidateANotCreatedPCL() public {
        assert_liquidate_functionality_in_notCreated_state(
            notCreatedRequestId,
            admin,
            'Admin cannot liquidate a notCreated PCL',
            'LP:LIQ1'
        );
    }

    function test_borrowerCannotLiquidateANotCreatedPCL() public {
        assert_liquidate_functionality_in_notCreated_state(
            notCreatedRequestId,
            borrower,
            'Borrower cannot liquidate a notCreated PCL',
            'LP:LIQ1'
        );
    }

    function test_lenderCannotLiquidateANotCreatedPCL() public virtual {
        assert_liquidate_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Lender cannot liquidate a notCreated PCL',
            'LP:LIQ1'
        );
    }

    /*************************************************************************************************************************************
    WithdrawInterest function calls
    **************************************************************************************************************************************/

    function assert_withdraw_interest_functionality_in_notCreated_state(
        uint256 _id,
        PCLUser _user,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        try _user.withdrawInterest(_id) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
    }

    function test_adminCannotWithdrawInterestFromANotCreatedPCL() public {
        assert_withdraw_interest_functionality_in_notCreated_state(
            notCreatedRequestId,
            admin,
            'No interest can be withdrawn in a not-created PCL',
            'LP:IWI1'
        );
    }

    function test_borrowerCannotWithdrawInterestFromANotCreatedPCL() public {
        assert_withdraw_interest_functionality_in_notCreated_state(
            notCreatedRequestId,
            borrower,
            'No interest can be withdrawn in a not-created PCL',
            'LP:IWI1'
        );
    }

    function test_lenderCannotWithdrawInterestFromANotCreatedPCL() public {
        assert_withdraw_interest_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'No interest can be withdrawn in a not-created PCL',
            'LP:IWI1'
        );
    }

    /**************************************************************************************************************************************
    Terminate function tests 
    **************************************************************************************************************************************/

    function assert_terminate_functionality_in_notCreated_state(
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

        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.NOT_CREATED);
    }

    function test_adminCannotTerminateANotCreatedPCL() public {
        assert_terminate_functionality_in_notCreated_state(
            notCreatedRequestId,
            admin,
            'Cannot terminate a PCL that is not created',
            'PCL:CTCT1'
        );
    }

    function test_borrowerCannotTerminateANotCreatedPCL() public {
        assert_terminate_functionality_in_notCreated_state(
            notCreatedRequestId,
            borrower,
            'Cannot terminate a PCL that is not created',
            'Ownable: caller is not the owner'
        );
    }

    function test_lenderCannotTerminateANotCreatedPCL() public {
        assert_terminate_functionality_in_notCreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot terminate a PCL that is not created',
            'Ownable: caller is not the owner'
        );
    }

    /**************************************************************************************************************************************
    Pool Token Transfer function tests 
    **************************************************************************************************************************************/

    function assert_pool_token_transfer_in_notCreated_stage(
        uint256 _id,
        PCLUser _fromUser,
        address _toUser,
        uint256 _fractionOfPTSupply,
        string memory _revertMessage,
        string memory _errorMessage
    ) public {
        uint256 _fromUserPoolTokenSupply = lp.balanceOf(address(_fromUser), _id);
        try _fromUser.transferLPTokens(_toUser, _id, (_fromUserPoolTokenSupply / _fractionOfPTSupply)) {
            revert(_revertMessage);
        } catch Error(string memory reason) {
            assertEq(reason, _errorMessage);
        }
    }

    function test_poolTokenTransferComplete() public {
        assert_pool_token_transfer_in_notCreated_stage(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            lenders[1].lenderAddress,
            1,
            'Should not have gone through',
            'LP:IT3'
        );
    }

    function test_poolTokenTransferPartial() public {
        assert_pool_token_transfer_in_notCreated_stage(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            lenders[1].lenderAddress,
            2,
            'Should not have gone through',
            'LP:IT3'
        );
    }

    function test_poolTokenTransferToNonVerifiedUser() public {
        assert_pool_token_transfer_in_notCreated_stage(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            address(admin),
            4,
            'Non-verified user should not be able to receive pool tokens',
            'LP:IT3'
        );
    }

    function test_cannotBurnPoolToken() public {
        assert_pool_token_transfer_in_notCreated_stage(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            address(0),
            1,
            'Should not have gone through',
            'ERC1155: transfer to the zero address'
        );
    }

    function test_cannotTransferPoolTokensToSelf() public {
        assert_pool_token_transfer_in_notCreated_stage(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            lenders[0].lenderAddress,
            1,
            'Should not have gone through',
            'LP:IT1'
        );
    }

    function test_externalUserCannotCreate() public {
        try
            lp.create(
                notCreatedRequestId,
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
        try lp.terminate(notCreatedRequestId, address(admin)) {
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

        try _pooledCreditLineLender.lend(notCreatedRequestId, 0) {
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

        try _pooledCreditLineLender.lend(notCreatedRequestId, _amountToLend) {
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

        try _pooledCreditLineLender.lend(notCreatedRequestId, _amountToLend) {
            revert('Lender cannot lend');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L2');
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Withdraw Liquidation function tests
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function assert_withdraw_liquidation_in_notcreated_state(
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

    function test_adminCannotWithdrawLiquidation_notcreatedState() public {
        assert_withdraw_liquidation_in_notcreated_state(
            notCreatedRequestId,
            admin,
            'Cannot withdraw liquidation/liquidity from a notcreated PCL',
            'LP:WLC1'
        );
    }

    function test_borrowerCannotWithdrawLiquidation_notcreatedState() public {
        assert_withdraw_liquidation_in_notcreated_state(
            notCreatedRequestId,
            borrower,
            'Cannot withdraw liquidation/liquidity from a notcreated PCL',
            'LP:WLC1'
        );
    }

    function test_lenderCannotWithdrawLiquidation_notcreatedState() public virtual {
        assert_withdraw_liquidation_in_notcreated_state(
            notCreatedRequestId,
            PCLUser(lenders[0].lenderAddress),
            'Cannot withdraw liquidation/liquidity from a notcreated PCL',
            'LP:WLC1'
        );
    }

    /**************************************************************************************************************************************
    View/calculation function tests 
    **************************************************************************************************************************************/

    function assert_helper_functionalities_in_notCreated_state(uint256 _id) public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        PCLUser _borrower = borrower;

        // 1. calculatePrincipalWithdrawable
        uint256 _principalWithdrawable = _lender.calculatePrincipalWithdrawable(_id, address(_lender));
        assertEq(_principalWithdrawable, 0);

        // 2. withdrawableCollateral
        try _borrower.withdrawableCollateral(_id) {
            revert('withdrawable collateral cannot be called in a not created PCL');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTCT1');
        }

        // 3. calculateTotalCollateralTokens
        try _borrower.calculateTotalCollateralTokens(_id) {
            revert('Total collateral tokens cannot be calculated for a not created PCL');
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

        // Test Number 7 should ideally have been returning a revert string, but right now they return PO:IGUPT1

        // 7. calculateCurrentCollateralRatio
        try _borrower.calculateCurrentCollateralRatio(_id) {
            uint256 _currentCR = _borrower.calculateCurrentCollateralRatio(_id);
            assertEq(_currentCR, uint256(-1));
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGUPT1');
        }

        // 8. collateralTokensToLiquidate
        try _borrower.collateralTokensToLiquidate(_id, 0) {
            uint256 _collateralTokensToLiquidate = _borrower.collateralTokensToLiquidate(_id, 0);
            assertEq(_collateralTokensToLiquidate, 0);
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CTTL1');
        }
    }

    function test_helperFunctionInNotCreatedState() public {
        assert_helper_functionalities_in_notCreated_state(notCreatedRequestId);
    }

    function helper_timeWarp(uint256 _time) public {
        vm.warp(_time);
        vm.roll(_time.div(20));
    }
}
