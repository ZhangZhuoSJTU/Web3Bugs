// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import { IMapleProxyFactory, MapleProxyFactory } from "../modules/maple-proxy-factory/contracts/MapleProxyFactory.sol";

import { IDebtLockerFactory } from "./interfaces/IDebtLockerFactory.sol";

/// @title Deploys DebtLocker proxy instances.
contract DebtLockerFactory is IDebtLockerFactory, MapleProxyFactory {

    uint8 public constant override factoryType = uint8(1);

    constructor(address mapleGlobals_) MapleProxyFactory(mapleGlobals_) {
        require(mapleGlobals_ != address(0));
    }

    function newLocker(address loan_) external override returns (address debtLocker_) {
        bytes memory arguments = abi.encode(loan_, msg.sender);

        bool success_;
        ( success_, debtLocker_ ) = _newInstance(defaultVersion, arguments);
        require(success_, "DLF:NL:FAILED");

        emit InstanceDeployed(defaultVersion, debtLocker_, arguments);
    }

    function createInstance(bytes calldata arguments_, bytes32 salt_)
        public override(IMapleProxyFactory, MapleProxyFactory) virtual returns (address instance_)
    {}

    function getInstanceAddress(bytes calldata arguments_, bytes32 salt_)
        public view override(IMapleProxyFactory, MapleProxyFactory) virtual returns (address instanceAddress_)
    {}

}
