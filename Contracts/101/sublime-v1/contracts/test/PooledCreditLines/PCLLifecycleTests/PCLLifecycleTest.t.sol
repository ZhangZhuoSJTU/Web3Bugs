// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../Helpers/PCLParent.t.sol';

/*

possible paths:
- not created -> requested
- requested -> cancelled
- requested -> terminated
- requested -> active
- active -> closed
- active -> expired
- active -> liquidated
- active -> terminated
- liquidated -> terminated
- closed -> terminated
- expired -> terminated
- expired -> liquidated
- expired -> closed

enum PooledCreditLineStatus {
     NOT_CREATED,
     REQUESTED,
     ACTIVE,
     CLOSED,
     EXPIRED,
     LIQUIDATED,
     CANCELLED
     TERMINATED
}

*/

contract PCLLifecycleTest is PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;

    event PooledCreditLineAccepted(uint256 indexed id, uint256 amount);

    uint256 t0;
    uint256 requestId;
    uint128 amountToLend;
    uint256 randomNumber1;
    uint256 randomNumber2;
    uint256 randomNumber3;
    uint256 actualBorrowLimit;

    function setUp() public virtual override {
        super.setUp();

        t0 = block.timestamp;
        // fuzzed
        request.borrowLimit = uint128(1_000_000 * (10**ERC20(address(borrowAsset)).decimals()));
        request.borrowRate = uint128(PCLConstants.minBorrowRate.mul(5));
        // fuzzed
        request.collateralRatio = pcl.SCALING_FACTOR();
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = PCLConstants.maxDuration;
        request.lenderVerifier = mockAdminVerifier1;
        request.defaultGracePeriod = PCLConstants.minDefaultGraceDuration;
        request.gracePenaltyRate = (10 * pcl.SCALING_FACTOR()) / 1e2;
        request.collectionPeriod = PCLConstants.minCollectionPeriod;
        // fuzzed
        request.minBorrowAmount = 90_000 * (10**ERC20(address(borrowAsset)).decimals());
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;
    }

    function goToRequestedStageFuzzed(
        uint256 _borrowLimitInUsd,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        randomNumber1 = scaleToRange256(_randomNumber1, 1, 10);
        randomNumber2 = scaleToRange256(_randomNumber2, 2, 10);
        randomNumber3 = scaleToRange256(_randomNumber3, 3, 10);

        request.borrowRate = scaleToRange128(_amountToLend, PCLConstants.minBorrowRate, uint128(PCLConstants.maxBorrowRate.div(20)));
        emit log_named_uint('borrowRate', request.borrowRate);
        request.duration = PCLConstants.maxDuration.div(randomNumber3);
        request.collectionPeriod = PCLConstants.minCollectionPeriod.mul(randomNumber2);
        request.defaultGracePeriod = PCLConstants.minDefaultGraceDuration.mul(randomNumber1);

        {
            _borrowLimitInUsd = scaleToRange256(_borrowLimitInUsd, PCLConstants.minBorrowLimit, PCLConstants.maxBorrowLimit);
            emit log_named_uint('_borrowLimitInUsd', _borrowLimitInUsd);
            request.collateralRatio = scaleToRange256(_collateralRatio, PCLConstants.minCollateralRatio, PCLConstants.maxCollateralRatio);
            emit log_named_uint('request.collateralRatio', request.collateralRatio);

            if (_borrowLimitInUsd <= PCLConstants.minBorrowLimit.mul(110).div(100)) {
                request.collateralRatio = pcl.SCALING_FACTOR();
            }

            (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracleAddress).getLatestPrice(
                address(borrowAsset),
                address(usdc)
            );
            emit log_named_decimal_uint('_ratioOfPrices', _ratioOfPrices, _decimals);
            // adding 1 because of rounding down by division with _ratioOfPrices
            request.borrowLimit = uint128(_borrowLimitInUsd.mul(10**_decimals).div(_ratioOfPrices).add(1));
            emit log_named_uint('request.borrowLimit', request.borrowLimit);
            uint256 _minBorrowAmount;
            if (randomNumber3 < randomNumber2) {
                _minBorrowAmount = request.borrowLimit.mul(randomNumber3).div(randomNumber2);
            } else {
                _minBorrowAmount = request.borrowLimit.mul(randomNumber2).div(randomNumber3 + 1);
            }
            // convert _minBorrowAmount to usdc and compare with min in pcl constants
            if (_minBorrowAmount.mul(_ratioOfPrices).div(10**_decimals) < PCLConstants.minBorrowLimit) {
                _minBorrowAmount = PCLConstants.minBorrowLimit.mul(10**_decimals).div(_ratioOfPrices);
            }
            // adding 1 because of rounding down by division with _ratioOfPrices
            request.minBorrowAmount = _minBorrowAmount.add(1);
            emit log_named_uint('request.minBorrowAmount', request.minBorrowAmount);
        }

        // taking enough to go into active stage
        amountToLend = scaleToRange128(_amountToLend, uint128(request.minBorrowAmount), request.borrowLimit);
        emit log_named_uint('amountToLend', amountToLend);

        requestId = borrower.createRequest(request);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED);

        // move a bit ahead in time
        _increaseBlock(t0 + (request.collectionPeriod.div(randomNumber2)));

        numLenders = createMultipleLenders(requestId, randomNumber3, amountToLend, request.borrowAsset);
        emit log_named_uint('numLenders', numLenders);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.REQUESTED);
        // check total supply
        assertEq(amountToLend, lp.totalSupply(requestId));
    }

    function test_requestToActiveToLiquidatePCL(
        uint256 _borrowLimitInUsd,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        goToRequestedStageFuzzed(_borrowLimitInUsd, _collateralRatio, _amountToLend, _randomNumber1, _randomNumber2, _randomNumber3);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        {
            vm.expectRevert(bytes('PCL:IB2'));
            borrower.borrow(requestId, request.borrowLimit.div(randomNumber3));

            vm.expectRevert(bytes('LP:WI1'));
            _lender.withdrawInterest(requestId);

            vm.expectRevert(bytes('LP:IWL3'));
            _lender.withdrawLiquidity(requestId);

            vm.expectRevert(bytes('PCL:L1'));
            _lender.liquidate(requestId, false);

            vm.expectRevert(bytes('LP:IWLC1'));
            _lender.withdrawTokensAfterLiquidation(requestId);
        }

        // start the pcl
        {
            // go head in time
            _increaseBlock(t0 + request.collectionPeriod);
            vm.expectEmit(true, true, false, true);
            emit PooledCreditLineAccepted(requestId, amountToLend);
            borrower.start(requestId);
            // check status
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
        }

        {
            (, , , actualBorrowLimit, , , , ) = lp.pooledCLConstants(requestId);
        }

        uint256 _requiredCollateral;

        {
            // try to borrow some tokens
            uint256 _amountToBorrow = amountToLend.mul(randomNumber2).div(11);
            emit log_named_uint('_amountToBorrow', _amountToBorrow);
            bool isOverLimit;
            vm.expectRevert(bytes('PCL:IB3'));
            borrower.borrow(requestId, _amountToBorrow);
            // decide how much collateral is needed
            _requiredCollateral = pcl.getRequiredCollateral(requestId, _amountToBorrow);
            emit log_named_uint('_requiredCollateral', _requiredCollateral);
            if (_requiredCollateral > collateralAsset.balanceOf(address(admin))) {
                _requiredCollateral = collateralAsset.balanceOf(address(admin)).div(randomNumber3);
                isOverLimit = true;
            }
            admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
            borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
            borrower.depositCollateral(requestId, _requiredCollateral, false);
            uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
            emit log_named_uint('_borrowableAmount', _borrowableAmount);
            if (!isOverLimit) {
                // adding 1 for precision errors
                if (stdMath.delta(_amountToBorrow, _borrowableAmount) > 2 && _requiredCollateral > 1e3) {
                    assertApproxEqRel(_amountToBorrow, _borrowableAmount, 1e16);
                }
            }
            // borrow the required amount
            uint256 _startBalance = borrowAsset.balanceOf(address(borrower));
            borrower.borrow(requestId, _borrowableAmount);
            assertApproxEqRel(
                _borrowableAmount.mul(pcl.SCALING_FACTOR().sub(pcl.protocolFeeFraction())).div(pcl.SCALING_FACTOR()),
                borrowAsset.balanceOf(address(borrower)).sub(_startBalance),
                1e14
            );
        }

        {
            // verify current collateral ratio
            emit log_named_uint('_curCollateralRatio', pcl.calculateCurrentCollateralRatio(requestId));
            assertApproxEqRel(pcl.calculateCurrentCollateralRatio(requestId), request.collateralRatio, 1e14);
        }

        // go ahead in time to accrue interest
        _increaseBlock(t0 + request.collectionPeriod + request.duration.div(randomNumber3));

        uint256 _interestAccrued = pcl.calculateInterestAccrued(requestId);
        emit log_named_uint('_interestAccrued', _interestAccrued);

        {
            if (_interestAccrued > borrowAsset.balanceOf(address(borrower))) {
                if (_interestAccrued > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _interestAccrued);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _interestAccrued.sub(borrowAsset.balanceOf(address(borrower))));
            }
            // repay the interest only
            borrower.setAllowance(pooledCreditLineAddress, address(borrowAsset), _interestAccrued);
            borrower.repay(requestId, _interestAccrued);
        }

        uint256 _totalLenderInterest;

        {
            // get total lender interest
            for (uint256 i; i < numLenders; ++i) {
                _totalLenderInterest = _totalLenderInterest.add(lp.getLenderInterestWithdrawable(requestId, lenders[i].lenderAddress));
            }
            emit log_named_uint('_totalLenderInterest', _totalLenderInterest);

            (
                uint256 _sharesHeld,
                uint256 _borrowerInterestShares,
                uint256 _borrowerInterestSharesWithdrawn,
                uint256 _yieldInterestWithdrawnShares,

            ) = lp.pooledCLVariables(requestId);
            emit log_named_uint('_sharesHeld', _sharesHeld);
            emit log_named_uint('_borrowerInterestShares', _borrowerInterestShares);
            emit log_named_uint('_borrowerInterestSharesWithdrawn', _borrowerInterestSharesWithdrawn);
            emit log_named_uint('_yieldInterestWithdrawnShares', _yieldInterestWithdrawnShares);
            uint256 _notBorrowedInShares = IYield(request.borrowAssetStrategy).getSharesForTokens(
                actualBorrowLimit.sub(pcl.getPrincipal(requestId)),
                request.borrowAsset
            );
            emit log_named_uint('_notBorrowedInShares', _notBorrowedInShares);

            uint256 _expectedYieldInterestShares = _sharesHeld
                .sub(_notBorrowedInShares)
                .sub(_borrowerInterestShares)
                .sub(_borrowerInterestSharesWithdrawn)
                .sub(_yieldInterestWithdrawnShares);
            uint256 _expectedYieldInterest = IYield(request.borrowAssetStrategy).getTokensForShares(
                _expectedYieldInterestShares,
                request.borrowAsset
            );
            emit log_named_uint('_expectedYieldInterest', _expectedYieldInterest);
            assertApproxEqRel(_interestAccrued, _totalLenderInterest.sub(_expectedYieldInterest), 1e16);
        }

        {
            uint256 _totalWithdrawn;
            // lender withdraws interest
            uint256 _prevBalance = borrowAsset.balanceOf(address(_lender));
            uint256 _lenderInterest = lp.getLenderInterestWithdrawable(requestId, address(_lender));
            _lender.withdrawInterest(requestId);
            _totalWithdrawn = borrowAsset.balanceOf(address(_lender)).sub(_prevBalance);
            assertApproxEqRel(borrowAsset.balanceOf(address(_lender)).sub(_prevBalance), _lenderInterest, 1e16);

            uint256 _prevBalanceI;
            for (uint256 i = 1; i < numLenders; ++i) {
                _prevBalanceI = borrowAsset.balanceOf(lenders[i].lenderAddress);
                PCLUser(lenders[i].lenderAddress).withdrawInterest(requestId);
                _totalWithdrawn = _totalWithdrawn.add(borrowAsset.balanceOf(lenders[i].lenderAddress).sub(_prevBalanceI));
            }
            emit log_named_uint('_totalWithdrawn', _totalWithdrawn);
            assertApproxEqRel(_totalWithdrawn, _totalLenderInterest, 1e16);
        }

        {
            // borrow again
            vm.expectRevert(bytes('PCL:IB3'));
            borrower.borrow(requestId, amountToLend.div(randomNumber3));

            // go ahead in time a bit for more interest to accrued
            _increaseBlock(block.timestamp + request.duration.div(randomNumber3));
        }

        {
            emit log_named_uint('_curCollateralRatio', pcl.calculateCurrentCollateralRatio(requestId));
            if (pcl.calculateCurrentCollateralRatio(requestId) > request.collateralRatio) {
                // amount of collateral deposited has grown because of yield interest
                assertTrue(_requiredCollateral < pcl.calculateTotalCollateralTokens(requestId));
                _increaseBlock(t0 + request.collectionPeriod + request.duration + request.defaultGracePeriod);
            } else {
                assertLe(pcl.calculateCurrentCollateralRatio(requestId), request.collateralRatio);
            }
        }

        uint256 _startBalanceBorrowAssetLender = borrowAsset.balanceOf(address(_lender));
        uint256 _collateralTokensLiquidated = pcl.calculateTotalCollateralTokens(requestId);
        emit log_named_uint('_collateralTokensLiquidated', _collateralTokensLiquidated);
        uint256 _principalWithdrawable = actualBorrowLimit
            .sub(pcl.getPrincipal(requestId))
            .mul(lp.balanceOf(address(_lender), requestId))
            .div(lp.totalSupply(requestId));
        emit log_named_uint('_principalWithdrawable', _principalWithdrawable);
        uint256 _interestWithdrawable = lp.getLenderInterestWithdrawable(requestId, address(_lender));
        emit log_named_uint('_interestWithdrawable', _interestWithdrawable);

        // pcl can be liquidated
        {
            _lender.liquidate(requestId, true);
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
            uint256 _totalCollateral = pcl.calculateTotalCollateralTokens(requestId);
            emit log_named_uint('_totalCollateral', _totalCollateral);
            uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
            emit log_named_uint('_withdrawableCollateral', _withdrawableCollateral);

            assertEq(_withdrawableCollateral, _totalCollateral);

            if (_totalCollateral != 0) {
                _collateralTokensLiquidated = _collateralTokensLiquidated.sub(_withdrawableCollateral);
            }
        }

        // borrower still has borrowed assets minnus the paid interest
        // principal * (1 - protocal_fee) - interest paid == borrow asset balance of the borrower
        // not borrower balance of borrowAsset is 0 initially
        {
            uint256 _expectedBorrowAmountReceived = pcl
                .getPrincipal(requestId)
                .mul(pcl.SCALING_FACTOR().sub(pcl.protocolFeeFraction()))
                .div(pcl.SCALING_FACTOR());
            uint256 _expectedBorrowerBalance;
            if (_interestAccrued <= _expectedBorrowAmountReceived) {
                _expectedBorrowerBalance = _expectedBorrowAmountReceived.sub(_interestAccrued);
            } else {
                _expectedBorrowerBalance = 0;
            }
            emit log_named_uint('_expectedBorrowerBalance', _expectedBorrowerBalance);
            assertApproxEqAbs(_expectedBorrowerBalance, borrowAsset.balanceOf(address(borrower)), 2);
        }

        {
            // lender has the got back the principal left
            uint256 _expectedBorrowAssetWithdrawn = _principalWithdrawable.add(_interestWithdrawable);
            emit log_named_uint('_expectedBorrowAssetWithdrawn', _expectedBorrowAssetWithdrawn);
            assertApproxEqRel(
                _expectedBorrowAssetWithdrawn,
                borrowAsset.balanceOf(address(_lender)).sub(_startBalanceBorrowAssetLender),
                1e15
            );
        }
        {
            // lender has the got their share of the collateral
            // collateral_liquidated * lenders_lent_amount / total_lent_amount == collateral asset balance of the lender
            uint256 _lenderCollateral = _collateralTokensLiquidated.mul(lenders[0].amount).div(amountToLend);
            uint256 _collateralAssetBalance = collateralAsset.balanceOf(address(_lender));
            emit log_named_uint('_lenderCollateral', _lenderCollateral);
            emit log_named_uint('_collateralAssetBalance', _collateralAssetBalance);
            if (stdMath.delta(_lenderCollateral, _collateralAssetBalance) > 2) {
                assertApproxEqRel(_lenderCollateral, _collateralAssetBalance, 1e16);
            }
        }

        {
            PCLUser _lastLender = PCLUser(lenders[numLenders - 1].lenderAddress);
            uint256 _startCollateralBalance = collateralAsset.balanceOf(address(_lastLender));
            uint256 _startBorrowAssetBalance = borrowAsset.balanceOf(address(_lastLender));
            emit log_named_uint('pcl.getPrincipal', pcl.getPrincipal(requestId));
            emit log_named_uint('lp balance', lp.balanceOf(address(_lastLender), requestId));
            uint256 _principalWithdrawable = lp.calculatePrincipalWithdrawable(requestId, address(_lastLender));
            emit log_named_uint('_principalWithdrawable', _principalWithdrawable);
            uint256 _interestWithdrawable = lp.getLenderInterestWithdrawable(requestId, address(_lastLender));
            emit log_named_uint('_interestWithdrawable', _interestWithdrawable);
            emit log_named_uint('borrow asset withdrawable of lender', _principalWithdrawable.add(_interestWithdrawable));
            // we cannot use lp balances because total supply is now not equal to amount lent
            uint256 _expectedCollateralWithdrawn = _collateralTokensLiquidated.mul(lenders[numLenders - 1].amount).div(amountToLend);
            emit log_named_uint('_expectedCollateralWithdrawn', _expectedCollateralWithdrawn);
            _lastLender.withdrawTokensAfterLiquidation(requestId);
            if (
                stdMath.delta(_startCollateralBalance.add(_expectedCollateralWithdrawn), collateralAsset.balanceOf(address(_lastLender))) >
                2
            ) {
                assertApproxEqRel(
                    _startCollateralBalance.add(_expectedCollateralWithdrawn),
                    collateralAsset.balanceOf(address(_lastLender)),
                    1e15
                );
            }

            emit log_named_uint('_expectedBorrowAssetWithdrawn', _principalWithdrawable.add(_interestWithdrawable));
            assertApproxEqRel(
                _startBorrowAssetBalance.add(_principalWithdrawable.add(_interestWithdrawable)),
                borrowAsset.balanceOf(address(_lastLender)),
                1e15
            );
        }
    }

    event Lend(uint256 indexed id, address indexed user, uint256 amount);
    event BorrowedFromPooledCreditLine(uint256 indexed id, uint256 borrowAmount);
    event AccrueInterest(uint256 cashPrior, uint256 interestAccumulated, uint256 borrowIndexNew, uint256 totalBorrowsNew);

    function test_requestToActiveToClosedPCL(
        uint256 _randomAmount,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        goToRequestedStageFuzzed(_randomAmount, _collateralRatio, _amountToLend, _randomNumber1, _randomNumber2, _randomNumber3);

        {
            if (request.borrowLimit > amountToLend) {
                PCLUser _lender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
                vm.expectRevert(bytes('LP:L1'));
                _lender.lend(requestId, 0);
                vm.expectRevert(bytes('LP:L2'));
                _lender.lend(requestId, 1e2);

                address _lenderAddress = createLender(requestId, request.borrowLimit - amountToLend, request.borrowAsset);
                lenders[numLenders] = LenderInfo(_lenderAddress, request.borrowLimit - amountToLend);
                amountToLend = request.borrowLimit;
                assertEq(request.borrowLimit, lp.totalSupply(requestId));
            } else {
                assertEq(request.borrowLimit, lp.totalSupply(requestId));
                PCLUser _lender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
                _lender.registerSelf(mockAdminVerifier1);
                vm.expectRevert(bytes('LP:L4'));
                _lender.lend(requestId, amountToLend.div(randomNumber3));
            }
        }

        // start the pcl
        {
            // go head in time
            _increaseBlock(t0 + request.collectionPeriod);
            vm.expectEmit(true, true, false, true);
            emit PooledCreditLineAccepted(requestId, amountToLend);
            borrower.start(requestId);
            // check status
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
        }

        {
            (, , , actualBorrowLimit, , , , ) = lp.pooledCLConstants(requestId);
        }

        {
            // deposit collateral
            uint256 _maxCollateral = pcl.getRequiredCollateral(requestId, actualBorrowLimit);
            if (_maxCollateral > collateralAsset.balanceOf(address(admin))) {
                _maxCollateral = collateralAsset.balanceOf(address(admin));
            }
            uint256 _collateralAmount = scaleToRange256(_randomAmount, _maxCollateral.div(100), _maxCollateral);
            admin.transferToken(request.collateralAsset, address(borrower), _collateralAmount);
            borrower.setAllowance(pooledCreditLineAddress, request.collateralAsset, _collateralAmount);
            borrower.depositCollateral(requestId, _collateralAmount, false);
            emit log_named_uint('_collateralAmount', _collateralAmount);
        }

        {
            uint256 _expectedBorrowedAmount = pcl
                .calculateBorrowableAmount(requestId)
                .mul(pcl.SCALING_FACTOR().sub(pcl.protocolFeeFraction()))
                .div(pcl.SCALING_FACTOR());
            borrower.borrow(requestId, pcl.calculateBorrowableAmount(requestId));
            emit log_named_uint('_expectedBorrowedAmount', _expectedBorrowedAmount);
            assertApproxEqRel(_expectedBorrowedAmount, borrowAsset.balanceOf(address(borrower)), 1e14);
        }

        // go ahead in time to accrue interest
        _increaseBlock(block.timestamp + request.duration.div(randomNumber3));

        {
            // check cur collateral ratio
            uint256 _curCollateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
            uint256 _moreCollateralRequired;
            if (pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId)) > pcl.calculateTotalCollateralTokens(requestId)) {
                _moreCollateralRequired = pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId)).sub(
                    pcl.calculateTotalCollateralTokens(requestId)
                );
            }
            if (_moreCollateralRequired > 0) {
                emit log_named_uint('_moreCollateralRequired', _moreCollateralRequired);
                if (_moreCollateralRequired > collateralAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.collateralAsset, _moreCollateralRequired);
                }
                admin.transferToken(request.collateralAsset, address(borrower), _moreCollateralRequired);
                borrower.setAllowance(pooledCreditLineAddress, request.collateralAsset, _moreCollateralRequired);
                borrower.depositCollateral(requestId, _moreCollateralRequired, false);
                // check cur collateral ratio
                if (_moreCollateralRequired > 1e3) {
                    // this condition is because otherwise the error is high
                    assertApproxEqRel(pcl.calculateCurrentCollateralRatio(requestId), request.collateralRatio, 1e16);
                }
            } else {
                // check how much more can be borrowed
                // the borrow rate is too low the yield is more nd the collateral ratio has increased
                uint256 _collateralRequired = pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId));
                assertLe(_collateralRequired, pcl.calculateTotalCollateralTokens(requestId));
            }
        }

        // go ahead in time to accrue interest
        {
            emit log_named_uint('before warp borrowCTokenAddress exchange rate', ICToken(borrowCTokenAddress).exchangeRateCurrent());
            _increaseBlock(block.timestamp + request.duration.div(randomNumber3));
            emit log_named_uint('after warp borrowCTokenAddress exchange rate', ICToken(borrowCTokenAddress).exchangeRateCurrent());
        }

        {
            // pay back interest
            uint256 _interestAccrued = pcl.calculateInterestAccrued(requestId);
            uint256 _toRepay = _interestAccrued;
            if (borrowAsset.balanceOf(address(borrower)) < _interestAccrued) {
                _toRepay = borrowAsset.balanceOf(address(borrower));
            }
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _toRepay);
            borrower.repay(requestId, _toRepay);
            emit log_named_uint('pcl.withdrawableCollateral(requestId)', pcl.withdrawableCollateral(requestId));
            emit log_named_uint('pcl.calculateTotalCollateralTokens(requestId)', pcl.calculateTotalCollateralTokens(requestId));
            emit log_named_uint('pcl.getRequiredCollateral', pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId)));
            // check withdrawable collateral
            if (pcl.withdrawableCollateral(requestId) > 1e3) {
                assertApproxEqRel(
                    pcl.withdrawableCollateral(requestId),
                    pcl.calculateTotalCollateralTokens(requestId).sub(
                        pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId))
                    ),
                    1e16
                );
            }
        }

        {
            (, , uint256 _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(requestId);
            PCLUser _lender = PCLUser(lenders[0].lenderAddress);
            uint256 _startBalance = borrowAsset.balanceOf(address(_lender));
            uint256 _expectedBorrowInterestForLender = _totalInterestRepaid.mul(lp.balanceOf(address(_lender), requestId)).div(
                lp.totalSupply(requestId)
            );
            emit log_named_uint('_expectedBorrowInterestForLender', _expectedBorrowInterestForLender);
            (uint256 _sharesHeld, uint256 _borrowerInterestShares, , , ) = lp.pooledCLVariables(requestId);
            uint256 _notBorrowedInShares = IYield(request.borrowAssetStrategy).getSharesForTokens(
                actualBorrowLimit.sub(pcl.getPrincipal(requestId)),
                request.borrowAsset
            );
            // assuming no interest has been withdrawn by any lender yet
            uint256 _expectedYieldInterestShares = _sharesHeld.sub(_notBorrowedInShares).sub(_borrowerInterestShares);
            uint256 _expectedYieldInterestForBorrower = IYield(request.borrowAssetStrategy)
                .getTokensForShares(_expectedYieldInterestShares, request.borrowAsset)
                .mul(lp.balanceOf(address(_lender), requestId))
                .div(lp.totalSupply(requestId));
            emit log_named_uint('_expectedYieldInterestForBorrower', _expectedYieldInterestForBorrower);
            _lender.withdrawInterest(requestId);
            uint256 _borrowerInterestSharesWithdrawn = lp.getLenderInfo(requestId, address(_lender)).borrowerInterestSharesWithdrawn;
            emit log_named_uint('_borrowerInterestSharesWithdrawn', _borrowerInterestSharesWithdrawn);
            if (_borrowerInterestSharesWithdrawn > 100) {
                assertApproxEqRel(
                    _startBalance.add(_expectedBorrowInterestForLender).add(_expectedYieldInterestForBorrower),
                    borrowAsset.balanceOf(address(_lender)),
                    1e16
                );
                assertApproxEqRel(
                    _expectedBorrowInterestForLender,
                    IYield(request.borrowAssetStrategy).getTokensForShares(_borrowerInterestSharesWithdrawn, request.borrowAsset),
                    1e16
                );
            }
        }

        {
            // withdraw collateral
            uint256 _collateralToWithdraw = pcl.withdrawableCollateral(requestId).div(randomNumber2);
            if (_collateralToWithdraw != 0) {
                borrower.withdrawCollateral(requestId, _collateralToWithdraw, false);
                assertApproxEqAbs(collateralAsset.balanceOf(address(borrower)), _collateralToWithdraw, 3);
            }
        }

        {
            (, , uint256 _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(requestId);
            emit log_named_uint('pcl.calculateInterestAccrued(requestId)', pcl.calculateInterestAccrued(requestId));
            emit log_named_uint('_totalInterestRepaid', _totalInterestRepaid);
            if (pcl.calculateInterestAccrued(requestId).sub(_totalInterestRepaid) == 0) {
                // cannot replay unless there is interest accrued

                // vm.expectRevert not working
                // vm.expectRevert(bytes('PCL:REP4'));
                // borrower.repay(requestId, borrowAsset.balanceOf(address(borrower)).div(randomNumber3));

                try borrower.repay(requestId, borrowAsset.balanceOf(address(borrower)).div(randomNumber3)) {
                    revert('cannot repay when interest is zero');
                } catch Error(string memory reason) {
                    assertEq(reason, 'PCL:REP4');
                }
            }
        }

        // go ahead in time to accrue interest
        _increaseBlock(block.timestamp + request.duration.div(randomNumber3));

        // repay
        {
            uint256 _currentDebt = pcl.calculateCurrentDebt(requestId);
            if (_currentDebt > borrowAsset.balanceOf(address(borrower))) {
                uint256 _delta = _currentDebt.sub(borrowAsset.balanceOf(address(borrower)));
                if (_delta > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _delta);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _delta);
            }
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _currentDebt);
            borrower.repay(requestId, _currentDebt);
            assertEq(0, pcl.calculateCurrentDebt(requestId));
        }

        // go to end and verify if pcl is closed
        _increaseBlock(t0 + request.collectionPeriod + request.duration);
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.CLOSED);

        {
            uint256 _startBalance = collateralAsset.balanceOf(address(borrower));
            uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
            borrower.withdrawAllCollateral(requestId, false);
            assertApproxEqAbs(_withdrawableCollateral.add(_startBalance), collateralAsset.balanceOf(address(borrower)), 3);
        }

        // go forward to avoid sub overflow error in _calculateLenderInterest
        _increaseBlock(block.timestamp + request.duration.div(randomNumber3));

        {
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            _lender.withdrawInterest(requestId);
        }

        {
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            uint256 _startBalance = borrowAsset.balanceOf(address(_lender));
            uint256 _expectedLiquidityWithdrawn = lp.balanceOf(address(_lender), requestId).add(
                lp.getLenderInterestWithdrawable(requestId, address(_lender))
            );
            emit log_named_uint('_expectedLiquidityWithdrawn', _expectedLiquidityWithdrawn);
            _lender.withdrawLiquidity(requestId);
            uint256 _actualLiquidityWithdrawn = borrowAsset.balanceOf(address(_lender)).sub(_startBalance);
            emit log_named_uint('_actualLiquidityWithdrawn', _actualLiquidityWithdrawn);
            assertApproxEqRel(_expectedLiquidityWithdrawn, _actualLiquidityWithdrawn, 1e15);
        }
    }

    function test_requestToActiveToExpiredPCL(
        uint256 _randomAmount,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        goToRequestedStageFuzzed(_randomAmount, _collateralRatio, _amountToLend, _randomNumber1, _randomNumber2, _randomNumber3);

        // start the pcl
        {
            // go head in time
            _increaseBlock(t0 + request.collectionPeriod);
            vm.expectEmit(true, true, false, true);
            emit PooledCreditLineAccepted(requestId, amountToLend);
            borrower.start(requestId);
            // check status
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
        }

        {
            (, , , actualBorrowLimit, , , , ) = lp.pooledCLConstants(requestId);
        }

        {
            // borrow tokens
            // try to borrow some tokens
            uint256 _amountToBorrow = actualBorrowLimit.mul(randomNumber2).div(11);
            emit log_named_uint('_amountToBorrow', _amountToBorrow);
            bool isOverLimit;
            // decide how much collateral is needed
            uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, _amountToBorrow);
            emit log_named_uint('_requiredCollateral', _requiredCollateral);
            if (_requiredCollateral > collateralAsset.balanceOf(address(admin))) {
                _requiredCollateral = collateralAsset.balanceOf(address(admin)).div(randomNumber3);
                isOverLimit = true;
            }
            // deposit collateral
            admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
            borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
            borrower.depositCollateral(requestId, _requiredCollateral, false);
            // calculateBorrowableAmount
            uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
            emit log_named_uint('_borrowableAmount', _borrowableAmount);
            if (!isOverLimit) {
                if (stdMath.delta(_amountToBorrow, _borrowableAmount) > 2 && _requiredCollateral > 1e3) {
                    assertApproxEqRel(_amountToBorrow, _borrowableAmount, 1e16);
                }
            }
            // borrow the required amount
            borrower.borrow(requestId, _borrowableAmount);
        }

        // go ahead in time to expire the pcl
        _increaseBlock(t0 + request.collectionPeriod + request.duration);

        uint256 _interestAccruedTillExpiry = pcl.calculateInterestAccrued(requestId);
        emit log_named_uint('_interestAccruedTillExpiry', _interestAccruedTillExpiry);

        // the grace period has started
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.EXPIRED);

        {
            uint256 _collateralRequired;
            if (pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId)) > pcl.calculateTotalCollateralTokens(requestId)) {
                _collateralRequired = pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId)).sub(
                    pcl.calculateTotalCollateralTokens(requestId)
                );
            }
            if (_collateralRequired > 0) {
                // because of precision errors
                _collateralRequired = _collateralRequired.mul(110).div(100);
            } else if (pcl.calculateCurrentCollateralRatio(requestId) < request.collateralRatio) {
                // take a random amount
                _collateralRequired = 1e2;
            }
            if (_collateralRequired > 0) {
                if (_collateralRequired > collateralAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.collateralAsset, _collateralRequired);
                }
                emit log_named_uint('_collateralRequired', _collateralRequired);
                admin.transferToken(request.collateralAsset, address(borrower), _collateralRequired);
                borrower.setAllowance(pooledCreditLineAddress, request.collateralAsset, _collateralRequired);
                borrower.depositCollateral(requestId, _collateralRequired, false);
                emit log_named_uint('current Collateral Ratio', pcl.calculateCurrentCollateralRatio(requestId));
                emit log_named_uint('request.collateralRatio', request.collateralRatio);
                assertGe(pcl.calculateCurrentCollateralRatio(requestId), request.collateralRatio);
            }
        }

        {
            // (, , uint256 _idealCollateralRatio, , , , , , , , , ) = pcl.pooledCreditLineConstants(requestId);
            emit log_named_uint('current Collateral Ratio', pcl.calculateCurrentCollateralRatio(requestId));
            // emit log_named_uint('_idealCollateralRatio', _idealCollateralRatio);
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            vm.expectRevert(bytes('PCL:L3'));
            _lender.liquidate(requestId, true);
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.EXPIRED);
            vm.expectRevert(bytes('LP:IWL3'));
            _lender.withdrawLiquidity(requestId);
        }

        _increaseBlock(t0 + request.collectionPeriod + request.duration + request.defaultGracePeriod);

        {
            uint256 _interestAccruedTillEndOfGracePeriod = pcl.calculateInterestAccrued(requestId);
            emit log_named_uint('_interestAccruedTillEndOfGracePeriod', _interestAccruedTillEndOfGracePeriod);
            uint256 _expectedPenaltyInterest = pcl
                .getPrincipal(requestId)
                .mul(request.gracePenaltyRate)
                .mul(request.defaultGracePeriod)
                .div(365 days)
                .div(pcl.SCALING_FACTOR());
            uint256 _expectedPrincipalInterest = pcl
                .getPrincipal(requestId)
                .mul(request.borrowRate)
                .mul(request.defaultGracePeriod)
                .div(365 days)
                .div(pcl.SCALING_FACTOR());
            assertApproxEqRel(
                _expectedPenaltyInterest,
                _interestAccruedTillEndOfGracePeriod.sub(_interestAccruedTillExpiry).sub(_expectedPrincipalInterest),
                1e14
            );
        }

        // can either go for close, liquidation or terminate
    }

    function test_requestToActiveToTerminatedPCL(
        uint256 _randomAmount,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        goToRequestedStageFuzzed(_randomAmount, _collateralRatio, _amountToLend, _randomNumber1, _randomNumber2, _randomNumber3);

        // start the pcl
        {
            // go head in time
            _increaseBlock(t0 + request.collectionPeriod);
            vm.expectEmit(true, true, false, true);
            emit PooledCreditLineAccepted(requestId, amountToLend);
            borrower.start(requestId);
            // check status
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
        }

        {
            // borrow tokens
            // try to borrow some tokens
            uint256 _amountToBorrow = amountToLend.mul(randomNumber2).div(11);
            emit log_named_uint('_amountToBorrow', _amountToBorrow);
            bool isOverLimit;
            // decide how much collateral is needed
            uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, _amountToBorrow);
            emit log_named_uint('_requiredCollateral', _requiredCollateral);
            if (_requiredCollateral > collateralAsset.balanceOf(address(admin))) {
                _requiredCollateral = collateralAsset.balanceOf(address(admin)).div(randomNumber3);
                isOverLimit = true;
            }
            // deposit collateral
            admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
            borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
            borrower.depositCollateral(requestId, _requiredCollateral, false);
            // calculateBorrowableAmount
            uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
            emit log_named_uint('_borrowableAmount', _borrowableAmount);
            if (!isOverLimit) {
                // adding 1 for precision errors
                if (stdMath.delta(_amountToBorrow, _borrowableAmount) > 2 && _requiredCollateral > 1e3) {
                    assertApproxEqRel(_amountToBorrow, _borrowableAmount, 1e16);
                }
            }
            // borrow the required amount
            borrower.borrow(requestId, _borrowableAmount);
        }

        // go ahead in time
        _increaseBlock(t0 + request.collectionPeriod + request.duration.div(randomNumber3));

        {
            // pay some interest
            uint256 _interestAccrued = pcl.calculateInterestAccrued(requestId);
            uint256 _interestToPay = _interestAccrued.div(randomNumber2);
            if (_interestAccrued > borrowAsset.balanceOf(address(borrower))) {
                uint256 _delta = _interestAccrued.sub(borrowAsset.balanceOf(address(borrower)));
                if (_delta > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _delta);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _delta);
            }
            emit log_named_uint('_interestToPay', _interestToPay);
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _interestToPay);
            borrower.repay(requestId, _interestToPay);

            assertTrue(lp.getLenderInterestWithdrawable(requestId, lenders[0].lenderAddress) > 0);
        }

        // go ahead in time
        _increaseBlock(block.timestamp + request.duration.div(randomNumber3));

        {
            // lender withdraws interest
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            _lender.withdrawInterest(requestId);
        }

        {
            // pay back interest plus some principal
            (, , uint256 _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(requestId);
            uint256 _toRepay = pcl.calculateInterestAccrued(requestId).sub(_totalInterestRepaid).add(
                pcl.getPrincipal(requestId).div(randomNumber2)
            );
            emit log_named_uint('_toRepay', _toRepay);
            if (borrowAsset.balanceOf(address(borrower)) < _toRepay) {
                uint256 _delta = _toRepay.sub(borrowAsset.balanceOf(address(borrower)));
                if (_delta > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _delta);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _delta);
            }
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _toRepay);
            borrower.repay(requestId, _toRepay);
        }

        {
            // withdraw some collateral
            uint256 _withdrawableCollateral = pcl.withdrawableCollateral(requestId);
            emit log_named_uint('_withdrawableCollateral', _withdrawableCollateral);
            assertTrue(_withdrawableCollateral > 0);
            borrower.withdrawCollateral(requestId, _withdrawableCollateral, false);
        }

        // go ahead in time
        _increaseBlock(block.timestamp + request.duration.div(randomNumber3));

        {
            uint256 _startBalanceBorrowAsset = borrowAsset.balanceOf(address(admin));
            uint256 _startBalanceCollateralAsset = collateralAsset.balanceOf(address(admin));
            uint256 _collateralTransferred = pcl.calculateTotalCollateralTokens(requestId);
            emit log_named_uint('_collateralTransferred', _collateralTransferred);

            // borrow tokens transferred calculation
            // NOTE: below calculation works only when totalSupply == borrowLimit
            // (uint256 _borrowLimit, , , , , , , , , , , ) = pcl.pooledCreditLineConstants(requestId);
            // assertEq(lp.totalSupply(requestId), _borrowLimit);
            (uint256 _sharesHeld, , , , ) = lp.pooledCLVariables(requestId);
            uint256 _expectedBorrowAssetTransferred = IYield(request.borrowAssetStrategy).getTokensForShares(
                _sharesHeld,
                request.borrowAsset
            );
            emit log_named_uint('_expectedBorrowAssetTransferred', _expectedBorrowAssetTransferred);

            admin.terminate(requestId);

            uint256 _endBalanceBorrowAsset = borrowAsset.balanceOf(address(admin));
            uint256 _endBalanceCollateralAsset = collateralAsset.balanceOf(address(admin));
            assertApproxEqAbs(_collateralTransferred, _endBalanceCollateralAsset.sub(_startBalanceCollateralAsset), 3);
            assertEq(_expectedBorrowAssetTransferred, _endBalanceBorrowAsset.sub(_startBalanceBorrowAsset));
        }
    }

    function test_requestToExpiredToLiquidatedPCL(
        uint256 _randomAmount,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        goToRequestedStageFuzzed(_randomAmount, _collateralRatio, _amountToLend, _randomNumber1, _randomNumber2, _randomNumber3);

        // start the pcl
        {
            // go head in time
            _increaseBlock(t0 + request.collectionPeriod);
            vm.expectEmit(true, true, false, true);
            emit PooledCreditLineAccepted(requestId, amountToLend);
            borrower.start(requestId);
            // check status
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
        }

        {
            (, , , actualBorrowLimit, , , , ) = lp.pooledCLConstants(requestId);
        }

        {
            uint256 _collateralAmount = pcl.getRequiredCollateral(requestId, actualBorrowLimit).div(randomNumber2);
            if (_collateralAmount > collateralAsset.balanceOf(address(admin))) {
                _collateralAmount = collateralAsset.balanceOf(address(admin)).div(randomNumber3);
            }
            emit log_named_uint('_collateralAmount', _collateralAmount);
            admin.transferToken(address(collateralAsset), address(borrower), _collateralAmount);
            borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralAmount);
            borrower.depositCollateral(requestId, _collateralAmount, false);
            // calculateBorrowableAmount
            uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
            borrower.borrow(requestId, _borrowableAmount);
        }

        // go ahead in time
        _increaseBlock(t0 + request.collectionPeriod + request.duration.div(randomNumber3));

        {
            // pay some amount
            uint256 _toPay = pcl.calculateInterestAccrued(requestId).div(randomNumber2);
            emit log_named_uint('_toPay', _toPay);
            if (borrowAsset.balanceOf(address(borrower)) < _toPay) {
                uint256 _delta = _toPay.sub(borrowAsset.balanceOf(address(borrower)));
                if (_delta > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _delta);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _delta);
            }
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _toPay);
            borrower.repay(requestId, _toPay);
            assertTrue(lp.getLenderInterestWithdrawable(requestId, lenders[0].lenderAddress) > 0);
        }

        // withdraw interest
        {
            (, , uint256 _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(requestId);
            PCLUser _lender = PCLUser(lenders[0].lenderAddress);
            uint256 _prevBalance = borrowAsset.balanceOf(address(_lender));
            _lender.withdrawInterest(requestId);
            uint256 _finalBalance = borrowAsset.balanceOf(address(_lender));
            uint256 _yieldInterestWithdrawnShares = lp.getLenderInfo(requestId, address(_lender)).yieldInterestWithdrawnShares;
            emit log_named_uint('_yieldInterestWithdrawnShares', _yieldInterestWithdrawnShares);
            uint256 _yieldInterest = IYield(request.borrowAssetStrategy).getTokensForShares(
                _yieldInterestWithdrawnShares,
                request.borrowAsset
            );
            uint256 _borrowerInterestWithdrawn = _totalInterestRepaid.mul(lp.balanceOf(address(_lender), requestId)).div(
                lp.totalSupply(requestId)
            );
            if (_yieldInterestWithdrawnShares > 100) {
                assertApproxEqRel(_yieldInterest.add(_borrowerInterestWithdrawn), _finalBalance.sub(_prevBalance), 1e16);
            }
        }

        // repay again
        {
            // pay some amount
            uint256 _toPay = pcl.calculateInterestAccrued(requestId).div(randomNumber2);
            emit log_named_uint('_toPay', _toPay);
            if (borrowAsset.balanceOf(address(borrower)) < _toPay) {
                uint256 _delta = _toPay.sub(borrowAsset.balanceOf(address(borrower)));
                if (_delta > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _delta);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _delta);
            }
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _toPay);
            borrower.repay(requestId, _toPay);
            assertTrue(lp.getLenderInterestWithdrawable(requestId, lenders[0].lenderAddress) > 0);
        }

        // go ahead in time by 2 blocks
        _increaseBlock(block.timestamp + BLOCK_TIME.mul(2));

        {
            (, , uint256 _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(requestId);
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            uint256 _prevBalance = borrowAsset.balanceOf(address(_lender));
            _lender.withdrawInterest(requestId);
            uint256 _finalBalance = borrowAsset.balanceOf(address(_lender));
            uint256 _yieldInterestWithdrawnShares = lp.getLenderInfo(requestId, address(_lender)).yieldInterestWithdrawnShares;
            emit log_named_uint('_yieldInterestWithdrawnShares', _yieldInterestWithdrawnShares);
            uint256 _yieldInterest = IYield(request.borrowAssetStrategy).getTokensForShares(
                _yieldInterestWithdrawnShares,
                request.borrowAsset
            );
            uint256 _borrowerInterestWithdrawn = _totalInterestRepaid.mul(lp.balanceOf(address(_lender), requestId)).div(
                lp.totalSupply(requestId)
            );
            emit log_named_uint('_finalBalance', _finalBalance);
            emit log_named_uint('_prevBalance', _prevBalance);
            if (_yieldInterestWithdrawnShares > 100) {
                assertApproxEqRel(_yieldInterest.add(_borrowerInterestWithdrawn), _finalBalance.sub(_prevBalance), 1e15);
            }
        }

        _increaseBlock(t0 + request.collectionPeriod + request.duration + request.defaultGracePeriod.div(randomNumber3));

        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.EXPIRED);

        {
            // cannot borrow
            vm.expectRevert(bytes('PCL:IB3'));
            borrower.borrow(requestId, actualBorrowLimit.div(randomNumber3));
            emit log('cannot borrow');
        }

        // cannot withdraw collateral
        {
            // vm.expectRevert not working
            try borrower.withdrawCollateral(requestId, pcl.calculateTotalCollateralTokens(requestId), false) {
                revert('should have thrown error that cannot withdrawCollateral');
            } catch Error(string memory reason) {
                assertEq(reason, 'PCL:WC1');
            }
            emit log('cannot withdrawCollateral');
        }

        {
            // can deposit collateral
            uint256 _prevCollateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
            uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, pcl.calculateCurrentDebt(requestId));
            if (_requiredCollateral <= pcl.calculateTotalCollateralTokens(requestId)) {
                _increaseBlock(t0 + request.collectionPeriod + request.duration + request.defaultGracePeriod);
            } else {
                uint256 _collateralToDeposit = _requiredCollateral.sub(pcl.calculateTotalCollateralTokens(requestId));
                _collateralToDeposit = _collateralToDeposit.div(randomNumber3);
                emit log_named_uint('_collateralToDeposit', _collateralToDeposit);
                if (_collateralToDeposit > 0) {
                    if (_collateralToDeposit > collateralAsset.balanceOf(address(admin))) {
                        _collateralToDeposit = collateralAsset.balanceOf(address(admin));
                    }
                    admin.transferToken(address(collateralAsset), address(borrower), _collateralToDeposit);
                    borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralToDeposit);
                    borrower.depositCollateral(requestId, _collateralToDeposit, false);
                    uint256 _curCollateralRatio = pcl.calculateCurrentCollateralRatio(requestId);
                    emit log_named_uint('_curCollateralRatio', _curCollateralRatio);
                    emit log_named_uint('_prevCollateralRatio', _prevCollateralRatio);
                    assertTrue(_curCollateralRatio >= _prevCollateralRatio);
                }
            }
        }

        {
            // liquidate
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            _lender.liquidate(requestId, true);
            emit log_named_uint('pcl.getStatusAndUpdate(requestId)', uint256(pcl.getStatusAndUpdate(requestId)));
            assertTrue(PooledCreditLineStatus.LIQUIDATED == pcl.getStatusAndUpdate(requestId));
        }

        {
            // withdraw liquidated tokens
            PCLUser _lender = PCLUser(lenders[0].lenderAddress);
            uint256 _prevBalance = lp.balanceOf(address(_lender), requestId);
            emit log_named_uint('_prevBalance', _prevBalance);
            assertTrue(_prevBalance > 0);
            _lender.withdrawTokensAfterLiquidation(requestId);
            uint256 _finalBalance = lp.balanceOf(address(_lender), requestId);
            emit log_named_uint('_finalBalance', _finalBalance);
            assertEq(_finalBalance, 0);
        }

        {
            // borrower can withdraw any collateral left
            uint256 _collateralLeft = pcl.calculateTotalCollateralTokens(requestId);
            if (_collateralLeft > 0) {
                emit log_named_uint('_collateralLeft', _collateralLeft);
                uint256 _prevBalance = collateralAsset.balanceOf(address(borrower));
                borrower.withdrawAllCollateral(requestId, false);
                uint256 _finalBalance = collateralAsset.balanceOf(address(borrower));
                emit log_named_uint('balance delta', _finalBalance.sub(_prevBalance));
                if (stdMath.delta(_collateralLeft, _finalBalance.sub(_prevBalance)) > 2) {
                    assertApproxEqRel(_collateralLeft, _finalBalance.sub(_prevBalance), 1e15);
                }
            }
        }
    }

    function test_requestToExpiredToTerminatedPCL(
        uint256 _randomAmount,
        uint256 _collateralRatio,
        uint128 _amountToLend,
        uint256 _randomNumber1,
        uint256 _randomNumber2,
        uint256 _randomNumber3
    ) public {
        goToRequestedStageFuzzed(_randomAmount, _collateralRatio, _amountToLend, _randomNumber1, _randomNumber2, _randomNumber3);

        // start the pcl
        {
            // go head in time
            _increaseBlock(t0 + request.collectionPeriod);
            vm.expectEmit(true, true, false, true);
            emit PooledCreditLineAccepted(requestId, amountToLend);
            borrower.start(requestId);
            // check status
            assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.ACTIVE);
        }

        {
            (, , , actualBorrowLimit, , , , ) = lp.pooledCLConstants(requestId);
        }

        {
            // try to borrow some tokens
            bool isOverLimit;
            uint256 _amountToBorrow = amountToLend.div(randomNumber3);
            emit log_named_uint('_amountToBorrow', _amountToBorrow);

            uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, _amountToBorrow);
            emit log_named_uint('_requiredCollateral', _requiredCollateral);
            if (_requiredCollateral > collateralAsset.balanceOf(address(admin))) {
                _requiredCollateral = collateralAsset.balanceOf(address(admin)).div(randomNumber3);
                isOverLimit = true;
            }
            admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
            borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
            borrower.depositCollateral(requestId, _requiredCollateral, false);
            uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
            emit log_named_uint('_borrowableAmount', _borrowableAmount);
            // borrow the required amount
            uint256 _startBalance = borrowAsset.balanceOf(address(borrower));
            borrower.borrow(requestId, _borrowableAmount);
            assertApproxEqRel(
                _borrowableAmount.mul(pcl.SCALING_FACTOR().sub(pcl.protocolFeeFraction())).div(pcl.SCALING_FACTOR()),
                borrowAsset.balanceOf(address(borrower)).sub(_startBalance),
                1e14
            );
        }

        // go ahead in time to accrue interest
        _increaseBlock(t0 + request.collectionPeriod + request.duration.div(randomNumber3));

        {
            // pay some amount
            uint256 _toPay = pcl.calculateInterestAccrued(requestId).div(10);
            emit log_named_uint('_toPay', _toPay);
            if (borrowAsset.balanceOf(address(borrower)) < _toPay) {
                uint256 _delta = _toPay.sub(borrowAsset.balanceOf(address(borrower)));
                if (_delta > borrowAsset.balanceOf(address(admin))) {
                    writeTokenBalance(address(admin), request.borrowAsset, _delta);
                }
                admin.transferToken(request.borrowAsset, address(borrower), _delta);
            }
            borrower.setAllowance(pooledCreditLineAddress, request.borrowAsset, _toPay);
            borrower.repay(requestId, _toPay);
            assertTrue(lp.getLenderInterestWithdrawable(requestId, lenders[0].lenderAddress) > 0);
        }

        {
            (, , uint256 _totalInterestRepaid, , ) = pcl.pooledCreditLineVariables(requestId);
            PCLUser _lender = PCLUser(lenders[numLenders - 1].lenderAddress);
            uint256 _prevBalance = borrowAsset.balanceOf(address(_lender));
            _lender.withdrawInterest(requestId);
            uint256 _finalBalance = borrowAsset.balanceOf(address(_lender));
            uint256 _yieldInterestWithdrawnShares = lp.getLenderInfo(requestId, address(_lender)).yieldInterestWithdrawnShares;
            emit log_named_uint('_yieldInterestWithdrawnShares', _yieldInterestWithdrawnShares);
            uint256 _yieldInterest = IYield(request.borrowAssetStrategy).getTokensForShares(
                _yieldInterestWithdrawnShares,
                request.borrowAsset
            );
            uint256 _borrowerInterestWithdrawn = _totalInterestRepaid.mul(lp.balanceOf(address(_lender), requestId)).div(
                lp.totalSupply(requestId)
            );
            if (_yieldInterestWithdrawnShares > 100) {
                // otherwise the delta is too large
                assertApproxEqRel(_yieldInterest.add(_borrowerInterestWithdrawn), _finalBalance.sub(_prevBalance), 1e16);
            }
        }

        // go ahead in time to accrue interest
        _increaseBlock(block.timestamp + BLOCK_TIME.mul(2));

        {
            PCLUser _lender = PCLUser(lenders[0].lenderAddress);
            uint256 _prevBalance = borrowAsset.balanceOf(address(_lender));
            _lender.withdrawInterest(requestId);
            uint256 _curBalance = borrowAsset.balanceOf(address(_lender));
            LenderPool.LenderInfo memory _info = lp.getLenderInfo(requestId, address(_lender));
            uint256 _interest = IYield(request.borrowAssetStrategy).getTokensForShares(
                _info.borrowerInterestSharesWithdrawn.add(_info.yieldInterestWithdrawnShares),
                address(borrowAsset)
            );
            assertApproxEqRel(_interest, _curBalance.sub(_prevBalance), 1e14);
        }

        // go ahead in time to accrue interest
        _increaseBlock(block.timestamp + request.duration.div(randomNumber3));

        // terminate
        {
            uint256 _startBalanceBorrowAsset = borrowAsset.balanceOf(address(admin));
            uint256 _startBalanceCollateralAsset = collateralAsset.balanceOf(address(admin));
            uint256 _collateralTransferred = pcl.calculateTotalCollateralTokens(requestId);
            emit log_named_uint('_collateralTransferred', _collateralTransferred);

            // borrow tokens transferred calculation
            // NOTE: below calculation works only when totalSupply == borrowLimit
            // {
            //     (uint256 _borrowLimit, , , , , , , , , , , ) = pcl.pooledCreditLineConstants(requestId);
            //     assertEq(lp.totalSupply(requestId), _borrowLimit);
            // }
            uint256 _expectedBorrowAssetTransferred;
            {
                (uint256 _sharesHeld, , , , ) = lp.pooledCLVariables(requestId);
                _expectedBorrowAssetTransferred = IYield(request.borrowAssetStrategy).getTokensForShares(_sharesHeld, request.borrowAsset);
            }
            emit log_named_uint('_expectedBorrowAssetTransferred', _expectedBorrowAssetTransferred);

            admin.terminate(requestId);

            //uint256 _endBalanceBorrowAsset = borrowAsset.balanceOf(address(admin));
            //uint256 _endBalanceCollateralAsset = collateralAsset.balanceOf(address(admin));
            assertApproxEqAbs(_collateralTransferred, (collateralAsset.balanceOf(address(admin))).sub(_startBalanceCollateralAsset), 3);
            assertEq(_expectedBorrowAssetTransferred, (borrowAsset.balanceOf(address(admin))).sub(_startBalanceBorrowAsset));
        }

        {
            // token transfer not possible
            PCLUser _lender = PCLUser(lenders[0].lenderAddress);
            // vm.expectRevert not working
            try
                _lender.transferLPTokens(
                    address(lenders[numLenders - 1].lenderAddress),
                    requestId,
                    lp.balanceOf(address(_lender), requestId)
                )
            {
                revert('cannot transfer tokens');
            } catch Error(string memory reason) {
                assertEq(reason, 'LP:IT3');
            }
        }
    }
}
