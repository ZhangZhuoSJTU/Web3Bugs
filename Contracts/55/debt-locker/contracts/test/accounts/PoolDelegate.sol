// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.7;

import { User as ProxyUser } from "../../../modules/maple-proxy-factory/contracts/test/accounts/User.sol";

import { IDebtLocker, IMapleProxied } from "../../interfaces/IDebtLocker.sol";

contract PoolDelegate is ProxyUser {

    /************************/
    /*** Direct Functions ***/
    /************************/

    function debtLocker_acceptNewTerms(address debtLocker_, address refinancer_, bytes[] calldata calls_, uint256 amount_) external {
        IDebtLocker(debtLocker_).acceptNewTerms(refinancer_, calls_, amount_);
    }

    function debtLocker_setAllowedSlippage(address debtLocker_, uint256 allowedSlippage_) external {
        IDebtLocker(debtLocker_).setAllowedSlippage(allowedSlippage_);
    }

    function debtLocker_setAuctioneer(address debtLocker_, address auctioneer_) external {
        IDebtLocker(debtLocker_).setAuctioneer(auctioneer_);
    }

    function debtLocker_setFundsToCapture(address debtLocker_, uint256 amount_) external {
        IDebtLocker(debtLocker_).setFundsToCapture(amount_);
    }

    function debtLocker_setMinRatio(address debtLocker_, uint256 minRatio_) external {
        IDebtLocker(debtLocker_).setMinRatio(minRatio_);
    }

    function debtLocker_stopLiquidation(address debtLocker_) external {
        IDebtLocker(debtLocker_).stopLiquidation();
    }
    
    function debtLocker_upgrade(address debtLocker_, uint256 toVersion_, bytes memory arguments_) external {
        IDebtLocker(debtLocker_).upgrade(toVersion_, arguments_);
    }

    /*********************/
    /*** Try Functions ***/
    /*********************/

    function try_debtLocker_acceptNewTerms(
        address debtLocker_, 
        address refinancer_,
        bytes[] calldata calls_,
        uint256 amount_
    ) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IDebtLocker.acceptNewTerms.selector, refinancer_, calls_, amount_));
    }

    function try_debtLocker_setAllowedSlippage(address debtLocker_, uint256 allowedSlippage_) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IDebtLocker.setAllowedSlippage.selector, allowedSlippage_));
    }

    function try_debtLocker_setAuctioneer(address debtLocker_, address auctioneer_) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IDebtLocker.setAuctioneer.selector, auctioneer_));
    }

    function try_debtLocker_setFundsToCapture(address debtLocker_, uint256 amount_) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IDebtLocker.setFundsToCapture.selector, amount_));
    }

    function try_debtLocker_setMinRatio(address debtLocker_, uint256 minRatio_) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IDebtLocker.setMinRatio.selector, minRatio_));
    }

    function try_debtLocker_stopLiquidation(address debtLocker_) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IDebtLocker.stopLiquidation.selector));
    }
    
    function try_debtLocker_upgrade(address debtLocker_, uint256 toVersion_, bytes memory arguments_) external returns (bool ok_) {
        ( ok_, ) = debtLocker_.call(abi.encodeWithSelector(IMapleProxied.upgrade.selector, toVersion_, arguments_));
    }

}
