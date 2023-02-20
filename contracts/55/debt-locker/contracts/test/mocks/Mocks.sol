// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import { IERC20 }             from "../../../modules/erc20/src/interfaces/IERC20.sol";
import { ILiquidatorLike }    from "../../../modules/liquidations/contracts/interfaces/Interfaces.sol";

import { ERC20Helper } from "../../../modules/erc20-helper/src/ERC20Helper.sol";
import { MockERC20 }   from "../../../modules/erc20/src/test/mocks/MockERC20.sol";

import { IDebtLocker }        from "../../interfaces/IDebtLocker.sol";
import { IDebtLockerFactory } from "../../interfaces/IDebtLockerFactory.sol";

contract MockPoolFactory {

    address public globals;

    constructor(address globals_) {
        globals = globals_;
    }

    function createPool(address poolDelegate_) external returns (address) {
        return address(new MockPool(poolDelegate_));
    }

}

contract MockPool {

    address public poolDelegate;
    address public superFactory;

    constructor(address poolDelegate_) {
        poolDelegate = poolDelegate_;
        superFactory = msg.sender;
    }

    function createDebtLocker(address dlFactory, address loan) external returns (address) {
        return IDebtLockerFactory(dlFactory).newLocker(loan);
    }

    function claim(address debtLocker) external returns (uint256[7] memory) {
        return IDebtLocker(debtLocker).claim();
    }

    function triggerDefault(address debtLocker) external {
        return IDebtLocker(debtLocker).triggerDefault();
    }

}

contract MockLiquidationStrategy {

    function flashBorrowLiquidation(address lender_, uint256 swapAmount_, address collateralAsset_, address fundsAsset_) external {
        uint256 repaymentAmount = IDebtLocker(lender_).getExpectedAmount(swapAmount_);

        ERC20Helper.approve(fundsAsset_, lender_, repaymentAmount);

        ILiquidatorLike(lender_).liquidatePortion(
            swapAmount_,
            type(uint256).max,
            abi.encodeWithSelector(this.swap.selector, collateralAsset_, fundsAsset_, swapAmount_, repaymentAmount)
        );
    }

    function swap(address collateralAsset_, address fundsAsset_, uint256 swapAmount_, uint256 repaymentAmount_) external {
        MockERC20(fundsAsset_).mint(address(this), repaymentAmount_);
        MockERC20(collateralAsset_).burn(address(this), swapAmount_);
    }

}

contract MockLoan {
    
    function principalRequested() external view returns (uint256 principalRequested_) {
        return 0;
    }

    function acceptNewTerms(address refinancer_, bytes[] calldata calls_, uint256 amount_) external {
        // Empty, just testing ACL
    }
    
}

contract MockGlobals {

    address public governor;

    mapping(address => bool) public isValidCollateralAsset;
    mapping(address => bool) public isValidLiquidityAsset;
    
    bool public protocolPaused;

    mapping(address => uint256) assetPrices;

    constructor (address governor_) {
        governor = governor_;
    }

    function getLatestPrice(address asset_) external view returns (uint256 price_) {
        return assetPrices[asset_];
    }

    function setPrice(address asset_, uint256 price_) external {
        assetPrices[asset_] = price_;
    }

    function setProtocolPause(bool paused_) external {
        protocolPaused = paused_;
    }

    function investorFee() external pure returns (uint256 investorFee_) {
        return 50;
    }

    function treasuryFee() external pure returns (uint256 treasuryFee_) {
        return 50;
    }

    function mapleTreasury() external pure returns (address mapleTreasury_) {
        return address(1);
    }

    function setValidCollateralAsset(address asset_, bool valid_) external {
        isValidCollateralAsset[asset_] = valid_;
    }

    function setValidLiquidityAsset(address asset_, bool valid_) external {
        isValidLiquidityAsset[asset_] = valid_;
    }

}

contract MockMigrator {

    fallback() external { }

}
