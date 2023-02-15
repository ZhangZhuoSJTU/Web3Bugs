// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../refs/CoreRef.sol";

contract MockCoreRef is CoreRef {
    constructor(address core) CoreRef(core) {
        _setContractAdminRole(keccak256("MOCK_CORE_REF_ADMIN"));
    }

    function testMinter() public view onlyMinter {}

    function testBurner() public view onlyBurner {}

    function testPCVController() public view onlyPCVController {}

    function testGovernor() public view onlyGovernor {}

    function testGuardian() public view onlyGuardianOrGovernor {}

    function testOnlyGovernorOrAdmin() public view onlyGovernorOrAdmin {}
}
