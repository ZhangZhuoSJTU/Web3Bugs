// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import { IMapleProxyFactory } from "../../modules/maple-proxy-factory/contracts/interfaces/IMapleProxyFactory.sol";

/// @title Deploys DebtLocker proxy instances.
interface IDebtLockerFactory is IMapleProxyFactory {

    /**
     * @dev The Maple factory type (to be deprecated).
     */
    function factoryType() external view returns (uint8 factoryType_);

    /**
     * @dev Deploys a new DebtLocker proxy instance.
     * @param loan_ Loan contract that corresponds to DebtLocker.
     */
    function newLocker(address loan_) external returns (address debtLocker_);

}
