// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../PooledCreditLine/LenderPool.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';

import '../Helpers/PCLParent.t.sol';

contract BeforeLiquidationFailureCases is IPooledCreditLineDeclarations, PCLParent {
    using SafeMath for uint256;
    using SafeMath for uint128;
    uint256 requestId;

    function setUp() public override {
        super.setUp();

        lp = LenderPool(lenderPoolAddress);
        pcl = PooledCreditLine(pooledCreditLineAddress);

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

        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);
    }

    function test_noLiquidationIfCollateralRatioIsFineAndNotExpired1() public {
        assert_noLiquidationIfCollateralRatioIsFineAndNotExpired(requestId, uint128(request.minBorrowAmount), 0);
    }

    function test_noLiquidationIfCollateralRatioIsFineAndNotExpired2() public {
        assert_noLiquidationIfCollateralRatioIsFineAndNotExpired(requestId, request.borrowLimit, request.duration - 1);
    }

    function test_noLiquidationIfCollateralRatioIsFineAndNotExpired3() public {
        assert_noLiquidationIfCollateralRatioIsFineAndNotExpired(requestId, uint128(request.minBorrowAmount), request.duration - 1);
    }

    function test_noLiquidationIfCollateralRatioIsFineAndNotExpired4() public {
        assert_noLiquidationIfCollateralRatioIsFineAndNotExpired(requestId, uint128(request.minBorrowAmount), 0);
    }

    function assert_noLiquidationIfCollateralRatioIsFineAndNotExpired(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow.mul(90).div(100));

        vm.warp(block.timestamp + _warpTime);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    function test_noLiquidationIfCollateralRatioIsFineAtExpirationTimestamp1() public {
        assert_noLiquidationIfCollateralRatioIsFineAtExpirationTimestamp(requestId, uint128(request.minBorrowAmount));
    }

    function test_noLiquidationIfCollateralRatioIsFineAtExpirationTimestamp2() public {
        assert_noLiquidationIfCollateralRatioIsFineAtExpirationTimestamp(requestId, request.borrowLimit);
    }

    function assert_noLiquidationIfCollateralRatioIsFineAtExpirationTimestamp(uint256 _pclId, uint256 _amountToBorrow) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;
        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);
        borrower.borrow(_pclId, _amountToBorrow.mul(90).div(100));

        vm.warp(block.timestamp + request.duration);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    function test_noLiquidateIfInGracePeriod1() public {
        assert_noLiquidateIfInGracePeriod(requestId, request.borrowLimit, request.duration + 1);
    }

    function test_noLiquidateIfInGracePeriod2() public {
        assert_noLiquidateIfInGracePeriod(requestId, request.borrowLimit, request.duration + request.defaultGracePeriod - 1);
    }

    function test_noLiquidateIfInGracePeriod3() public {
        assert_noLiquidateIfInGracePeriod(requestId, uint128(request.minBorrowAmount), request.duration + 1);
    }

    function test_noLiquidateIfInGracePeriod4() public {
        assert_noLiquidateIfInGracePeriod(requestId, uint128(request.minBorrowAmount), request.duration + request.defaultGracePeriod - 1);
    }

    function assert_noLiquidateIfInGracePeriod(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow);

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(_pclId, _amountToBorrow.mul(90).div(100));

        vm.warp(block.timestamp + _warpTime);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);

        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L3');
        }
    }

    function test_noLiquidationIfBorrowPriceDropsToZero(uint128 _amountToBorrow) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, uint128(request.minBorrowAmount), request.borrowLimit);
        uint128 _warpTime = uint128(request.duration + request.defaultGracePeriod + 1);
        assert_noLiquidationIfBorrowPriceDropsToZero(requestId, _amountToBorrow, _warpTime);
    }

    function assert_noLiquidationIfBorrowPriceDropsToZero(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow.mul(90).div(100));

        vm.warp(block.timestamp + _warpTime);

        vm.mockCall(
            priceOracleAddress,
            abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(collateralAsset), address(borrowAsset)),
            abi.encode(0, 0) // price, decimals
        );

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'SafeMath: division by zero');
        }
    }

    function test_noLiquidationIfBorrowerTries(uint128 _amountToBorrow) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, uint128(request.minBorrowAmount), request.borrowLimit);
        uint128 _warpTime = uint128(request.duration + request.defaultGracePeriod + 1);
        assert_noLiquidationIfBorrowerTries(requestId, _amountToBorrow, _warpTime);
    }

    function assert_noLiquidationIfBorrowerTries(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow.mul(90).div(100));

        vm.warp(block.timestamp + _warpTime);

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(1);
        }

        try borrower.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:LIQ1');
        }
    }

    function test_noLiquidateIfAdminTries(uint128 _amountToBorrow, uint128 _warpTime) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 1, uint128(request.duration + request.defaultGracePeriod + request.duration));
        assert_noLiquidateIfAdminTries(requestId, _amountToBorrow, _warpTime);
    }

    function assert_noLiquidateIfAdminTries(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow);

        vm.warp(block.timestamp + _warpTime);

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(1);
        }

        try admin.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:LIQ1');
        }
    }

    function test_noLiquidateIfNotLenderButWasOnceTries(
        uint128 _amountToBorrow,
        uint128 _warpTime,
        uint128 _lenderIndex
    ) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));
        // this pool has 10 lenders and 0th lender is the one who receives the tokens
        _lenderIndex = scaleToRange128(_lenderIndex, 1, 9);
        assert_noLiquidateIfNotLenderButWasOnceTries(requestId, _amountToBorrow, _warpTime, _lenderIndex);
    }

    function assert_noLiquidateIfNotLenderButWasOnceTries(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime,
        uint256 _lenderIndex
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow);

        vm.warp(block.timestamp + _warpTime);
        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(1);
        }

        PCLUser _lender = PCLUser(lenders[_lenderIndex].lenderAddress);

        _lender.transferLPTokens(lenders[0].lenderAddress, _pclId, lenders[_lenderIndex].amount);

        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:LIQ1');
        }
    }

    function test_noLiquidateIfPrincipalZero(
        uint128 _amountToBorrow,
        uint128 _warpTime,
        uint128 _lenderIndex
    ) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));
        _lenderIndex = scaleToRange128(_lenderIndex, 0, 9);
        assert_noLiquidateIfPrincipalZero(requestId, _amountToBorrow, _warpTime, _lenderIndex);
    }

    function assert_noLiquidateIfPrincipalZero(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime,
        uint256 _lenderIndex
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        vm.warp(block.timestamp + _warpTime);

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(1);
        }

        PCLUser _lender = PCLUser(lenders[_lenderIndex].lenderAddress);
        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:L1');
        }
    }

    function test_noLiquidateIfPCLContractLiquidateMethodIsCalledByAdmin(uint128 _amountToBorrow, uint128 _warpTime) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));
        assert_noLiquidateIfPCLContractLiquidateMethodIsCalledByAdmin(requestId, _amountToBorrow, _warpTime);
    }

    function assert_noLiquidateIfPCLContractLiquidateMethodIsCalledByAdmin(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow);

        vm.warp(block.timestamp + _warpTime);

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(1);
        }

        try admin.noAccessLiquidate(_pclId) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OLP1');
        }
    }

    function test_noLiquidateIfPCLContractLiquidateMethodIsCalledByLender(
        uint128 _amountToBorrow,
        uint128 _warpTime,
        uint128 _lenderIndex
    ) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));
        _lenderIndex = scaleToRange128(_lenderIndex, 0, 9);
        PCLUser _lender = PCLUser(lenders[_lenderIndex].lenderAddress);
        assert_noLiquidateIfPCLContractLiquidateMethodIsCalledByAnyUser(requestId, _amountToBorrow, _warpTime, _lender);
    }

    function test_noLiquidateIfPCLContractLiquidateMethodIsCalledByBorrower(uint128 _amountToBorrow, uint128 _warpTime) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));

        assert_noLiquidateIfPCLContractLiquidateMethodIsCalledByAnyUser(requestId, _amountToBorrow, _warpTime, borrower);
    }

    function test_noLiquidateIfPCLContractLiquidateMethodIsCalledByOthers(uint128 _amountToBorrow, uint128 _warpTime) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, 1, request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));

        PCLUser _randomUser = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        assert_noLiquidateIfPCLContractLiquidateMethodIsCalledByAnyUser(requestId, _amountToBorrow, _warpTime, _randomUser);
    }

    function assert_noLiquidateIfPCLContractLiquidateMethodIsCalledByAnyUser(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime,
        PCLUser _user
    ) internal {
        // adding 1 to ensure that any diff due to imprecision issues is covered
        uint256 _collateralRequired = pcl.getRequiredCollateral(_pclId, _amountToBorrow) + 1;

        admin.transferToken(address(collateralAsset), address(borrower), _collateralRequired);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _collateralRequired);
        borrower.depositCollateral(_pclId, _collateralRequired, false);

        borrower.borrow(requestId, _amountToBorrow);

        vm.warp(block.timestamp + _warpTime);

        if (!isForked) {
            MockV3Aggregator(collateralAssetAggregatorAddress).updateAnswer(1);
        }

        try _user.noAccessLiquidate(_pclId) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:OLP1');
        }
    }

    function test_noLiquidateIfZeroCollateral(uint128 _amountToBorrow, uint128 _warpTime) public {
        _amountToBorrow = scaleToRange128(_amountToBorrow, uint128(request.minBorrowAmount), request.borrowLimit);
        _warpTime = scaleToRange128(_warpTime, 0, uint128(request.duration + request.defaultGracePeriod + request.duration));
        request.collateralRatio = 0;
        goToActiveStage(10, uint128(_amountToBorrow));
    }

    function assert_noLiquidateIfZeroCollateral(
        uint256 _pclId,
        uint256 _amountToBorrow,
        uint256 _warpTime
    ) internal {
        borrower.borrow(requestId, _amountToBorrow);

        vm.warp(block.timestamp + _warpTime);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        try _lender.liquidate(_pclId, true) {
            revert('Borrower liquidating should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:LIQ1');
        }
    }
}
