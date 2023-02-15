// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../PooledCreditLine/LenderPool.sol';
import '../../../PriceOracle.sol';
import '../../../interfaces/IPriceOracle.sol';
import '../../../SavingsAccount/SavingsAccount.sol';
import '../../../yield/NoYield.sol';
import '../../../yield/CompoundYield.sol';
import '../../../mocks/MockV3Aggregator.sol';
import '../../../mocks/MockToken.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '../../../interfaces/ISavingsAccount.sol';
import '../Helpers/PCLParent.t.sol';
import './PCLLifecycleTest.t.sol';

contract PCLLifecycleTestWETHUSDC is PCLLifecycleTest {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for IERC20;

    function setCollateralAsset() public override {
        if (isForked) {
            collateralAsset = ERC20(Constants.USDC);
            collateralAssetAggregatorAddress = Constants.USDC_priceFeedChainlink;
            collateralCTokenAddress = Constants.cUSDC;
        } else {
            collateralAsset = new MockToken('CollateralAsset', 'MUSDC', 6, 1e40, address(admin));
            collateralAssetAggregatorAddress = address(new MockV3Aggregator(6, 12876423400));
        }
    }

    function setBorrowAsset() public override {
        if (isForked) {
            borrowAsset = IERC20(Constants.WETH);
            borrowAssetAggregatorAddress = Constants.ETH_priceFeedChainlink;
            borrowCTokenAddress = Constants.cETH;
        } else {
            borrowAsset = new MockToken('BorrowAsset', 'MWETH', 18, 1e40, address(admin));
            borrowAssetAggregatorAddress = address(new MockV3Aggregator(18, 1950405767382174661));
        }
    }

    function setUp() public override {
        super.setUp();
        request.borrowAssetStrategy = compoundYieldAddress;
        request.collateralAssetStrategy = compoundYieldAddress;
    }
}
