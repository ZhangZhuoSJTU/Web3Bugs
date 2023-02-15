// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../SublimeProxy.sol';
import '../../PooledCreditLine/PooledCreditLine.sol';
import '../../PooledCreditLine/LenderPool.sol';
import '../../PriceOracle.sol';
import '../../interfaces/IPriceOracle.sol';
import '../../SavingsAccount/SavingsAccount.sol';
import '../../yield/StrategyRegistry.sol';
import '../../yield/NoYield.sol';
import '../../yield/CompoundYield.sol';
import '../../mocks/MockV3Aggregator.sol';
import '../../mocks/MockToken.sol';
import '../../interfaces/IPooledCreditLineDeclarations.sol';
import '../../interfaces/ISavingsAccount.sol';
import './Helpers/PCLParent.t.sol';

contract PCLMaxBorrow is PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

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

    function setUp() public override {
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
        request.borrowAssetStrategy = compoundYieldAddress;
        request.collateralAssetStrategy = compoundYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;

        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit);
        // increasing by 2% because of precision errors
        //_requiredCollateral = _requiredCollateral.mul(101).div(100);
        admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
        borrower.depositCollateral(requestId, _requiredCollateral, false);
        // calculateBorrowableAmount
        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        // emit log_named_uint('_borrowableAmount', _borrowableAmount);
        // borrow the required amount
        borrower.borrow(requestId, _borrowableAmount);
        // emit log_named_uint('current debt', pcl.calculateCurrentDebt(requestId));
        // emit log_named_uint('principal', pcl.getPrincipal(requestId));
    }

    function test_calculateCurrentRatio() public {
        uint256 _collateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
        emit log_named_uint('request.collateralRatio', request.collateralRatio);
        emit log_named_uint('_collateralRatio', _collateralRatio);
        assertApproxEqRel(request.collateralRatio, _collateralRatio, 1e16);
    }

    function test_borrowAbleAmount() public {
        uint256 _borrowAble = pcl.calculateBorrowableAmount(requestId);
        // pcl always has 1 unit borrow able even after borrowing everything
        assertTrue(_borrowAble >= 1);
        emit log_named_uint('_borrowAble', _borrowAble);
    }

    function test_borrowOneUint() public {
        uint256 _borrowAble = pcl.calculateBorrowableAmount(requestId);
        vm.expectRevert(bytes('PCL:IWBA1'));
        borrower.borrow(requestId, _borrowAble);
    }

    function test_withdrawableCollateral() public {
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        // because not all tokens were borrowed
        assertTrue(_withdrawableCollateral > 0);
        emit log_named_uint('withdrawableCollateral', _withdrawableCollateral);
    }

    event CollateralSharesWithdrawn(uint256 indexed id, uint256 shares);

    function test_withdrawCollateral() public {
        uint256 _amount = pcl.withdrawableCollateral(requestId);
        uint256 _amountInShares = IYield(request.collateralAssetStrategy).getSharesForTokens(_amount, request.collateralAsset);
        emit log_named_uint('_amountInShares', _amountInShares);
        uint256 _prevBalance = collateralAsset.balanceOf(address(borrower));
        vm.expectEmit(true, true, true, true);
        emit CollateralSharesWithdrawn(requestId, _amountInShares);
        borrower.withdrawCollateral(requestId, _amount, false);
        uint256 _curBalance = collateralAsset.balanceOf(address(borrower));
        emit log_named_uint('withdrawableCollateral', pcl.withdrawableCollateral(requestId));
        assertTrue(pcl.withdrawableCollateral(requestId) <= 1);
    }

    function test_repay() public {
        _increaseBlock(block.timestamp + 1 days);
        borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, 1);
        uint256 _prevDebt = pcl.calculateCurrentDebt(requestId);
        emit log_named_uint('_prevDebt', _prevDebt);
        borrower.repay(requestId, 1);
        uint256 _curDebt = pcl.calculateCurrentDebt(requestId);
        emit log_named_uint('_curDebt', _curDebt);
        assertTrue(_prevDebt.sub(_curDebt) == 1);
    }

    function test_liquidate() public {
        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        _increaseBlock(block.timestamp + request.duration + request.defaultGracePeriod);
        uint256 _lpBalanceBorrowAsset = ISavingsAccount(savingsAccountAddress).getTotalTokens(lenderPoolAddress, request.borrowAsset);
        uint256 _expectedBorrowAssetTransferred = _lpBalanceBorrowAsset.mul(lp.balanceOf(address(_lender), requestId)).div(
            lp.totalSupply(requestId)
        );
        emit log_named_uint('_expectedBorrowAssetTransferred', _expectedBorrowAssetTransferred);
        uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
        emit log_named_uint('_withdrawableCollateral', _withdrawableCollateral);
        uint256 _collateralTokens = pcl.calculateTotalCollateralTokens(requestId);
        emit log_named_uint('_collateralTokens', _collateralTokens);
        uint256 _maxCollateralTransferred = _collateralTokens.mul(lp.balanceOf(address(_lender), requestId)).div(lp.totalSupply(requestId));
        emit log_named_uint('_maxCollateralTransferred', _maxCollateralTransferred);
        uint256 _prevBalanceBorrowAsset = borrowAsset.balanceOf(address(_lender));
        uint256 _prevBalanceCollateralAsset = collateralAsset.balanceOf(address(_lender));
        _lender.liquidate(requestId, true);
        uint256 _finalBalanceBorrowAsset = borrowAsset.balanceOf(address(_lender));
        uint256 _finalBalanceCollateralAsset = collateralAsset.balanceOf(address(_lender));
        // no principal left to withdraw
        emit log_named_uint('_prevBalanceBorrowAsset', _prevBalanceBorrowAsset);
        emit log_named_uint('_finalBalanceBorrowAsset', _finalBalanceBorrowAsset);
        assertApproxEqRel(_finalBalanceBorrowAsset.sub(_prevBalanceBorrowAsset), _expectedBorrowAssetTransferred, 1e14);
        emit log_named_uint('actual collateral transferred', _finalBalanceCollateralAsset.sub(_prevBalanceCollateralAsset));
        assertTrue(_finalBalanceCollateralAsset.sub(_prevBalanceCollateralAsset) <= _maxCollateralTransferred);
    }

    event InterestWithdrawn(uint256 indexed id, address indexed user, uint256 shares);

    function test_withdrawInterest(uint256 fractionOfRepaymentAmount) public {
        uint256 size = 10000;
        if (fractionOfRepaymentAmount == 0) {
            fractionOfRepaymentAmount = size - 1;
        }
        PCLUser _lender1 = PCLUser(lenders[0].lenderAddress);
        PCLUser _lender2 = PCLUser(lenders[1].lenderAddress);
        PCLUser _lender3 = PCLUser(lenders[3].lenderAddress);
        fractionOfRepaymentAmount = fractionOfRepaymentAmount % size;
        _increaseBlock(block.timestamp + BLOCK_TIME * 10);

        uint256 _interestAmount = pcl.calculateInterestAccrued(requestId);
        uint256 _toRepay = _interestAmount.mul(fractionOfRepaymentAmount).div(size);
        if (_toRepay == 0) return;
        borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _toRepay);
        borrower.repay(requestId, _toRepay);
        vm.expectEmit(true, true, false, false);
        emit InterestWithdrawn(requestId, address(_lender1), 0);
        _lender1.withdrawInterest(requestId);

        _increaseBlock(block.timestamp + BLOCK_TIME);
        vm.expectEmit(true, true, false, false);
        emit InterestWithdrawn(requestId, address(_lender2), 0);
        _lender2.withdrawInterest(requestId);

        _increaseBlock(block.timestamp + BLOCK_TIME);
        vm.expectEmit(true, true, false, false);
        emit InterestWithdrawn(requestId, address(_lender3), 0);
        _lender3.withdrawInterest(requestId);
    }

    function test_terminate() public {
        uint256 _startBalanceBorrowAsset = borrowAsset.balanceOf(address(admin));
        uint256 _startBalanceCollateralAsset = collateralAsset.balanceOf(address(admin));
        uint256 _collateralTransferred = pcl.calculateTotalCollateralTokens(requestId);
        emit log_named_uint('_collateralTransferred', _collateralTransferred);
        admin.terminate(requestId);
        uint256 _endBalanceBorrowAsset = borrowAsset.balanceOf(address(admin));
        uint256 _endBalanceCollateralAsset = collateralAsset.balanceOf(address(admin));
        assertApproxEqRel(_collateralTransferred, _endBalanceCollateralAsset.sub(_startBalanceCollateralAsset), 1e16);
        assertTrue(_endBalanceBorrowAsset.sub(_startBalanceBorrowAsset) >= 1);
    }
}
