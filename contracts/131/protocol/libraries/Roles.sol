// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

// solhint-disable private-vars-leading-underscore

library Roles {
    bytes32 internal constant GOVERNANCE = "governance";
    bytes32 internal constant ADDRESS_PROVIDER = "address_provider";
    bytes32 internal constant POOL_FACTORY = "pool_factory";
    bytes32 internal constant CONTROLLER = "controller";
    bytes32 internal constant GAUGE_ZAP = "gauge_zap";
    bytes32 internal constant MAINTENANCE = "maintenance";
    bytes32 internal constant INFLATION_MANAGER = "inflation_manager";
    bytes32 internal constant POOL = "pool";
    bytes32 internal constant VAULT = "vault";
}
