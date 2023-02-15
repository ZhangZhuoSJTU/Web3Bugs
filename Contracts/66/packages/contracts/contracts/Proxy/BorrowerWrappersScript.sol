// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/LiquityMath.sol";
import "../Interfaces/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ISYETI.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./SYETIScript.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, SYETIScript {
    using SafeMath for uint;

    bytes32 constant public NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IERC20 immutable yusdToken;
    IERC20 immutable yetiToken;
    ISYETI immutable sYETI;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _sYETIAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        SYETIScript(_sYETIAddress)
        public
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

//        IPriceFeed priceFeedCached = troveManagerCached.priceFeed();
//        checkContract(address(priceFeedCached));
//        priceFeed = priceFeedCached;

        address yusdTokenCached = address(troveManagerCached.yusdToken());
        checkContract(yusdTokenCached);
        yusdToken = IERC20(yusdTokenCached);

        address yetiTokenCached = address(troveManagerCached.yetiToken());
        checkContract(yetiTokenCached);
        yetiToken = IERC20(yetiTokenCached);

        ISYETI sYETICached = troveManagerCached.sYETI();
        require(_sYETIAddress == address(sYETICached), "BorrowerWrappersScript: Wrong SYETI address");
        sYETI = sYETICached;
    }

//    function claimCollateralAndOpenTrove(uint _maxFee, uint _YUSDAmount, address _upperHint, address _lowerHint) external payable {
//        uint balanceBefore = address(this).balance;
//
//        // Claim collateral
//        borrowerOperations.claimCollateral();
//
//        uint balanceAfter = address(this).balance;
//
//        // already checked in CollSurplusPool
//        assert(balanceAfter > balanceBefore);
//
//        uint totalCollateral = balanceAfter.sub(balanceBefore).add(msg.value);
//
//        // Open trove with obtained collateral, plus collateral sent by user
//        borrowerOperations.openTrove{ value: totalCollateral }(_maxFee, _YUSDAmount, _upperHint, _lowerHint);
//    }
//
//    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
//        uint collBalanceBefore = address(this).balance;
//        uint yetiBalanceBefore = yetiToken.balanceOf(address(this));
//
//        // Claim rewards
//        stabilityPool.withdrawFromSP(0);
//
//        uint collBalanceAfter = address(this).balance;
//        uint yetiBalanceAfter = yetiToken.balanceOf(address(this));
//        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);
//
//        // Add claimed ETH to trove, get more YUSD and stake it into the Stability Pool
//        if (claimedCollateral != 0) {
//            _requireUserHasTrove(address(this));
//            uint YUSDAmount = _getNetYUSDAmount(claimedCollateral);
//            borrowerOperations.adjustTrove{ value: claimedCollateral }(_maxFee, 0, YUSDAmount, true, _upperHint, _lowerHint);
//            // Provide withdrawn YUSD to Stability Pool
//            if (YUSDAmount != 0) {
//                stabilityPool.provideToSP(YUSDAmount, address(0));
//            }
//        }
//
//        // Stake claimed YETI
//        uint claimedYETI = yetiBalanceAfter.sub(yetiBalanceBefore);
//        if (claimedYETI != 0) {
//             .stake(claimedYETI);
//        }
//    }
//
//    function claimStakingGainsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
//        uint collBalanceBefore = address(this).balance;
//        uint yusdBalanceBefore = yusdToken.balanceOf(address(this));
//        uint yetiBalanceBefore = yetiToken.balanceOf(address(this));
//
//        // Claim gains
//        sYETI.unstake(0);
//
//        uint gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
//        uint gainedYUSD = yusdToken.balanceOf(address(this)).sub(yusdBalanceBefore);
//
//        uint netYUSDAmount;
//        // Top up trove and get more YUSD, keeping ICR constant
//        if (gainedCollateral != 0) {
//            _requireUserHasTrove(address(this));
//            netYUSDAmount = _getNetYUSDAmount(gainedCollateral);
//            borrowerOperations.adjustTrove{ value: gainedCollateral }(_maxFee, 0, netYUSDAmount, true, _upperHint, _lowerHint);
//        }
//
//        uint totalYUSD = gainedYUSD.add(netYUSDAmount);
//        if (totalYUSD != 0) {
//            stabilityPool.provideToSP(totalYUSD, address(0));
//
//            // Providing to Stability Pool also triggers YETI claim, so stake it if any
//            uint yetiBalanceAfter = yetiToken.balanceOf(address(this));
//            uint claimedYETI = yetiBalanceAfter.sub(yetiBalanceBefore);
//            if (claimedYETI != 0) {
//                sYETI.mint(claimedYETI);
//            }
//        }
//
//    }
//
//    function _getNetYUSDAmount(uint _collateral) internal returns (uint) {
//        uint price = priceFeed.fetchPrice();
//        uint ICR = troveManager.getCurrentICR(address(this), price);
//
//        uint YUSDAmount = _collateral.mul(price).div(ICR);
//        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
//        uint netDebt = YUSDAmount.mul(LiquityMath.DECIMAL_PRECISION).div(LiquityMath.DECIMAL_PRECISION.add(borrowingRate));
//
//        return netDebt;
//    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.isTroveActive(_depositor), "BorrowerWrappersScript: caller must have an active trove");
    }
}