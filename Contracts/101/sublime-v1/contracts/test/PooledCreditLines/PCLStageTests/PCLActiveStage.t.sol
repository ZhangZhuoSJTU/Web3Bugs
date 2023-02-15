// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../mocks/MockToken.sol';
import '../Helpers/PCLParent.t.sol';

contract PCLActiveStage is PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;

    uint256 requestId;

    // enum PooledCreditLineStatus {
    //     NOT_CREATED,
    //     REQUESTED,
    //     ACTIVE,
    //     CLOSED,
    //     EXPIRED,
    //     LIQUIDATED,
    //     CANCELLED
    // }

    function setUp() public virtual override {
        super.setUp();

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
        request.minBorrowAmount = 90_000 * 10**(ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
    }

    function test_cannotStartActivePCL() public {
        try borrower.start(requestId) {
            revert('cannot start active pcl');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:S1');
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
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        try _pooledCreditLineLender.lend(requestId, 0) {
            revert('Lender cannot lend zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L1');
        }
    }

    function test_unverifiedLenderCannotLend() public {
        uint256 _amountToLend = 100;
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        // verified using the borrower verifier instead of lender verifier
        _pooledCreditLineLender.registerSelf(mockAdminVerifier2);

        admin.transferToken(address(borrowAsset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, _amountToLend) {
            revert('Unverified lender cannot lend');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L2');
        }
    }

    function test_nonLenderCannotWithdrawLiquidity() public {
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);
        try _pooledCreditLineLender.withdrawLiquidity(requestId) {
            revert('Lender cannot withdraw liquidity');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWL1');
        }
    }

    function test_lenderCannotWithdrawLiquidity() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.withdrawLiquidity(requestId) {
            revert('Lender cannot withdraw liquidity');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IWL3');
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

    function test_cannotBurnPoolTokens() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        uint256 _balanceLender = lp.balanceOf(address(_lender), requestId);

        try _lender.transferLPTokens(address(0), requestId, _balanceLender) {
            revert('Lender cannot burn LP tokens');
        } catch Error(string memory reason) {
            assertEq(reason, 'ERC1155: transfer to the zero address');
        }
    }

    function test_cannotLendToActivePCL() public {
        LenderInfo memory info = lenders[0];
        PCLUser lender = PCLUser(info.lenderAddress);
        try lender.lend(requestId, 100_000) {
            revert('cannot lend to active pcl');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L3');
        }
    }

    function test_cannotLendToActivePCLNewLender() public {
        // Creating a new lender for lending
        PCLUser lender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        lender.registerSelf(mockAdminVerifier1);
        admin.transferToken(request.borrowAsset, address(lender), 100_000);
        lender.setAllowance(lenderPoolAddress, request.borrowAsset, type(uint256).max);
        try lender.lend(requestId, 100_000) {
            revert('cannot lend to active pcl');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:L3');
        }
    }

    function test_lenderCannotBorrow() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_borrowByInvalidActor(_id, _amountToBorrow, lenders[0].lenderAddress);
    }

    function test_adminCannotBorrow() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_borrowByInvalidActor(_id, _amountToBorrow, address(admin));
    }

    function test_onlyBorrowerCanBorrow() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;
        PCLUser _attacker = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_borrowByInvalidActor(_id, _amountToBorrow, address(_attacker));
    }

    function assert_borrowByInvalidActor(
        uint256 _id,
        uint256 _amountToBorrow,
        address _actor
    ) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
        PCLUser _user = PCLUser(_actor);
        if (_actor == address(admin)) {
            admin.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

            _helperDepositCollateral(admin, _id, _collateralRequired, false);

            uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
                _collateralRequired,
                address(collateralAsset)
            );
            uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
            assertEq(_expectedCollateralShares, _actualCollateralShares);

            try admin.borrow(_id, _amountToBorrow) {
                revert('Invalid user should not be able to borrow');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        } else {
            admin.transferToken(address(collateralAsset), address(_user), _collateralRequired);
            _user.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

            _helperDepositCollateral(_user, _id, _collateralRequired, false);

            uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
                _collateralRequired,
                address(collateralAsset)
            );
            uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
            assertEq(_expectedCollateralShares, _actualCollateralShares);

            try _user.borrow(_id, _amountToBorrow) {
                revert('Invalid user should not be able to borrow');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        }
    }

    function test_borrowerCannotBorrowMoreThanPossible() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCannotBorrowMoreThanPossible(_id, _amountToBorrow);
    }

    function assert_borrowerCannotBorrowMoreThanPossible(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        uint256 _amountBorrowable = pcl.calculateBorrowableAmount(_id);

        try borrower.borrow(_id, _amountBorrowable + 1) {
            revert('Borrower should not be able to borrow more than possible');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:IB3');
        }
    }

    function test_borrowerCannotBorrowZeroAmount() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCannotBorrowZeroAmount(_id, _amountToBorrow);
    }

    function assert_borrowerCannotBorrowZeroAmount(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        try borrower.borrow(_id, 0) {
            revert('Borrower should not be able to borrow zero amount');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:IB1');
        }
    }

    function test_lenderDepositsAndCannotWithdrawCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_DepositAndCannotWithdrawCollateral_InvalidActor(_id, _amountToBorrow, lenders[0].lenderAddress, lenders[0].lenderAddress);
    }

    function test_borrowerDepositsAndLenderCannotWithdrawCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_DepositAndCannotWithdrawCollateral_InvalidActor(_id, _amountToBorrow, address(borrower), lenders[0].lenderAddress);
    }

    function test_adminDepositsAndCannotWithdrawCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_DepositAndCannotWithdrawCollateral_InvalidActor(_id, _amountToBorrow, address(admin), address(admin));
    }

    function test_borrowerDepositsAndAdminCannotWithdrawCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_DepositAndCannotWithdrawCollateral_InvalidActor(_id, _amountToBorrow, address(borrower), address(admin));
    }

    function assert_DepositAndCannotWithdrawCollateral_InvalidActor(
        uint256 _id,
        uint256 _amountToBorrow,
        address _depositor,
        address _withdrawer
    ) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        // Depositing into PCL
        if (_depositor == address(admin)) {
            admin.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

            _helperDepositCollateral(admin, _id, _collateralRequired, false);

            uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
                _collateralRequired,
                address(collateralAsset)
            );
            uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
            assertEq(_expectedCollateralShares, _actualCollateralShares);
        } else {
            PCLUser _user = PCLUser(_depositor);

            admin.transferToken(address(collateralAsset), address(_user), _collateralRequired);
            _user.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

            _helperDepositCollateral(_user, _id, _collateralRequired, false);

            uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
                _collateralRequired,
                address(collateralAsset)
            );
            uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
            assertEq(_expectedCollateralShares, _actualCollateralShares);
        }

        // withdrawing from PCL
        if (_withdrawer == address(admin)) {
            try admin.withdrawCollateral(_id, _collateralRequired, false) {
                revert('Admin should not be able to withdraw collateral');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        } else {
            PCLUser _user = PCLUser(_withdrawer);

            try _user.withdrawCollateral(_id, _collateralRequired, false) {
                revert('Invalid actor should not be able to withdraw collateral');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        }
    }

    function test_borrowerCanWithdrawCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCanWithdrawCollateral(_id, _amountToBorrow);
    }

    function assert_borrowerCanWithdrawCollateral(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        uint256 _borrowerCollateralBalanceBefore = MockToken(address(collateralAsset)).balanceOf(address(borrower));
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(_id);
        if (request.collateralRatio != 0) {
            borrower.withdrawCollateral(_id, _withdrawableCollateral, false);
        }
        uint256 _borrowerCollateralBalanceAfter = MockToken(address(collateralAsset)).balanceOf(address(borrower));
        assertApproxEqRel(_borrowerCollateralBalanceAfter - _borrowerCollateralBalanceBefore, _collateralRequired, 1e14);
    }

    function test_lenderDepositsAndCannotWithdrawAllCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_lenderDepositsAndCannotWithdrawAllCollateral(_id, _amountToBorrow);
    }

    function assert_lenderDepositsAndCannotWithdrawAllCollateral(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        admin.transferToken(address(collateralAsset), address(_lender), _collateralRequired);
        _lender.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

        _helperDepositCollateral(_lender, _id, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        try _lender.withdrawAllCollateral(_id, false) {
            revert('lender should not be able to withdraw all collateral');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OCLB1');
        }
    }

    function test_adminDepositsAndCannotWithdrawAllCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_adminDepositsAndCannotWithdrawAllCollateral(_id, _amountToBorrow);
    }

    function assert_adminDepositsAndCannotWithdrawAllCollateral(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(admin, _id, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        try admin.withdrawAllCollateral(_id, false) {
            revert('admin should not be able to withdraw all collateral');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OCLB1');
        }
    }

    function test_borrowerCannotWithdrawZeroAllCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCannotWithdrawZeroAllCollateral(_id, _amountToBorrow);
    }

    function assert_borrowerCannotWithdrawZeroAllCollateral(uint256 _id, uint256 _amountToBorrow) public {
        try borrower.withdrawAllCollateral(_id, false) {
            revert('borrower should not be able to withdraw zero all collateral');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WAC1');
        }
    }

    function test_borrowerCannotWithdrawZeroCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCannotWithdrawZeroCollateral(_id, _amountToBorrow);
    }

    function assert_borrowerCannotWithdrawZeroCollateral(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        try borrower.withdrawCollateral(_id, 0, false) {
            revert('Withdrawing zero collateral should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WC2');
        }
    }

    function test_borrowerCannotWithdrawMoreCollateralThanWithdrawable() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCannotWithdrawMoreCollateralThanWithdrawable(_id, _amountToBorrow);
    }

    function assert_borrowerCannotWithdrawMoreCollateralThanWithdrawable(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        uint256 _withdrawableCollateral = borrower.withdrawableCollateral(_id);

        try borrower.withdrawCollateral(_id, _withdrawableCollateral + 1e3, false) {
            revert('Withdrawing more collateral than withdrawable should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:WC1');
        }
    }

    function test_borrowerCanWithdrawAllCollateral() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCanWithdrawAllCollateral(_id, _amountToBorrow);
    }

    function assert_borrowerCanWithdrawAllCollateral(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);

        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(_id);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        uint256 _borrowerCollateralBalanceBefore = MockToken(address(collateralAsset)).balanceOf(address(borrower));
        if (request.collateralRatio != 0) {
            borrower.withdrawAllCollateral(_id, false);
        }
        uint256 _borrowerCollateralBalanceAfter = MockToken(address(collateralAsset)).balanceOf(address(borrower));
        assertApproxEqRel(_borrowerCollateralBalanceAfter - _borrowerCollateralBalanceBefore, _collateralRequired, 1e14);
    }

    function test_cannotCloseIfDebtIsNonZero() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_cannotCloseIfDebtIsNonZero(_id, _amountToBorrow);
    }

    function assert_cannotCloseIfDebtIsNonZero(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        // uint256 _borrowerBorrowAssetBalanceBefore = MockToken(address(borrowAsset)).balanceOf(address(borrower));
        borrower.borrow(_id, 90_000 * (10**ERC20(address(borrowAsset)).decimals()));
        // uint256 _borrowerBorrowAssetBalanceAfter = MockToken(address(borrowAsset)).balanceOf(address(borrower));

        try borrower.close(_id) {
            revert('Borrower should not be able to close with non-zero debt');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:C2');
        }
    }

    function test_lenderCannotClose() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_invalidActorCannotClose(_id, _amountToBorrow, lenders[0].lenderAddress);
    }

    function test_adminCannotClose() public {
        uint256 _amountToBorrow = request.borrowLimit / 2;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        assert_invalidActorCannotClose(_id, _amountToBorrow, address(admin));
    }

    function assert_invalidActorCannotClose(
        uint256 _id,
        uint256 _amountToBorrow,
        address _actor
    ) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        borrower.borrow(_id, request.minBorrowAmount);

        if (_actor == address(admin)) {
            try admin.close(_id) {
                revert('Admin should not be able to close PCL');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        } else {
            PCLUser _user = PCLUser(_actor);

            try _user.close(_id) {
                revert('Invalid actor should not be able to close PCL');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        }
    }

    function test_borrowerCanRepayAndClose() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCanRepayAndClose(_id, _amountToBorrow);
    }

    function assert_borrowerCanRepayAndClose(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        borrower.borrow(_id, 90_000 * 10**(ERC20(address(borrowAsset)).decimals()));

        vm.warp(block.timestamp + (request.duration / 2));

        uint256 _currentDebt = pcl.calculateCurrentDebt(_id);
        admin.transferToken(address(borrowAsset), address(borrower), _currentDebt);
        borrower.setAllowance(address(pooledCreditLineAddress), address(borrowAsset), _currentDebt);
        borrower.repay(_id, _currentDebt);

        _currentDebt = pcl.calculateCurrentDebt(_id);
        assertEq(_currentDebt, 0);

        borrower.close(_id);
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.CLOSED);
    }

    function test_repayWithInsufficientBalance() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        borrower.borrow(_id, 90_000 * 10**(ERC20(address(borrowAsset)).decimals()));

        vm.warp(block.timestamp + (request.duration / 2));

        uint256 _currentDebt = pcl.calculateCurrentDebt(_id);
        admin.transferToken(address(borrowAsset), address(borrower), _currentDebt.sub(10));
        borrower.setAllowance(address(pooledCreditLineAddress), address(borrowAsset), _currentDebt.sub(10));
        try borrower.repay(_id, _currentDebt) {
            revert('REVERT: Insufficient Balance');
        } catch Error(string memory reason) {
            if (!isForked) {
                assertEq(reason, 'ERC20: transfer amount exceeds allowance');
            } else {
                assertEq(reason, 'Dai/insufficient-allowance');
            }
        }
    }

    function test_borrowerCannotLiquidate() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_InvalidActorCannotLiquidate(_id, _amountToBorrow, address(borrower));
    }

    function test_adminCannotLiquidate() public {
        uint256 _amountToBorrow = request.borrowLimit;
        emit log_named_uint('request.borrowLimit', request.borrowLimit);
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_InvalidActorCannotLiquidate(_id, _amountToBorrow, address(admin));
    }

    function assert_InvalidActorCannotLiquidate(
        uint256 _id,
        uint256 _amountToBorrow,
        address _actor
    ) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        uint256 _borrowable = pcl.calculateBorrowableAmount(_id);
        borrower.borrow(_id, _borrowable);

        vm.warp(block.timestamp + (request.duration / 2));

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(60000000000000000000);
        }

        if (_actor == address(admin)) {
            try admin.liquidate(_id, true) {
                revert('admin liquidating should revert');
            } catch Error(string memory reason) {
                assertEq(reason, 'LP:LIQ1');
            }
        } else {
            PCLUser _user = PCLUser(_actor);

            try _user.liquidate(_id, true) {
                revert('Invalid actor liquidating should revert');
            } catch Error(string memory reason) {
                assertEq(reason, 'LP:LIQ1');
            }
        }
    }

    function test_onlyLendersCanLiquidate() public {
        uint256 _amountToBorrow = request.borrowLimit / 3;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_onlyLendersCanLiquidate(_id, _amountToBorrow);
    }

    function assert_onlyLendersCanLiquidate(uint256 _id, uint256 _amountToBorrow) public {
        if (request.collateralRatio == 0) return;
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);
        uint256 _borrowable = pcl.calculateBorrowableAmount(_id);
        borrower.borrow(_id, _borrowable);

        vm.warp(block.timestamp + (request.duration / 2));

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(60000000000000000000);
        }

        PCLUser _lender = PCLUser(lenders[1].lenderAddress);
        uint256 _amountLent = lenders[1].amount;
        _lender.liquidate(_id, true);
        assertTrue(pcl.getStatusAndUpdate(_id) == PooledCreditLineStatus.LIQUIDATED);
    }

    function test_lenderCannotLiquidateZeroPrincipal() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_lenderCannotLiquidateZeroPrincipal(_id, _amountToBorrow);
    }

    function assert_lenderCannotLiquidateZeroPrincipal(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        vm.warp(block.timestamp + (request.duration / 2));
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.liquidate(_id, true) {
            revert('Lender liquidating should revert with zero principal');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    function test_lenderCannotLiquidateIfCollateralRatioExceedsIdeal() public {
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_lenderCannotLiquidateIfCollateralRatioExceedsIdeal(_id, _amountToBorrow);
    }

    function assert_lenderCannotLiquidateIfCollateralRatioExceedsIdeal(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);
        borrower.borrow(_id, _amountToBorrow / 2);

        vm.warp(block.timestamp + (request.duration / 2));
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.liquidate(_id, true) {
            revert('Lender liquidating should revert with if collateral ratio is more than ideal');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    function test_borrowerCannotTerminate() public {
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_borrowerCannotTerminate(_id);
    }

    function assert_borrowerCannotTerminate(uint256 _id) public {
        try borrower.terminate(_id) {
            revert('Borrower terminating PCL should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    function test_lenderCannotTerminate() public {
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_lenderCannotTerminate(_id);
    }

    function assert_lenderCannotTerminate(uint256 _id) public {
        PCLUser _lender = PCLUser(address(lenders[0].lenderAddress));
        try _lender.terminate(_id) {
            revert('Lender terminating PCL should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    function test_onlyAdminCanTerminate() public {
        uint256 _amountToBorrow = request.borrowLimit;
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_onlyAdminCanTerminate(_id, _amountToBorrow);
    }

    function assert_onlyAdminCanTerminate(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        borrower.borrow(_id, 90_000 * 10**(ERC20(address(borrowAsset)).decimals()));

        vm.warp(block.timestamp + (request.duration / 2));
        vm.roll(block.number + (request.duration / (2 * 20)));

        uint256 _adminCollateralAssetBalanceBefore = collateralAsset.balanceOf(address(admin));
        uint256 _adminBorrowAssetBalanceBefore = borrowAsset.balanceOf(address(admin));
        admin.terminate(_id);
        uint256 _adminCollateralAssetBalanceAfter = collateralAsset.balanceOf(address(admin));
        uint256 _adminBorrowAssetBalanceAfter = borrowAsset.balanceOf(address(admin));
        if (request.collateralAssetStrategy == compoundYieldAddress) {
            assertGe(_adminCollateralAssetBalanceAfter - _adminCollateralAssetBalanceBefore, _collateralRequired);
        } else {
            assertEq(_adminCollateralAssetBalanceAfter - _adminCollateralAssetBalanceBefore, _collateralRequired);
        }
        if (request.borrowAssetStrategy == compoundYieldAddress) {
            assertGe(
                _adminBorrowAssetBalanceAfter - _adminBorrowAssetBalanceBefore,
                (request.borrowLimit / 2) - 90_000 * 10**(ERC20(address(borrowAsset)).decimals())
            );
        } else {
            assertEq(
                _adminBorrowAssetBalanceAfter - _adminBorrowAssetBalanceBefore,
                (request.borrowLimit / 2) - 90_000 * 10**(ERC20(address(borrowAsset)).decimals())
            );
        }
    }

    function test_depositCollateral() public {
        uint256 _amount = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_depositCollateral(_id, _amount);
    }

    function assert_depositCollateral(uint256 _id, uint256 _amount) public {
        // lender.lend(_id, _amount);
        _amount = scaleToRange256(_amount, ERC20(address(collateralAsset)).decimals(), collateralAsset.totalSupply());
        admin.transferToken(address(collateralAsset), address(borrower), _amount);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _amount);
        borrower.depositCollateral(_id, _amount, false);
        uint256 _shares = IYield(request.collateralAssetStrategy).getSharesForTokens(_amount, address(collateralAsset));
        assertEq(pcl.depositedCollateralInShares(_id), _shares);
    }

    function test_depositCollateral_insufficientBalance() public {
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);

        admin.transferToken(address(collateralAsset), address(borrower), 10);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), 10);
        try borrower.depositCollateral(_id, 100, false) {
            revert('Insufficient Balance of collateral tokens');
        } catch Error(string memory reason) {
            if (!isForked) {
                assertEq(reason, 'ERC20: transfer amount exceeds balance');
            } else {
                assertEq(reason, 'SafeERC20: low-level call failed');
            }
        }
    }

    function test_depositZeroCollateral() public {
        uint256 _amount = 0;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / 2);
        assert_depositZeroCollateral(_id, _amount);
    }

    function assert_depositZeroCollateral(uint256 _id, uint256 _amount) public {
        // lender.lend(_id, _amount);
        admin.transferToken(address(collateralAsset), address(borrower), 100_000 * (10**ERC20(address(collateralAsset)).decimals()));
        borrower.setAllowance(
            pooledCreditLineAddress,
            address(collateralAsset),
            100_000 * (10**ERC20(address(collateralAsset)).decimals())
        );
        try borrower.depositCollateral(_id, _amount, false) {
            revert('Depositing zero collateral should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:DC1');
        }
    }

    function test_depositCollateralFromSavingsAccount() public {
        request.collateralAssetStrategy = compoundYieldAddress;
        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit);
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, request.borrowLimit.div(2));
        emit log_named_decimal_uint('_collateralRequired', _collateralRequired, ERC20(address(collateralAsset)).decimals());
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(compoundYieldAddress, address(collateralAsset), _collateralRequired);
        if (request.collateralRatio != 0) {
            borrower.depositToSavingsAccount(
                savingsAccountAddress,
                _collateralRequired,
                address(collateralAsset),
                compoundYieldAddress,
                address(borrower)
            );
        }
        uint256 _totalTokens = SavingsAccount(savingsAccountAddress).getTotalTokens(address(borrower), address(collateralAsset));
        emit log_named_uint('total tokens: ', _totalTokens);
        uint256 _curBalanceInShares = SavingsAccount(savingsAccountAddress).balanceInShares(
            address(borrower),
            address(collateralAsset),
            address(compoundYieldAddress)
        );
        emit log_named_uint('_curBalanceInShares: ', _curBalanceInShares);
        emit log_named_uint('required collateral: ', _collateralRequired);
        borrower.setAllowanceForSavingsAccount(
            savingsAccountAddress,
            _collateralRequired,
            address(collateralAsset),
            pooledCreditLineAddress
        );
        _helperDepositCollateral(borrower, _id, _collateralRequired, true);
        uint256 _borrowAbleAmount = pcl.calculateBorrowableAmount(_id);
        emit log_named_uint('_borrowAbleAmount: ', _borrowAbleAmount);
        // assertEq(_borrowAbleAmount, _amountToBorrow);
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(_id);
        emit log_named_uint('_withdrawableCollateral: ', _withdrawableCollateral);
        if (request.collateralRatio != 0) {
            borrower.withdrawAllCollateral(_id, true);
        }
        uint256 _finalBalanceInShares = SavingsAccount(savingsAccountAddress).balanceInShares(
            address(borrower),
            address(collateralAsset),
            address(compoundYieldAddress)
        );
        emit log_named_uint('_finalBalanceInShares: ', _finalBalanceInShares);
        uint256 _pclBalanceInShares = SavingsAccount(savingsAccountAddress).balanceInShares(
            pooledCreditLineAddress,
            address(collateralAsset),
            address(compoundYieldAddress)
        );
        emit log_named_uint('_pclBalanceInShares: ', _pclBalanceInShares);
        assertApproxEqRel(_withdrawableCollateral + _pclBalanceInShares, _collateralRequired, 1e14);
    }

    function test_adminCannotCancelRequest() public {
        assert_CannotCancelRequest_InvalidActor(requestId, address(admin));
    }

    function test_lenderCannotCancelRequest() public {
        assert_CannotCancelRequest_InvalidActor(requestId, lenders[0].lenderAddress);
    }

    function assert_CannotCancelRequest_InvalidActor(uint256 _id, address _actor) public {
        if (_actor == address(admin)) {
            try admin.cancelRequest(_id) {
                revert('Admin cannot cancel PCL');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        } else {
            PCLUser _user = PCLUser(_actor);
            try _user.cancelRequest(_id) {
                revert('Invalid actor cannot cancel PCL');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:OCLB1');
            }
        }
    }

    function test_borrowerCannotCancelRequest() public {
        assert_borrowerCannotCancelRequest(requestId);
    }

    function assert_borrowerCannotCancelRequest(uint256 _id) public {
        try borrower.cancelRequest(_id) {
            revert('Canceling a PCL in active stage should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:CR1');
        }
    }

    function test_borrowerCannotRepayZeroCurrentDebt(uint128 _seed) public {
        _seed = scaleToRange128(_seed, 1, 10);
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / _seed);
        assert_borrowerCannotRepayZeroCurrentDebt(_id, _amountToBorrow);
    }

    function assert_borrowerCannotRepayZeroCurrentDebt(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);

        try borrower.repay(_id, 1) {
            revert('Borrower should not be able to repay zero current debt');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:REP3');
        }
    }

    function test_borrowerCannotRepayIfInterestIsZero(uint128 _seed) public {
        _seed = scaleToRange128(_seed, 1, 10);
        uint256 _amountToBorrow = request.borrowLimit;

        (uint256 _id, ) = goToActiveStage(10, request.borrowLimit / _seed);
        assert_borrowerCannotRepayIfInterestIsZero(_id, _amountToBorrow);
    }

    function assert_borrowerCannotRepayIfInterestIsZero(uint256 _id, uint256 _amountToBorrow) public {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
        uint256 _borrowAssetDecimalScaling = 10**(ERC20(address(borrowAsset)).decimals());

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, _id, _collateralRequired, false);
        borrower.borrow(_id, 90_000 * _borrowAssetDecimalScaling);

        try borrower.repay(_id, 1) {
            revert('Borrower should not be able to repay if interest is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:REP4');
        }
    }

    function assert_borrowerCannotReceivePoolTokens(uint256 _id) public {
        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        uint256 _balance = lp.balanceOf(_lenderInfo.lenderAddress, _id);
        log_named_uint('lender lp balance: ', _balance);
        try _lender.transferLPTokens(address(borrower), _id, _balance) {
            revert('should not have been possible to send LP tokens to the borrower');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT2');
        }
    }

    function test_borrowerCannotReceivePoolTokens() public {
        assert_borrowerCannotReceivePoolTokens(requestId);
        request.borrowerVerifier = mockAdminVerifier1;
        borrower.registerSelf(mockAdminVerifier1);
        (uint256 _id, ) = goToActiveStage(5, request.borrowLimit);
        assert_borrowerCannotReceivePoolTokens(_id);
    }

    function assert_canTransferPoolTokensToVerifiedUser(
        uint256 _id,
        address _recevingAddress,
        uint256 _amount
    ) public {
        // borrowing some tokens
        {
            uint256 _borrowAssetDecimalScaling = 10**(ERC20(address(borrowAsset)).decimals());
            uint256 _amountToBorrow = 100_000 * _borrowAssetDecimalScaling;
            uint256 _collateralRequired = pcl.getRequiredCollateral(_id, _amountToBorrow);
            admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
            borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
            _helperDepositCollateral(borrower, _id, _collateralRequired, false);
            borrower.borrow(_id, 90_000 * _borrowAssetDecimalScaling);

            // going ahead in time to generate interest
            vm.warp(block.timestamp + 6 days);
            // repaying the interest and some principal back
            borrower.setAllowance(pooledCreditLineAddress, address(borrowAsset), 10_000 * _borrowAssetDecimalScaling);
            borrower.repay(_id, 10_000 * _borrowAssetDecimalScaling);
        }

        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        // withdrawing interest to set borrowerInterestSharesWithdrawn (BISW) for the lender
        _lender.withdrawInterest(_id);

        uint256 prevLenderBISW = lp.getLenderInfo(_id, _lenderInfo.lenderAddress).borrowerInterestSharesWithdrawn;
        uint256 prevLenderYISW = lp.getLenderInfo(_id, _lenderInfo.lenderAddress).yieldInterestWithdrawnShares;
        // calculating the receivers interest in shares
        uint256 receiverInterestInTokens = lp.getLenderInterestWithdrawable(_id, _recevingAddress);
        uint256 receiverInterestInShares = IYield(request.borrowAssetStrategy).getSharesForTokens(
            receiverInterestInTokens,
            address(borrowAsset)
        );

        uint256 _prevBalance = lp.balanceOf(_recevingAddress, _id);
        _lender.transferLPTokens(_recevingAddress, _id, _amount);

        uint256 _finalBalance = lp.balanceOf(_recevingAddress, _id);
        assertEq(_finalBalance - _prevBalance, _amount);

        uint256 curLenderISW = lp.getLenderInfo(_id, _lenderInfo.lenderAddress).borrowerInterestSharesWithdrawn;
        curLenderISW = curLenderISW + lp.getLenderInfo(_id, _lenderInfo.lenderAddress).yieldInterestWithdrawnShares;
        uint256 curReceiverISW = lp.getLenderInfo(_id, _recevingAddress).borrowerInterestSharesWithdrawn;
        curReceiverISW = curReceiverISW + lp.getLenderInfo(_id, _recevingAddress).yieldInterestWithdrawnShares;
        assertApproxEqRel(curReceiverISW, prevLenderBISW + prevLenderYISW - curLenderISW + receiverInterestInShares, 1e14);
    }

    function assert_cannotTransferEcxessPoolTokens(
        uint256 _id,
        address _recevingAddress,
        uint256 _amount
    ) public {
        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        try _lender.transferLPTokens(_recevingAddress, _id, _amount) {
            revert('balance less than the amount to transfer');
        } catch Error(string memory reason) {
            // assertEq(reason, 'ERC1155: insufficient balance for transfer');
            assertEq(reason, 'SafeMath: subtraction overflow');
        }
    }

    function assert_cannotTransferPoolTokensToNotVerifiedUser(uint256 _id, address _newUserAddress) public {
        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        uint256 _balance = lp.balanceOf(_lenderInfo.lenderAddress, _id);
        log_named_uint('lender lp balance: ', _balance);
        // testing when user is not verified
        try _lender.transferLPTokens(_newUserAddress, _id, _balance) {
            revert('should not have been possible to send LP tokens to not verified user');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT3');
        }
    }

    function test_lenderTransfersTokenToAnotherLender() public {
        LenderInfo memory _lenderInfo = lenders[0];
        uint256 _balance = lp.balanceOf(_lenderInfo.lenderAddress, requestId);
        address _recevingAddress = lenders[1].lenderAddress;
        assert_canTransferPoolTokensToVerifiedUser(requestId, _recevingAddress, _balance / 3);
        assert_cannotTransferEcxessPoolTokens(requestId, _recevingAddress, _balance);
    }

    function test_lenderTransferTokenToNewUser() public {
        PCLUser _newUser = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        assert_cannotTransferPoolTokensToNotVerifiedUser(requestId, address(_newUser));

        // testing when user is verified
        _newUser.registerSelf(mockAdminVerifier1);

        LenderInfo memory _lenderInfo = lenders[0];
        uint256 _balance = lp.balanceOf(_lenderInfo.lenderAddress, requestId);

        assert_canTransferPoolTokensToVerifiedUser(requestId, address(_newUser), _balance / 3);
    }

    function test_areTokensTransferable() public {
        request.areTokensTransferable = false;
        (uint256 _requestId, ) = goToActiveStage(10, request.borrowLimit);
        LenderInfo memory _lenderInfo = lenders[0];

        address _recevingAddress = lenders[1].lenderAddress;
        uint256 _balance = lp.balanceOf(_lenderInfo.lenderAddress, _requestId);
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        try _lender.transferLPTokens(_recevingAddress, _requestId, _balance) {
            revert('should not have been possible to send LP tokens to the borrower');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:IT5');
        }
    }

    function test_canTransferPoolTokensWhenZeroInterest() public {
        PCLUser _lenderFrom = PCLUser(lenders[0].lenderAddress);
        uint256 _startBalanceLenderFrom = lp.balanceOf(address(_lenderFrom), requestId);
        assertGe(_startBalanceLenderFrom, 0);
        assertEq(lp.getLenderInterestWithdrawable(requestId, address(_lenderFrom)), 0);

        PCLUser _lenderTo = PCLUser(lenders[1].lenderAddress);
        uint256 _startBalanceLenderTo = lp.balanceOf(address(_lenderTo), requestId);
        assertGe(_startBalanceLenderTo, 0);
        assertEq(lp.getLenderInterestWithdrawable(requestId, address(_lenderTo)), 0);

        _lenderFrom.transferLPTokens(address(_lenderTo), requestId, _startBalanceLenderFrom);
        assertEq(0, lp.balanceOf(address(_lenderFrom), requestId));
        assertEq(lp.balanceOf(address(_lenderTo), requestId), _startBalanceLenderFrom.add(_startBalanceLenderTo));
    }

    function test_cannotWithdrawZeroInterest() public {
        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);

        // cannot withdraw zero interest
        vm.expectRevert(bytes('LP:WI1'));
        _lender.withdrawInterest(requestId);
    }

    function test_newPoolTokenHolderCanWithdrawInterest() public {
        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        PCLUser _newUser = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _newUser.registerSelf(mockAdminVerifier1);
        uint256 _balance = lp.balanceOf(_lenderInfo.lenderAddress, requestId);
        _lender.transferLPTokens(address(_newUser), requestId, _balance);
        uint256 _newUserBalance = lp.balanceOf(address(_newUser), requestId);
        assertEq(_newUserBalance, _balance);
        // borrowing some tokens
        uint256 _amountToBorrow = request.borrowLimit;
        uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, requestId, _collateralRequired, false);
        borrower.borrow(requestId, 90_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        // going ahead in time to generate interest
        vm.warp(block.timestamp + 6 days);
        // repaying the interest and some principal back
        borrower.setAllowance(pooledCreditLineAddress, address(borrowAsset), 10_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        borrower.repay(requestId, 10_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        // fetch borrowerInterestSharesWithdrawn for new user
        uint256 _prevBISW = lp.getLenderInfo(requestId, address(_newUser)).borrowerInterestSharesWithdrawn;
        assertEq(_prevBISW, 0);
        // get the interest for the new user
        uint256 _interestInTokens = lp.getLenderInterestWithdrawable(requestId, address(_newUser));
        uint256 _interestInShares = IYield(request.borrowAssetStrategy).getSharesForTokens(_interestInTokens, address(borrowAsset));
        // withdrawing interest to set borrowerInterestSharesWithdrawn (BISW) for the newUser
        _newUser.withdrawInterest(requestId);
        uint256 _curBISW = lp.getLenderInfo(requestId, address(_newUser)).borrowerInterestSharesWithdrawn;
        uint256 _curYISW = lp.getLenderInfo(requestId, address(_newUser)).yieldInterestWithdrawnShares;
        // match the interest shares withdrawn with the interest calculated
        assertApproxEqRel(_curBISW + _curYISW, _interestInShares, 1e14);
    }

    function test_stateAfterBorrow() public {
        admin.updateProtocolFeeFraction(0);

        uint256 _amountToBorrow = request.borrowLimit;
        uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, requestId, _collateralRequired, false);

        uint256 _expectedCollateralShares = IYield(request.collateralAssetStrategy).getSharesForTokens(
            _collateralRequired,
            address(collateralAsset)
        );
        uint256 _actualCollateralShares = pcl.depositedCollateralInShares(requestId);
        assertEq(_expectedCollateralShares, _actualCollateralShares);

        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        emit log_named_uint('borrowable amount', _borrowableAmount);
        assertApproxEqRel(_amountToBorrow, _borrowableAmount, 1e14);

        uint256 _borrowerBalanceBefore = borrowAsset.balanceOf(address(borrower));
        borrower.borrow(requestId, _borrowableAmount);
        uint256 _borrowerBalanceAfter = borrowAsset.balanceOf(address(borrower));

        assertApproxEqRel(_borrowerBalanceAfter - _borrowerBalanceBefore, _borrowableAmount, 1e14);
        assertApproxEqRel(pcl.calculateCurrentDebt(requestId), _amountToBorrow, 1e14);
    }

    function assert_calculateBorrowableAmountAndRequiredCollateral(uint128 _amountToBorrow, uint256 _borrowFraction) public {
        _borrowFraction = scaleToRange256(_borrowFraction, 1e16, pcl.SCALING_FACTOR());
        _amountToBorrow = scaleToRange128(_amountToBorrow, uint128(request.minBorrowAmount), request.borrowLimit);
        uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, _amountToBorrow);
        emit log_named_uint('_collateralRequired: ', _collateralRequired);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, requestId, _collateralRequired, false);
        // borrow some amount
        uint256 _curBorrowAmount = _amountToBorrow.mul(_borrowFraction).div(pcl.SCALING_FACTOR());
        if (_curBorrowAmount == _amountToBorrow) {
            _curBorrowAmount = _curBorrowAmount.mul(90).div(100);
        }
        borrower.borrow(requestId, _curBorrowAmount);
        // check borrow able amount
        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        if (request.collateralRatio != 0) {
            assertApproxEqRel(_borrowableAmount, _amountToBorrow.sub(_curBorrowAmount), 1e14);
        } else {
            assertApproxEqRel(_borrowableAmount, request.borrowLimit.sub(_curBorrowAmount), 1e14);
        }
        // now check withdrawableCollateral
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        uint256 _curCollateralRequired = pcl.getRequiredCollateral(requestId, _curBorrowAmount);
        assertApproxEqRel(_withdrawableCollateral, _collateralRequired.sub(_curCollateralRequired), 1e14);
    }

    function test_calculateBorrowableAmountAndRequiredCollateral(uint128 _amountToBorrow, uint256 _borrowFraction) public {
        assert_calculateBorrowableAmountAndRequiredCollateral(_amountToBorrow, _borrowFraction);
    }

    function test_collateralTokensToLiquidate(uint128 _borrowAmount) public {
        _borrowAmount = scaleToRange128(_borrowAmount, 1e6, request.borrowLimit);
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 _calculatedTokensToLiquidate = _borrowAmount.mul(10**_decimals).div(_ratioOfPrices);
        assertEq(_calculatedTokensToLiquidate, pcl.getEquivalentCollateralTokens(requestId, _borrowAmount));
    }

    function test_calculateCurrentCollateralRatio(uint256 _collateralAmount, uint256 _collateralRatioToAchieve) public {
        if (request.collateralRatio == 0) return;
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracleAddress).getLatestPrice(
            address(collateralAsset),
            address(borrowAsset)
        );
        uint256 _maxCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit);
        uint256 _minCollateral = pcl.getRequiredCollateral(requestId, 1e3 * (10**ERC20(address(borrowAsset)).decimals()));
        emit log_named_uint('_maxCollateral: ', _maxCollateral);
        emit log_named_uint('_minCollateral: ', _minCollateral);
        _collateralAmount = scaleToRange256(_collateralAmount, _minCollateral, _maxCollateral);
        emit log_named_uint('_collateralAmount: ', _collateralAmount);
        _collateralRatioToAchieve = scaleToRange256(_collateralRatioToAchieve, request.collateralRatio, 1e22);
        emit log_named_uint('_collateralRatioToAchieve: ', _collateralRatioToAchieve);
        // calulating what should borrowed to achieve _collateralRatioToAchieve
        uint256 _amountToBorrow = _collateralAmount.mul(_ratioOfPrices).div(10**_decimals).mul(pcl.SCALING_FACTOR()).div(
            _collateralRatioToAchieve
        );
        emit log_named_uint('_amountToBorrow: ', _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralAmount);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralAmount);
        _helperDepositCollateral(borrower, requestId, _collateralAmount, false);
        assertApproxEqRel(_collateralAmount, pcl.calculateTotalCollateralTokens(requestId), 1e14);

        uint256 _maxBorrowable = pcl.calculateBorrowableAmount(requestId);
        emit log_named_uint('_maxBorrowable: ', _maxBorrowable);
        if (
            request.collateralRatio != 0 && ((_collateralRatioToAchieve - request.collateralRatio) * 1e18) / request.collateralRatio <= 1e14
        ) {
            assertApproxEqRel(_amountToBorrow, _maxBorrowable, 1e14);
            if (_amountToBorrow > _maxBorrowable) {
                _amountToBorrow = _maxBorrowable;
            }
        } else {
            assertLe(_amountToBorrow, _maxBorrowable);
        }

        borrower.borrow(requestId, _amountToBorrow);
        uint256 _currentDebt = pcl.calculateCurrentDebt(requestId);
        assertApproxEqRel(_currentDebt, _amountToBorrow, 1e14);

        uint256 _curCollateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        emit log_named_uint('_curCollateralRatio: ', _curCollateralRatio);
        // 0.01% diff between _curCollateralRatio and _collateralRatioToAchieve
        assertApproxEqRel(_curCollateralRatio, _collateralRatioToAchieve, 1e14);
    }

    function test_closeActivePCLOncePrincipalPaidAndEnded() public {
        // borrowing some tokens
        uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, request.borrowLimit);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, requestId, _collateralRequired, false);
        borrower.borrow(requestId, 90_000 * 10**(ERC20(address(borrowAsset)).decimals()));
        // going ahead in time to generate interest
        vm.warp(block.timestamp + 6 days);
        // repay everything back
        uint256 _currentDebt = pcl.calculateCurrentDebt(requestId);
        uint256 _balance = borrowAsset.balanceOf(address(borrower));
        if (_currentDebt > _balance) {
            admin.transferToken(address(borrowAsset), address(borrower), _currentDebt.sub(_balance));
        }
        borrower.setAllowance(pooledCreditLineAddress, address(borrowAsset), _currentDebt);
        borrower.repay(requestId, _currentDebt);
        // go to end of pcl
        vm.warp(block.timestamp + request.collectionPeriod + request.duration);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
        assertEq(0, borrowAsset.balanceOf(address(borrower)));
    }

    event CollateralSharesWithdrawn(uint256 indexed id, uint256 amount);

    function test_closeWhenNoCollateral() public {
        vm.warp(block.timestamp + 6 days);
        // close
        borrower.close(requestId);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);
    }

    function test_closeWhenCollateral() public {
        uint256 _collateralAmount = 1e2 * 10**ERC20(address(collateralAsset)).decimals();
        admin.transferToken(address(collateralAsset), address(borrower), _collateralAmount);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralAmount);
        _helperDepositCollateral(borrower, requestId, _collateralAmount, false);
        uint256 _startBalance = collateralAsset.balanceOf(address(borrower));
        vm.warp(block.timestamp + 6 days);
        vm.roll(block.number + (6 * 86400) / 20);
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        uint256 _shares = IYield(request.collateralAssetStrategy).getSharesForTokens(_withdrawableCollateral, address(collateralAsset));
        vm.expectEmit(true, true, false, false);
        emit CollateralSharesWithdrawn(requestId, _shares);
        // close
        borrower.close(requestId);
        // this is equal only when no yield is used
        // with compund this should be assertLe becuase deposited collateral would earn yield
        if (request.collateralAssetStrategy == compoundYieldAddress) {
            assertLe(_startBalance.add(_collateralAmount), collateralAsset.balanceOf(address(borrower)));
        } else {
            assertEq(_startBalance.add(_collateralAmount), collateralAsset.balanceOf(address(borrower)));
        }
    }

    event LiquidationWithdrawn(uint256 indexed id, address indexed user, uint256 collateralShare);
    event WithdrawLiquidity(uint256 indexed id, address indexed user, uint256 shares);

    function test_withdrawLiquidatedCollateral() public {
        if (request.collateralRatio == 0) return;
        // borrowing some tokens
        uint256 _amountToBorrow = request.borrowLimit.mul(7).div(11);
        uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, requestId, _collateralRequired, false);
        uint256 _borrowable = pcl.calculateBorrowableAmount(requestId);
        borrower.borrow(requestId, _borrowable.sub(10));
        uint256 _sharesHeld = IYield(request.borrowAssetStrategy).getSharesForTokens(
            request.borrowLimit - _borrowable.sub(10),
            address(borrowAsset)
        );
        // going ahead in time to make liquidation possible
        vm.warp(block.timestamp + 50 days);
        assertLt(pcl.calculateCurrentCollateralRatio(requestId), request.collateralRatio);
        uint256 _principalBorowable = request.borrowLimit.sub(pcl.getPrincipal(requestId));

        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        uint256 _totalSupply = lp.totalSupply(requestId);
        uint256 _lenderLpBalance = lp.balanceOf(address(_lender), requestId);

        uint256 _lenderCollateralShare = _collateralRequired.mul(_lenderLpBalance).div(_totalSupply);
        uint256 _lenderLiquidityShare = _principalBorowable.mul(_lenderLpBalance).div(_totalSupply);
        uint256 _principalBorowableInShares = IYield(request.borrowAssetStrategy).getSharesForTokens(
            _principalBorowable,
            address(borrowAsset)
        );
        uint256 _lenderYieldShares = (_sharesHeld - _principalBorowableInShares).mul(_lenderLpBalance).div(_totalSupply);
        uint256 _shares = IYield(request.borrowAssetStrategy).getSharesForTokens(_lenderLiquidityShare, address(borrowAsset)) +
            _lenderYieldShares;

        vm.expectEmit(true, true, false, false);
        emit WithdrawLiquidity(requestId, _lenderInfo.lenderAddress, _shares);
        _lender.liquidate(requestId, true);
        if (request.collateralAssetStrategy == compoundYieldAddress) {
            assertLe(_lenderCollateralShare, collateralAsset.balanceOf(address(_lender)));
        } else {
            assertEq(_lenderCollateralShare, collateralAsset.balanceOf(address(_lender)));
        }
    }

    event PooledCreditLineTerminated(uint256 indexed id);

    function test_terminateAfterLiquidation() public {
        if (request.collateralRatio == 0) return;
        // borrowing some tokens
        uint256 _amountToBorrow = request.borrowLimit.mul(7).div(11);
        uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, _amountToBorrow);
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        _helperDepositCollateral(borrower, requestId, _collateralRequired, false);
        uint256 _borrowable = pcl.calculateBorrowableAmount(requestId);
        borrower.borrow(requestId, _borrowable);
        uint256 _sharesHeld = IYield(request.borrowAssetStrategy).getSharesForTokens(
            request.borrowLimit - _borrowable,
            address(borrowAsset)
        );

        // going ahead in time to make liquidation possible
        vm.warp(block.timestamp + request.duration.mul(7).div(11));
        vm.roll(block.number + request.duration.mul(7).div(11).div(20));
        assertLt(pcl.calculateCurrentCollateralRatio(requestId), request.collateralRatio);
        uint256 _principalBorowable = request.borrowLimit.sub(pcl.getPrincipal(requestId));

        LenderInfo memory _lenderInfo = lenders[0];
        PCLUser _lender = PCLUser(_lenderInfo.lenderAddress);
        uint256 _totalSupply = lp.totalSupply(requestId);
        uint256 _lenderLpBalance = lp.balanceOf(address(_lender), requestId);
        uint256 _lenderCollateralShare = _collateralRequired.mul(_lenderLpBalance).div(_totalSupply);
        uint256 _lenderLiquidityShare = _principalBorowable.mul(_lenderLpBalance).div(_totalSupply);
        uint256 _principalBorowableInShares = IYield(request.borrowAssetStrategy).getSharesForTokens(
            _principalBorowable,
            address(borrowAsset)
        );
        uint256 _lenderYieldShares = (_sharesHeld - _principalBorowableInShares).mul(_lenderLpBalance).div(_totalSupply);
        uint256 _shares = IYield(request.borrowAssetStrategy).getSharesForTokens(_lenderLiquidityShare, address(borrowAsset)) +
            _lenderYieldShares;
        vm.expectEmit(true, true, false, false);

        emit WithdrawLiquidity(requestId, _lenderInfo.lenderAddress, _shares);
        _lender.liquidate(requestId, true);

        uint256 _startBorrowAssetBalance = borrowAsset.balanceOf(address(admin));
        uint256 _startCollateralAssetBalance = collateralAsset.balanceOf(address(admin));

        uint256 _lenderPoolCollateralAssetBalance = collateralAsset.balanceOf(address(lp));
        emit log_named_uint('_lenderPoolCollateralAssetBalance: ', _lenderPoolCollateralAssetBalance);
        // for an active pcl borrowLimit == total amount lent
        _totalSupply = lp.totalSupply(requestId);
        // (uint256 _borrowLimit, , , , , , , , , , , ) = pcl.pooledCreditLineConstants(requestId);
        // uint256 _borrowAssetInLenderPool = _borrowLimit.sub(pcl.getPrincipal(requestId)).mul(_totalSupply).div(_borrowLimit);
        // emit log_named_uint('_borrowAssetInLenderPool: ', _borrowAssetInLenderPool);

        // now the admin terminates
        vm.expectEmit(true, true, false, true);
        emit PooledCreditLineTerminated(requestId);
        admin.terminate(requestId);

        assertEq(_startCollateralAssetBalance.add(_lenderPoolCollateralAssetBalance), collateralAsset.balanceOf(address(admin)));

        if (request.borrowAssetStrategy == compoundYieldAddress) {
            // assertLe(_startBorrowAssetBalance.add(_borrowAssetInLenderPool), borrowAsset.balanceOf(address(admin)));
        } else {
            // assertEq(_startBorrowAssetBalance.add(_borrowAssetInLenderPool), borrowAsset.balanceOf(address(admin)));
        }
    }

    function _helperDepositCollateral(
        PCLUser _user,
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount
    ) private {
        if (_amount != 0) {
            _user.depositCollateral(_id, _amount, _fromSavingsAccount);
        }
    }
}
