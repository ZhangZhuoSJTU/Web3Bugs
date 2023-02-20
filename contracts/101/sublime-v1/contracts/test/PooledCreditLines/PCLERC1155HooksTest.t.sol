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

contract MaliciousLenderStart is PCLUser {
    constructor(address _pclAddress, address _lpAddress) PCLUser(_pclAddress, _lpAddress) {}

    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        // any code can be executed here
        LenderPool(msg.sender).start(id);
        return bytes4(keccak256('onERC1155Received(address,address,uint256,uint256,bytes)'));
    }
}

contract MaliciousLenderLiquidate is PCLUser {
    constructor(address _pclAddress, address _lpAddress) PCLUser(_pclAddress, _lpAddress) {}

    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        // any code can be executed here
        LenderPool(msg.sender).liquidate(id, true);
        return bytes4(keccak256('onERC1155Received(address,address,uint256,uint256,bytes)'));
    }
}

contract MaliciousLenderWithdrawInterest is PCLUser {
    constructor(address _pclAddress, address _lpAddress) PCLUser(_pclAddress, _lpAddress) {}

    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        // any code can be executed here
        LenderPool(msg.sender).withdrawInterest(id);
        return bytes4(keccak256('onERC1155Received(address,address,uint256,uint256,bytes)'));
    }
}

contract PCLERC1155HooksTest is PCLParent {
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
        request.borrowAssetStrategy = noYieldAddress;
        request.collateralAssetStrategy = noYieldAddress;
        request.borrowerVerifier = mockAdminVerifier2;
        request.areTokensTransferable = true;
    }

    function test_lendERC1155Hook() public {
        requestId = borrower.createRequest(request);
        PCLUser _pooledCreditLineLender = new MaliciousLenderStart(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(request.borrowAsset), address(_pooledCreditLineLender), request.borrowLimit);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(request.borrowAsset), type(uint256).max);

        try _pooledCreditLineLender.lend(requestId, request.borrowLimit) {
            revert('REVERT: should have reverted');
        } catch Error(string memory reason) {
            assertEq(reason, 'ReentrancyGuard: reentrant call');
        }
    }

    function test_withdrawInterestERC1155Hook() public {
        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit);
        admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
        borrower.depositCollateral(requestId, _requiredCollateral, false);
        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        borrower.borrow(requestId, _borrowableAmount);

        _increaseBlock(block.timestamp + request.duration.div(2));

        PCLUser _pooledCreditLineLender = new MaliciousLenderWithdrawInterest(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        try _lender.transferLPTokens(address(_pooledCreditLineLender), requestId, lp.balanceOf(address(_lender), requestId)) {
            revert('should throw LP:WI1');
        } catch Error(string memory reason) {
            assertEq(reason, 'LP:WI1');
        }
    }

    function test_liquidateERC1155Hook() public {
        (requestId, numLenders) = goToActiveStage(10, request.borrowLimit);

        uint256 _requiredCollateral = pcl.getRequiredCollateral(requestId, request.borrowLimit);
        admin.transferToken(address(collateralAsset), address(borrower), _requiredCollateral);
        borrower.setAllowance(pooledCreditLineAddress, address(collateralAsset), _requiredCollateral);
        borrower.depositCollateral(requestId, _requiredCollateral, false);
        uint256 _borrowableAmount = pcl.calculateBorrowableAmount(requestId);
        borrower.borrow(requestId, _borrowableAmount);

        PCLUser _pooledCreditLineLender = new MaliciousLenderLiquidate(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        _increaseBlock(block.timestamp + request.duration);

        PCLUser _lender = PCLUser(lenders[0].lenderAddress);
        _lender.transferLPTokens(address(_pooledCreditLineLender), requestId, lp.balanceOf(address(_lender), requestId));
        assertTrue(pcl.getStatusAndUpdate(requestId) == PooledCreditLineStatus.LIQUIDATED);
    }
}
