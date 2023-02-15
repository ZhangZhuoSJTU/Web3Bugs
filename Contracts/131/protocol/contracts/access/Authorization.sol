// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./AuthorizationBase.sol";

contract Authorization is AuthorizationBase {
    IRoleManager internal immutable __roleManager;

    constructor(IRoleManager roleManager) {
        __roleManager = roleManager;
    }

    function _roleManager() internal view override returns (IRoleManager) {
        return __roleManager;
    }
}
